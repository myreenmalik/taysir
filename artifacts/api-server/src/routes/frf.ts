import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, frfRecordsTable, revenueEntriesTable } from "@workspace/db";
import {
  GetFRFRecordParams,
  CreateFRFRecordParams,
  CreateFRFRecordBody,
  UpdateFRFRecordParams,
  UpdateFRFRecordBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

function serializeFRF(frf: typeof frfRecordsTable.$inferSelect) {
  return {
    ...frf,
    cashAmount: parseFloat(frf.cashAmount as string),
    checkAmount: parseFloat(frf.checkAmount as string),
    mailedCheckAmount: parseFloat(frf.mailedCheckAmount as string),
    mailedReceiptAmount: parseFloat(frf.mailedReceiptAmount as string),
    onlineAmount: parseFloat(frf.onlineAmount as string),
    otherAmount: parseFloat(frf.otherAmount as string),
    totalAmount: parseFloat(frf.totalAmount as string),
    createdAt: frf.createdAt.toISOString(),
  };
}

router.get("/events/:eventId/frf", async (req, res): Promise<void> => {
  const params = GetFRFRecordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [frf] = await db.select().from(frfRecordsTable).where(eq(frfRecordsTable.eventId, params.data.eventId));
  if (!frf) {
    res.status(404).json({ error: "FRF record not found" });
    return;
  }

  res.json(serializeFRF(frf));
});

router.post("/events/:eventId/frf", async (req, res): Promise<void> => {
  const params = CreateFRFRecordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = CreateFRFRecordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const cash = parsed.data.cashAmount ?? 0;
  const check = parsed.data.checkAmount ?? 0;
  const mailedCheck = parsed.data.mailedCheckAmount ?? 0;
  const mailedReceipt = parsed.data.mailedReceiptAmount ?? 0;
  const online = parsed.data.onlineAmount ?? 0;
  const other = parsed.data.otherAmount ?? 0;
  const total = cash + check + mailedCheck + mailedReceipt + online + other;

  // Auto-reconcile against revenue entries
  const revenueEntries = await db.select().from(revenueEntriesTable).where(eq(revenueEntriesTable.eventId, params.data.eventId));
  const revenueTotal = revenueEntries.reduce((sum, r) => sum + parseFloat(r.amount as string), 0);
  let reconciliationStatus = parsed.data.reconciliationStatus ?? "pending";
  if (Math.abs(total - revenueTotal) < 0.01) {
    reconciliationStatus = "matched";
  } else if (total !== 0) {
    reconciliationStatus = "mismatch";
  }

  const [frf] = await db.insert(frfRecordsTable).values({
    eventId: params.data.eventId,
    cashAmount: String(cash),
    checkAmount: String(check),
    mailedCheckAmount: String(mailedCheck),
    mailedReceiptAmount: String(mailedReceipt),
    onlineAmount: String(online),
    otherAmount: String(other),
    totalAmount: String(total),
    submittedBy: parsed.data.submittedBy ?? null,
    submittedDate: parsed.data.submittedDate ?? null,
    reconciliationStatus,
    notes: parsed.data.notes ?? null,
  }).returning();

  res.status(201).json(serializeFRF(frf));
});

router.patch("/frf/:id", async (req, res): Promise<void> => {
  const params = UpdateFRFRecordParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const parsed = UpdateFRFRecordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(frfRecordsTable).where(eq(frfRecordsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "FRF record not found" });
    return;
  }

  const updateData: Record<string, unknown> = {};
  const cash = parsed.data.cashAmount !== undefined ? parsed.data.cashAmount : parseFloat(existing.cashAmount as string);
  const check = parsed.data.checkAmount !== undefined ? parsed.data.checkAmount : parseFloat(existing.checkAmount as string);
  const mailedCheck = parsed.data.mailedCheckAmount !== undefined ? parsed.data.mailedCheckAmount : parseFloat(existing.mailedCheckAmount as string);
  const mailedReceipt = parsed.data.mailedReceiptAmount !== undefined ? parsed.data.mailedReceiptAmount : parseFloat(existing.mailedReceiptAmount as string);
  const online = parsed.data.onlineAmount !== undefined ? parsed.data.onlineAmount : parseFloat(existing.onlineAmount as string);
  const other = parsed.data.otherAmount !== undefined ? parsed.data.otherAmount : parseFloat(existing.otherAmount as string);
  const total = cash + check + mailedCheck + mailedReceipt + online + other;

  updateData.cashAmount = String(cash);
  updateData.checkAmount = String(check);
  updateData.mailedCheckAmount = String(mailedCheck);
  updateData.mailedReceiptAmount = String(mailedReceipt);
  updateData.onlineAmount = String(online);
  updateData.otherAmount = String(other);
  updateData.totalAmount = String(total);

  // Re-reconcile
  const revenueEntries = await db.select().from(revenueEntriesTable).where(eq(revenueEntriesTable.eventId, existing.eventId));
  const revenueTotal = revenueEntries.reduce((sum, r) => sum + parseFloat(r.amount as string), 0);
  if (parsed.data.reconciliationStatus) {
    updateData.reconciliationStatus = parsed.data.reconciliationStatus;
  } else if (Math.abs(total - revenueTotal) < 0.01) {
    updateData.reconciliationStatus = "matched";
  } else if (total !== 0) {
    updateData.reconciliationStatus = "mismatch";
  }

  if ("submittedBy" in parsed.data) updateData.submittedBy = parsed.data.submittedBy;
  if ("submittedDate" in parsed.data) updateData.submittedDate = parsed.data.submittedDate;
  if ("notes" in parsed.data) updateData.notes = parsed.data.notes;

  const [frf] = await db.update(frfRecordsTable).set(updateData).where(eq(frfRecordsTable.id, params.data.id)).returning();
  res.json(serializeFRF(frf));
});

export default router;
