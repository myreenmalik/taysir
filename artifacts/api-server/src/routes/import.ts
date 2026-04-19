import { Router, type IRouter } from "express";
import { eq, and, sql } from "drizzle-orm";
import { db, eventsTable, donorsTable, donationsTable, revenueEntriesTable, logisticsTasksTable, followUpTasksTable, attendeesTable } from "@workspace/db";
import { recomputeDonorStats } from "../lib/donorStats";

const MAX_IMPORT_ROWS = 5000;

const router: IRouter = Router();

type ImportRowResult = {
  index: number;
  status: "created" | "updated" | "skipped" | "failed";
  reason: string | null;
  id: number | null;
};

const ALLOWED_DATA_TYPES = ["donors", "donations", "events", "revenue", "logistics", "followups"] as const;
type DataType = typeof ALLOWED_DATA_TYPES[number];
const ALLOWED_STRATEGIES = ["skip", "update", "create"] as const;
type DuplicateStrategy = typeof ALLOWED_STRATEGIES[number];

function parseImportBody(body: unknown): { dataType: DataType; rows: Record<string, unknown>[]; duplicateStrategy: DuplicateStrategy } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Body must be an object" };
  const b = body as Record<string, unknown>;
  if (!ALLOWED_DATA_TYPES.includes(b.dataType as DataType)) {
    return { error: `dataType must be one of: ${ALLOWED_DATA_TYPES.join(", ")}` };
  }
  if (!Array.isArray(b.rows)) return { error: "rows must be an array" };
  const strategy = (b.duplicateStrategy as DuplicateStrategy) ?? "skip";
  if (!ALLOWED_STRATEGIES.includes(strategy)) {
    return { error: `duplicateStrategy must be one of: ${ALLOWED_STRATEGIES.join(", ")}` };
  }
  return {
    dataType: b.dataType as DataType,
    rows: b.rows as Record<string, unknown>[],
    duplicateStrategy: strategy,
  };
}

function isValidDate(s: unknown): boolean {
  if (typeof s !== "string" || !s.trim()) return false;
  const d = new Date(s);
  return !Number.isNaN(d.getTime());
}

function normalizeDate(s: unknown): string | null {
  if (!isValidDate(s)) return null;
  const d = new Date(s as string);
  return d.toISOString().split("T")[0];
}

function parseAmount(v: unknown): number | null {
  if (typeof v === "number" && !Number.isNaN(v)) return v;
  if (typeof v === "string") {
    const cleaned = v.replace(/[$,\s]/g, "");
    // Strict numeric pattern: optional minus, digits, optional decimal
    if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
    const n = parseFloat(cleaned);
    if (!Number.isNaN(n)) return n;
  }
  return null;
}

function normalizeEmail(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const t = s.trim().toLowerCase();
  if (!t) return null;
  return t;
}

router.post("/import", async (req, res): Promise<void> => {
  const parsed = parseImportBody(req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }

  const { dataType, rows, duplicateStrategy } = parsed;

  if (rows.length > MAX_IMPORT_ROWS) {
    res.status(413).json({ error: `Too many rows. Max ${MAX_IMPORT_ROWS} per import; received ${rows.length}.` });
    return;
  }

  const results: ImportRowResult[] = [];
  const affectedDonors = new Set<number>();

  // Sentinel error used to roll back a row's transaction with a known reason.
  class RowFailure extends Error {
    public reason: string;
    constructor(reason: string) { super(reason); this.reason = reason; }
  }

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    // Use the caller-provided source row index (original spreadsheet row number)
    // when present, otherwise fall back to the position in the submitted array.
    const idx = typeof row.__sourceRowIndex === "number" ? row.__sourceRowIndex : i;
    try {
      // Each row is processed in its own transaction so that a mid-row failure
      // is rolled back and only that row is marked failed; previously imported
      // rows remain.
      const rowResult: ImportRowResult = await db.transaction(async (tx) => {
        if (dataType === "donors") {
          if (!row.name || typeof row.name !== "string" || !row.name.trim()) throw new RowFailure("Missing required field: name");
          let existing = null;
          const normEmail = normalizeEmail(row.email);
          if (normEmail) {
            const matches = await tx.select().from(donorsTable).where(sql`lower(${donorsTable.email}) = ${normEmail}`);
            existing = matches[0] ?? null;
          }
          if (existing) {
            if (duplicateStrategy === "skip") {
              return { index: idx, status: "skipped", reason: `Duplicate (matched by email: ${normEmail})`, id: existing.id };
            }
            if (duplicateStrategy === "update") {
              const updateData: Record<string, unknown> = { name: row.name.trim() };
              if (row.phone) updateData.phone = String(row.phone);
              if (row.location) updateData.location = String(row.location);
              if (row.donorCategory) updateData.donorCategory = String(row.donorCategory);
              if (row.donorPersonalityType) updateData.donorPersonalityType = String(row.donorPersonalityType);
              if (row.preferredContactFrequency) updateData.preferredContactFrequency = String(row.preferredContactFrequency);
              if (row.notes) updateData.notes = String(row.notes);
              await tx.update(donorsTable).set(updateData).where(eq(donorsTable.id, existing.id));
              return { index: idx, status: "updated", reason: null, id: existing.id };
            }
          }
          const [created] = await tx.insert(donorsTable).values({
            name: row.name.trim(),
            email: normEmail,
            phone: row.phone ? String(row.phone) : null,
            location: row.location ? String(row.location) : null,
            donorCategory: row.donorCategory ? String(row.donorCategory) : "one-time",
            donorPersonalityType: row.donorPersonalityType ? String(row.donorPersonalityType) : null,
            preferredContactFrequency: row.preferredContactFrequency ? String(row.preferredContactFrequency) : null,
            notes: row.notes ? String(row.notes) : null,
          }).returning();
          return { index: idx, status: "created", reason: null, id: created.id };

        } else if (dataType === "events") {
          if (!row.name || typeof row.name !== "string" || !row.name.trim()) throw new RowFailure("Missing required field: name");
          const date = normalizeDate(row.date);
          if (!date) throw new RowFailure("Missing or invalid date");
          if (!row.location || typeof row.location !== "string" || !row.location.trim()) throw new RowFailure("Missing required field: location");
          if (!row.eventType || typeof row.eventType !== "string" || !row.eventType.trim()) throw new RowFailure("Missing required field: eventType");
          const normName = row.name.trim().toLowerCase();
          const matches = await tx.select().from(eventsTable).where(
            and(sql`lower(${eventsTable.name}) = ${normName}`, eq(eventsTable.date, date))
          );
          const existing = matches[0] ?? null;
          if (existing) {
            if (duplicateStrategy === "skip") {
              return { index: idx, status: "skipped", reason: `Duplicate (matched by name+date)`, id: existing.id };
            }
            if (duplicateStrategy === "update") {
              const updateData: Record<string, unknown> = { location: row.location.trim(), eventType: row.eventType.trim() };
              if (row.masjidPartner) updateData.masjidPartner = String(row.masjidPartner);
              if (row.campaign) updateData.campaign = String(row.campaign);
              if (row.organizer) updateData.organizer = String(row.organizer);
              if (row.status) updateData.status = String(row.status);
              if (row.estimatedAttendees != null) {
                const n = parseAmount(row.estimatedAttendees);
                if (n != null) updateData.estimatedAttendees = Math.round(n);
              }
              if (row.actualAttendees != null) {
                const n = parseAmount(row.actualAttendees);
                if (n != null) updateData.actualAttendees = Math.round(n);
              }
              if (row.notes) updateData.notes = String(row.notes);
              await tx.update(eventsTable).set(updateData).where(eq(eventsTable.id, existing.id));
              return { index: idx, status: "updated", reason: null, id: existing.id };
            }
          }
          const estAttn = row.estimatedAttendees != null ? parseAmount(row.estimatedAttendees) : null;
          const actAttn = row.actualAttendees != null ? parseAmount(row.actualAttendees) : null;
          const [created] = await tx.insert(eventsTable).values({
            name: row.name.trim(),
            date,
            location: row.location.trim(),
            masjidPartner: row.masjidPartner ? String(row.masjidPartner) : null,
            eventType: row.eventType.trim(),
            campaign: row.campaign ? String(row.campaign) : null,
            organizer: row.organizer ? String(row.organizer) : null,
            status: row.status ? String(row.status) : "planned",
            estimatedAttendees: estAttn != null ? Math.round(estAttn) : null,
            actualAttendees: actAttn != null ? Math.round(actAttn) : null,
            notes: row.notes ? String(row.notes) : null,
          }).returning();
          return { index: idx, status: "created", reason: null, id: created.id };

        } else if (dataType === "donations") {
          const donorId = parseAmount(row.donorId);
          if (donorId == null || !Number.isInteger(donorId)) throw new RowFailure("Missing or invalid donorId");
          const donor = await tx.select().from(donorsTable).where(eq(donorsTable.id, donorId));
          if (!donor[0]) throw new RowFailure(`Donor #${donorId} not found`);
          const amount = parseAmount(row.amount);
          if (amount == null || amount <= 0) throw new RowFailure("Missing or invalid amount");
          const date = normalizeDate(row.date);
          if (!date) throw new RowFailure("Missing or invalid date");
          let eventId: number | null = null;
          if (row.eventId != null && row.eventId !== "") {
            const n = parseAmount(row.eventId);
            if (n != null && Number.isInteger(n)) {
              const ev = await tx.select().from(eventsTable).where(eq(eventsTable.id, n));
              if (!ev[0]) throw new RowFailure(`Event #${n} not found`);
              eventId = n;
            }
          }
          const [created] = await tx.insert(donationsTable).values({
            donorId,
            eventId,
            date,
            amount: String(amount),
            cause: row.cause ? String(row.cause) : null,
            campaign: row.campaign ? String(row.campaign) : null,
            season: row.season ? String(row.season) : null,
            donationType: row.donationType ? String(row.donationType) : "one-time",
            notes: row.notes ? String(row.notes) : null,
          }).returning();
          affectedDonors.add(donorId);
          return { index: idx, status: "created", reason: null, id: created.id };

        } else if (dataType === "revenue") {
          const eventId = parseAmount(row.eventId);
          if (eventId == null || !Number.isInteger(eventId)) throw new RowFailure("Missing or invalid eventId");
          const event = await tx.select().from(eventsTable).where(eq(eventsTable.id, eventId));
          if (!event[0]) throw new RowFailure(`Event #${eventId} not found`);
          const amount = parseAmount(row.amount);
          if (amount == null || amount <= 0) throw new RowFailure("Missing or invalid amount");
          if (!row.paymentType || typeof row.paymentType !== "string") throw new RowFailure("Missing required field: paymentType");
          const qty = row.quantity != null ? parseAmount(row.quantity) : null;
          const [created] = await tx.insert(revenueEntriesTable).values({
            eventId,
            paymentType: String(row.paymentType).trim(),
            amount: String(amount),
            quantity: qty != null ? Math.round(qty) : null,
            receivedDate: normalizeDate(row.receivedDate),
            notes: row.notes ? String(row.notes) : null,
            enteredBy: row.enteredBy ? String(row.enteredBy) : null,
          }).returning();
          return { index: idx, status: "created", reason: null, id: created.id };

        } else if (dataType === "logistics") {
          const eventId = parseAmount(row.eventId);
          if (eventId == null || !Number.isInteger(eventId)) throw new RowFailure("Missing or invalid eventId");
          const event = await tx.select().from(eventsTable).where(eq(eventsTable.id, eventId));
          if (!event[0]) throw new RowFailure(`Event #${eventId} not found`);
          if (!row.taskName || typeof row.taskName !== "string" || !row.taskName.trim()) throw new RowFailure("Missing required field: taskName");
          const [created] = await tx.insert(logisticsTasksTable).values({
            eventId,
            taskName: row.taskName.trim(),
            assignedTo: row.assignedTo ? String(row.assignedTo) : null,
            dueDate: normalizeDate(row.dueDate),
            status: row.status ? String(row.status) : "pending",
            notes: row.notes ? String(row.notes) : null,
          }).returning();
          return { index: idx, status: "created", reason: null, id: created.id };

        } else {
          // followups
          if (!row.taskType || typeof row.taskType !== "string" || !row.taskType.trim()) throw new RowFailure("Missing required field: taskType");
          if (!row.recommendedAction || typeof row.recommendedAction !== "string" || !row.recommendedAction.trim()) throw new RowFailure("Missing required field: recommendedAction");
          let eventId: number | null = null;
          let donorId: number | null = null;
          let attendeeId: number | null = null;
          if (row.eventId != null && row.eventId !== "") {
            const n = parseAmount(row.eventId);
            if (n != null && Number.isInteger(n)) {
              const ev = await tx.select().from(eventsTable).where(eq(eventsTable.id, n));
              if (!ev[0]) throw new RowFailure(`Event #${n} not found`);
              eventId = n;
            }
          }
          if (row.donorId != null && row.donorId !== "") {
            const n = parseAmount(row.donorId);
            if (n != null && Number.isInteger(n)) {
              const d = await tx.select().from(donorsTable).where(eq(donorsTable.id, n));
              if (!d[0]) throw new RowFailure(`Donor #${n} not found`);
              donorId = n;
            }
          }
          if (row.attendeeId != null && row.attendeeId !== "") {
            const n = parseAmount(row.attendeeId);
            if (n != null && Number.isInteger(n)) {
              const a = await tx.select().from(attendeesTable).where(eq(attendeesTable.id, n));
              if (!a[0]) throw new RowFailure(`Attendee #${n} not found`);
              attendeeId = n;
            }
          }
          const [created] = await tx.insert(followUpTasksTable).values({
            eventId,
            attendeeId,
            donorId,
            taskType: row.taskType.trim(),
            recommendedAction: row.recommendedAction.trim(),
            status: row.status ? String(row.status) : "not-started",
            dueDate: normalizeDate(row.dueDate),
            notes: row.notes ? String(row.notes) : null,
          }).returning();
          return { index: idx, status: "created", reason: null, id: created.id };
        }
      });
      results.push(rowResult);
    } catch (err) {
      const reason = err instanceof RowFailure ? err.reason : (err instanceof Error ? err.message : "Unknown error");
      results.push({ index: idx, status: "failed", reason, id: null });
    }
  }

  // Recompute donor stats for any donors that had donations imported
  for (const donorId of affectedDonors) {
    try {
      await recomputeDonorStats(donorId);
    } catch (err) {
      req.log.error({ err, donorId }, "Failed to recompute donor stats");
    }
  }

  const summary = {
    total: rows.length,
    created: results.filter(r => r.status === "created").length,
    updated: results.filter(r => r.status === "updated").length,
    skipped: results.filter(r => r.status === "skipped").length,
    failed: results.filter(r => r.status === "failed").length,
  };

  res.json({ summary, results });
});

export default router;
