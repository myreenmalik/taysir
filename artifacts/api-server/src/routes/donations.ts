import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, donationsTable } from "@workspace/db";
import {
  ListDonationsQueryParams,
  CreateDonationBody,
  UpdateDonationParams,
  UpdateDonationBody,
  DeleteDonationParams,
} from "@workspace/api-zod";
import { recomputeDonorStats } from "../lib/donorStats";

const router: IRouter = Router();

function serializeDonation(d: typeof donationsTable.$inferSelect) {
  return {
    ...d,
    amount: parseFloat(d.amount as string),
    createdAt: d.createdAt.toISOString(),
  };
}

const updateDonorStats = recomputeDonorStats;

router.get("/donations", async (req, res): Promise<void> => {
  const query = ListDonationsQueryParams.safeParse(req.query);
  let donations = await db.select().from(donationsTable).orderBy(donationsTable.date);

  if (query.success) {
    if (query.data.donorId) {
      donations = donations.filter(d => d.donorId === Number(query.data.donorId));
    }
    if (query.data.eventId) {
      donations = donations.filter(d => d.eventId === Number(query.data.eventId));
    }
    if (query.data.cause) {
      donations = donations.filter(d => d.cause === query.data.cause);
    }
  }

  res.json(donations.map(serializeDonation));
});

router.post("/donations", async (req, res): Promise<void> => {
  const parsed = CreateDonationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [donation] = await db.insert(donationsTable).values({
    donorId: parsed.data.donorId,
    eventId: parsed.data.eventId ?? null,
    date: parsed.data.date,
    amount: String(parsed.data.amount),
    cause: parsed.data.cause ?? null,
    campaign: parsed.data.campaign ?? null,
    season: parsed.data.season ?? null,
    donationType: parsed.data.donationType ?? "one-time",
    notes: parsed.data.notes ?? null,
  }).returning();

  await updateDonorStats(parsed.data.donorId);

  res.status(201).json(serializeDonation(donation));
});

router.patch("/donations/:id", async (req, res): Promise<void> => {
  const params = UpdateDonationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateDonationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.date !== undefined) updateData.date = parsed.data.date;
  if (parsed.data.amount !== undefined) updateData.amount = String(parsed.data.amount);
  if ("cause" in parsed.data) updateData.cause = parsed.data.cause;
  if ("campaign" in parsed.data) updateData.campaign = parsed.data.campaign;
  if ("season" in parsed.data) updateData.season = parsed.data.season;
  if (parsed.data.donationType !== undefined) updateData.donationType = parsed.data.donationType;
  if ("notes" in parsed.data) updateData.notes = parsed.data.notes;

  const [donation] = await db.update(donationsTable).set(updateData).where(eq(donationsTable.id, params.data.id)).returning();
  if (!donation) {
    res.status(404).json({ error: "Donation not found" });
    return;
  }

  await updateDonorStats(donation.donorId);
  res.json(serializeDonation(donation));
});

router.delete("/donations/:id", async (req, res): Promise<void> => {
  const params = DeleteDonationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [donation] = await db.delete(donationsTable).where(eq(donationsTable.id, params.data.id)).returning();
  if (!donation) {
    res.status(404).json({ error: "Donation not found" });
    return;
  }

  await updateDonorStats(donation.donorId);
  res.sendStatus(204);
});

export default router;
