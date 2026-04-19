import { Router, type IRouter, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db, donorsTable, donationsTable } from "@workspace/db";

const router: IRouter = Router();

const MAX_AI_COMMIT_ROWS = 5000;

type AIRow = Record<string, unknown>;

function normEmail(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim().toLowerCase();
  return t || null;
}

function normName(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim().replace(/\s+/g, " ");
  return t || null;
}

function parseAmount(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,\s]/g, "");
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalizeDate(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}

async function recomputeDonorStats(donorId: number) {
  const donations = await db.select().from(donationsTable).where(eq(donationsTable.donorId, donorId));
  const total = donations.reduce((sum, d) => sum + parseFloat(d.amount as string), 0);
  const avg = donations.length > 0 ? total / donations.length : 0;
  const sorted = [...donations].sort((a, b) => a.date.localeCompare(b.date));
  let donorCategory = "one-time";
  if (donations.length >= 5) donorCategory = "recurring";
  else if (donations.length >= 2) donorCategory = "seasonal";
  if (total >= 5000) donorCategory = "major";
  const lastDate = sorted[sorted.length - 1]?.date;
  if (lastDate && new Date(lastDate) < new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)) {
    donorCategory = "lapsed";
  }
  await db.update(donorsTable).set({
    totalDonated: String(total),
    averageDonation: String(avg),
    donationCount: donations.length,
    firstDonationDate: sorted[0]?.date ?? null,
    lastDonationDate: lastDate ?? null,
    donorCategory,
  }).where(eq(donorsTable.id, donorId));
}

router.post("/import/ai-commit", async (req: Request, res: Response) => {
  const body = req.body as { rows?: AIRow[] };
  if (!Array.isArray(body.rows)) {
    res.status(400).json({ error: "rows must be an array" });
    return;
  }
  if (body.rows.length > MAX_AI_COMMIT_ROWS) {
    res.status(413).json({ error: `Too many rows. Max ${MAX_AI_COMMIT_ROWS}; received ${body.rows.length}.` });
    return;
  }

  const results: Array<{
    index: number;
    status: "imported" | "skipped" | "failed";
    donorId: number | null;
    donationId: number | null;
    reason: string | null;
  }> = [];
  const affectedDonors = new Set<number>();

  for (let i = 0; i < body.rows.length; i++) {
    const row = body.rows[i];
    try {
      const name = normName(row.name);
      if (!name) {
        results.push({ index: i, status: "failed", donorId: null, donationId: null, reason: "Missing donor name" });
        continue;
      }
      const email = normEmail(row.email);

      const result = await db.transaction(async (tx) => {
        // Resolve or create donor: prefer email match, fall back to case-insensitive name match.
        let donor: { id: number } | null = null;
        if (email) {
          const m = await tx.select().from(donorsTable).where(sql`lower(${donorsTable.email}) = ${email}`);
          donor = m[0] ?? null;
        }
        if (!donor) {
          const m = await tx.select().from(donorsTable).where(sql`lower(${donorsTable.name}) = ${name.toLowerCase()}`);
          donor = m[0] ?? null;
        }

        if (!donor) {
          const [created] = await tx.insert(donorsTable).values({
            name,
            email,
            phone: typeof row.phone === "string" && row.phone.trim() ? row.phone.trim() : null,
            location: typeof row.location === "string" && row.location.trim() ? row.location.trim() : null,
            donorCategory: "one-time",
            notes: typeof row.notes === "string" && row.notes.trim() ? row.notes.trim() : null,
          }).returning();
          donor = created;
        }

        // Create the donation if amount + date are present.
        const amount = parseAmount(row.amount);
        // If the source spreadsheet had no date column, default to today so the donation is still recorded.
        const today = new Date().toISOString().split("T")[0];
        const date = normalizeDate(row.date) ?? (amount != null && amount > 0 ? today : null);
        let donationId: number | null = null;
        if (amount != null && amount > 0 && date) {
          // Build notes combining the AI notes + payment method (since donations table has no paymentMethod column).
          const noteParts: string[] = [];
          if (typeof row.paymentMethod === "string" && row.paymentMethod.trim()) {
            noteParts.push(`Payment: ${row.paymentMethod.trim()}`);
          }
          if (typeof row.notes === "string" && row.notes.trim()) {
            noteParts.push(row.notes.trim());
          }
          const [d] = await tx.insert(donationsTable).values({
            donorId: donor.id,
            eventId: null,
            date,
            amount: String(amount),
            cause: typeof row.cause === "string" && row.cause.trim() ? row.cause.trim() : null,
            campaign: typeof row.campaign === "string" && row.campaign.trim() ? row.campaign.trim() : null,
            season: typeof row.season === "string" && row.season.trim() ? row.season.trim() : null,
            donationType: typeof row.donationType === "string" && row.donationType.trim() ? row.donationType.trim() : "one-time",
            notes: noteParts.length ? noteParts.join(" | ") : null,
          }).returning();
          donationId = d.id;
          affectedDonors.add(donor.id);
        }

        return { donorId: donor.id, donationId };
      });

      results.push({
        index: i,
        status: result.donationId != null || result.donorId != null ? "imported" : "skipped",
        donorId: result.donorId,
        donationId: result.donationId,
        reason: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      results.push({ index: i, status: "failed", donorId: null, donationId: null, reason: msg });
    }
  }

  for (const donorId of affectedDonors) {
    try {
      await recomputeDonorStats(donorId);
    } catch (err) {
      req.log.error({ err, donorId }, "Failed to recompute donor stats");
    }
  }

  const summary = {
    total: body.rows.length,
    imported: results.filter(r => r.status === "imported").length,
    skipped: results.filter(r => r.status === "skipped").length,
    failed: results.filter(r => r.status === "failed").length,
    donorsAffected: affectedDonors.size,
  };

  res.json({ summary, results });
});

export default router;
