import { Router, type IRouter, type Request, type Response } from "express";
import { eq, sql } from "drizzle-orm";
import { db, donorsTable, donationsTable, eventsTable, revenueEntriesTable, logisticsTasksTable, followUpTasksTable } from "@workspace/db";

const router: IRouter = Router();

const MAX_AI_COMMIT_ROWS = 10_000;

type AnyRow = Record<string, unknown>;
type DonorAction = { index: number; action: "create" | "merge" | "skip"; mergeWith?: number };

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
function parseInt0(v: unknown): number | null {
  if (typeof v === "number" && Number.isInteger(v)) return v;
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return parseInt(v.trim(), 10);
  return null;
}
function normalizeDate(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split("T")[0];
}
function trimOrNull(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t || null;
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
  const body = req.body as {
    donors?: AnyRow[];
    events?: AnyRow[];
    revenue?: AnyRow[];
    logistics?: AnyRow[];
    followups?: AnyRow[];
    donorActions?: DonorAction[];
  };
  const donors = Array.isArray(body.donors) ? body.donors : [];
  const events = Array.isArray(body.events) ? body.events : [];
  const revenue = Array.isArray(body.revenue) ? body.revenue : [];
  const logistics = Array.isArray(body.logistics) ? body.logistics : [];
  const followups = Array.isArray(body.followups) ? body.followups : [];
  const totalRowCount = donors.length + events.length + revenue.length + logistics.length + followups.length;
  if (totalRowCount > MAX_AI_COMMIT_ROWS) {
    res.status(413).json({ error: `Too many rows (${totalRowCount}). Max ${MAX_AI_COMMIT_ROWS}.` });
    return;
  }
  const actionByIndex = new Map<number, DonorAction>();
  for (const a of body.donorActions ?? []) {
    if (a && typeof a.index === "number") actionByIndex.set(a.index, a);
  }

  const donorResults: Array<{ index: number; status: "imported" | "merged" | "skipped" | "failed"; donorId: number | null; donationId: number | null; reason: string | null }> = [];
  const eventResults: Array<{ index: number; status: "imported" | "failed"; eventId: number | null; reason: string | null }> = [];
  const revenueResults: Array<{ index: number; status: "imported" | "skipped" | "failed"; revenueId: number | null; reason: string | null }> = [];
  const logisticsResults: Array<{ index: number; status: "imported" | "skipped" | "failed"; taskId: number | null; reason: string | null }> = [];
  const followupResults: Array<{ index: number; status: "imported" | "failed"; taskId: number | null; reason: string | null }> = [];
  const affectedDonors = new Set<number>();

  // 1) EVENTS first (so revenue can match by name)
  const eventIdByName = new Map<string, number>();
  for (let i = 0; i < events.length; i++) {
    const row = events[i];
    try {
      const name = normName(row.name);
      const date = normalizeDate(row.date);
      const location = trimOrNull(row.location);
      const eventType = trimOrNull(row.eventType);
      if (!name || !date || !location || !eventType) {
        eventResults.push({ index: i, status: "failed", eventId: null, reason: "Missing required field (name/date/location/eventType)" });
        continue;
      }
      const [created] = await db.insert(eventsTable).values({
        name, date, location, eventType,
        campaign: trimOrNull(row.campaign),
        season: trimOrNull(row.season),
        status: "planned",
        notes: trimOrNull(row.notes),
      }).returning();
      eventIdByName.set(name.toLowerCase(), created.id);
      eventResults.push({ index: i, status: "imported", eventId: created.id, reason: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown";
      eventResults.push({ index: i, status: "failed", eventId: null, reason: msg });
    }
  }

  // 2) DONORS + DONATIONS
  for (let i = 0; i < donors.length; i++) {
    const row = donors[i];
    const action = actionByIndex.get(i) ?? { index: i, action: "create" as const };
    if (action.action === "skip") {
      donorResults.push({ index: i, status: "skipped", donorId: null, donationId: null, reason: "User chose to skip" });
      continue;
    }
    try {
      const name = normName(row.name);
      if (!name) {
        donorResults.push({ index: i, status: "failed", donorId: null, donationId: null, reason: "Missing donor name" });
        continue;
      }
      const email = normEmail(row.email);

      const result = await db.transaction(async (tx) => {
        let donor: { id: number } | null = null;
        let merged = false;

        if (action.action === "merge" && typeof action.mergeWith === "number") {
          const m = await tx.select().from(donorsTable).where(eq(donorsTable.id, action.mergeWith));
          if (m[0]) {
            donor = m[0];
            merged = true;
            // Optionally update missing fields on the existing donor
            const updates: Record<string, unknown> = {};
            if (!m[0].email && email) updates.email = email;
            if (Object.keys(updates).length > 0) {
              await tx.update(donorsTable).set(updates).where(eq(donorsTable.id, m[0].id));
            }
          }
        }

        // Note: when action.action === "create", we honor the user's intent and skip
        // auto-dedupe entirely — a new donor row is created even if a name/email match exists.
        // The duplicate preview UI surfaced any matches before the user confirmed.

        if (!donor) {
          const [created] = await tx.insert(donorsTable).values({
            name,
            email,
            phone: trimOrNull(row.phone),
            location: trimOrNull(row.location),
            donorCategory: "one-time",
            notes: trimOrNull(row.notes),
          }).returning();
          donor = created;
        }

        const amount = parseAmount(row.amount);
        const today = new Date().toISOString().split("T")[0];
        const date = normalizeDate(row.date) ?? (amount != null && amount > 0 ? today : null);
        let donationId: number | null = null;
        if (amount != null && amount > 0 && date) {
          const noteParts: string[] = [];
          const pm = trimOrNull(row.paymentMethod);
          if (pm) noteParts.push(`Payment: ${pm}`);
          const n = trimOrNull(row.notes);
          if (n) noteParts.push(n);
          const [d] = await tx.insert(donationsTable).values({
            donorId: donor.id,
            eventId: null,
            date,
            amount: String(amount),
            cause: trimOrNull(row.cause),
            campaign: trimOrNull(row.campaign),
            season: trimOrNull(row.season),
            donationType: trimOrNull(row.donationType) ?? "one-time",
            notes: noteParts.length ? noteParts.join(" | ") : null,
          }).returning();
          donationId = d.id;
          affectedDonors.add(donor.id);
        }

        return { donorId: donor.id, donationId, merged };
      });

      donorResults.push({
        index: i,
        status: result.merged ? "merged" : "imported",
        donorId: result.donorId,
        donationId: result.donationId,
        reason: null,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      donorResults.push({ index: i, status: "failed", donorId: null, donationId: null, reason: msg });
    }
  }

  // 3) REVENUE (link to events by name where possible)
  for (let i = 0; i < revenue.length; i++) {
    const row = revenue[i];
    try {
      const amount = parseAmount(row.amount);
      const paymentType = trimOrNull(row.paymentType);
      if (amount == null || !paymentType) {
        revenueResults.push({ index: i, status: "failed", revenueId: null, reason: "Missing required amount or paymentType" });
        continue;
      }
      const eventName = trimOrNull(row.eventName);
      let eventId: number | null = null;
      if (eventName) {
        eventId = eventIdByName.get(eventName.toLowerCase()) ?? null;
        if (eventId == null) {
          const m = await db.select({ id: eventsTable.id }).from(eventsTable).where(sql`lower(${eventsTable.name}) = ${eventName.toLowerCase()}`);
          eventId = m[0]?.id ?? null;
        }
      }
      if (eventId == null) {
        revenueResults.push({ index: i, status: "skipped", revenueId: null, reason: `No event matched "${eventName ?? ""}"` });
        continue;
      }
      const [created] = await db.insert(revenueEntriesTable).values({
        eventId,
        paymentType,
        amount: String(amount),
        quantity: parseInt0(row.quantity) ?? null,
        notes: trimOrNull(row.notes),
      }).returning();
      revenueResults.push({ index: i, status: "imported", revenueId: created.id, reason: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown";
      revenueResults.push({ index: i, status: "failed", revenueId: null, reason: msg });
    }
  }

  // 4) LOGISTICS (require linked event by name)
  for (let i = 0; i < logistics.length; i++) {
    const row = logistics[i];
    try {
      const taskName = trimOrNull(row.taskName);
      const eventName = trimOrNull(row.eventName);
      if (!taskName || !eventName) {
        logisticsResults.push({ index: i, status: "failed", taskId: null, reason: "Missing required taskName or eventName" });
        continue;
      }
      let eventId = eventIdByName.get(eventName.toLowerCase()) ?? null;
      if (eventId == null) {
        const m = await db.select({ id: eventsTable.id }).from(eventsTable).where(sql`lower(${eventsTable.name}) = ${eventName.toLowerCase()}`);
        eventId = m[0]?.id ?? null;
      }
      if (eventId == null) {
        logisticsResults.push({ index: i, status: "skipped", taskId: null, reason: `No event matched "${eventName}"` });
        continue;
      }
      const [created] = await db.insert(logisticsTasksTable).values({
        eventId,
        taskName,
        assignedTo: trimOrNull(row.assignedTo),
        dueDate: normalizeDate(row.dueDate),
        status: trimOrNull(row.status) ?? "pending",
        notes: trimOrNull(row.notes),
      }).returning();
      logisticsResults.push({ index: i, status: "imported", taskId: created.id, reason: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown";
      logisticsResults.push({ index: i, status: "failed", taskId: null, reason: msg });
    }
  }

  // 5) FOLLOWUPS (optionally link to event/donor by name)
  for (let i = 0; i < followups.length; i++) {
    const row = followups[i];
    try {
      const taskType = trimOrNull(row.taskType);
      const recommendedAction = trimOrNull(row.recommendedAction);
      if (!taskType || !recommendedAction) {
        followupResults.push({ index: i, status: "failed", taskId: null, reason: "Missing required taskType or recommendedAction" });
        continue;
      }
      const eventName = trimOrNull(row.eventName);
      let eventId: number | null = null;
      if (eventName) {
        eventId = eventIdByName.get(eventName.toLowerCase()) ?? null;
        if (eventId == null) {
          const m = await db.select({ id: eventsTable.id }).from(eventsTable).where(sql`lower(${eventsTable.name}) = ${eventName.toLowerCase()}`);
          eventId = m[0]?.id ?? null;
        }
      }
      const donorName = trimOrNull(row.donorName);
      let donorId: number | null = null;
      if (donorName) {
        const m = await db.select({ id: donorsTable.id }).from(donorsTable).where(sql`lower(${donorsTable.name}) = ${donorName.toLowerCase()}`);
        donorId = m[0]?.id ?? null;
      }
      const [created] = await db.insert(followUpTasksTable).values({
        eventId,
        attendeeId: null,
        donorId,
        taskType,
        recommendedAction,
        status: trimOrNull(row.status) ?? "not-started",
        dueDate: normalizeDate(row.dueDate),
        notes: trimOrNull(row.notes),
      }).returning();
      followupResults.push({ index: i, status: "imported", taskId: created.id, reason: null });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown";
      followupResults.push({ index: i, status: "failed", taskId: null, reason: msg });
    }
  }

  for (const donorId of affectedDonors) {
    try { await recomputeDonorStats(donorId); } catch (err) {
      req.log.error({ err, donorId }, "Failed to recompute donor stats");
    }
  }

  res.json({
    summary: {
      donorsImported: donorResults.filter(r => r.status === "imported").length,
      donorsMerged: donorResults.filter(r => r.status === "merged").length,
      donorsSkipped: donorResults.filter(r => r.status === "skipped").length,
      donorsFailed: donorResults.filter(r => r.status === "failed").length,
      eventsImported: eventResults.filter(r => r.status === "imported").length,
      eventsFailed: eventResults.filter(r => r.status === "failed").length,
      revenueImported: revenueResults.filter(r => r.status === "imported").length,
      revenueSkipped: revenueResults.filter(r => r.status === "skipped").length,
      revenueFailed: revenueResults.filter(r => r.status === "failed").length,
      logisticsImported: logisticsResults.filter(r => r.status === "imported").length,
      logisticsSkipped: logisticsResults.filter(r => r.status === "skipped").length,
      logisticsFailed: logisticsResults.filter(r => r.status === "failed").length,
      followupsImported: followupResults.filter(r => r.status === "imported").length,
      followupsFailed: followupResults.filter(r => r.status === "failed").length,
    },
    donorResults,
    eventResults,
    revenueResults,
    logisticsResults,
    followupResults,
  });
});

export default router;
