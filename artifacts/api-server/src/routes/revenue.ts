import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, revenueEntriesTable } from "@workspace/db";
import {
  ListRevenueEntriesParams,
  CreateRevenueEntryParams,
  CreateRevenueEntryBody,
  UpdateRevenueEntryParams,
  UpdateRevenueEntryBody,
  DeleteRevenueEntryParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/events/:eventId/revenue", async (req, res): Promise<void> => {
  const params = ListRevenueEntriesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const entries = await db.select().from(revenueEntriesTable)
    .where(eq(revenueEntriesTable.eventId, params.data.eventId))
    .orderBy(revenueEntriesTable.createdAt);

  res.json(entries.map(e => ({
    ...e,
    amount: parseFloat(e.amount as string),
    createdAt: e.createdAt.toISOString(),
  })));
});

router.post("/events/:eventId/revenue", async (req, res): Promise<void> => {
  const params = CreateRevenueEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateRevenueEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [entry] = await db.insert(revenueEntriesTable).values({
    eventId: params.data.eventId,
    paymentType: parsed.data.paymentType,
    amount: String(parsed.data.amount),
    quantity: parsed.data.quantity ?? null,
    receivedDate: parsed.data.receivedDate ?? null,
    notes: parsed.data.notes ?? null,
    enteredBy: parsed.data.enteredBy ?? null,
  }).returning();

  res.status(201).json({
    ...entry,
    amount: parseFloat(entry.amount as string),
    createdAt: entry.createdAt.toISOString(),
  });
});

router.patch("/revenue/:id", async (req, res): Promise<void> => {
  const params = UpdateRevenueEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateRevenueEntryBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (parsed.data.paymentType !== undefined) updateData.paymentType = parsed.data.paymentType;
  if (parsed.data.amount !== undefined) updateData.amount = String(parsed.data.amount);
  if ("quantity" in parsed.data) updateData.quantity = parsed.data.quantity;
  if ("receivedDate" in parsed.data) updateData.receivedDate = parsed.data.receivedDate;
  if ("notes" in parsed.data) updateData.notes = parsed.data.notes;
  if ("enteredBy" in parsed.data) updateData.enteredBy = parsed.data.enteredBy;

  const [entry] = await db.update(revenueEntriesTable).set(updateData).where(eq(revenueEntriesTable.id, params.data.id)).returning();
  if (!entry) {
    res.status(404).json({ error: "Revenue entry not found" });
    return;
  }

  res.json({
    ...entry,
    amount: parseFloat(entry.amount as string),
    createdAt: entry.createdAt.toISOString(),
  });
});

router.delete("/revenue/:id", async (req, res): Promise<void> => {
  const params = DeleteRevenueEntryParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [entry] = await db.delete(revenueEntriesTable).where(eq(revenueEntriesTable.id, params.data.id)).returning();
  if (!entry) {
    res.status(404).json({ error: "Revenue entry not found" });
    return;
  }

  res.sendStatus(204);
});

export default router;
