import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const frfRecordsTable = pgTable("frf_records", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull().unique(),
  cashAmount: numeric("cash_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  checkAmount: numeric("check_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  mailedCheckAmount: numeric("mailed_check_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  mailedReceiptAmount: numeric("mailed_receipt_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  onlineAmount: numeric("online_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  otherAmount: numeric("other_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 12, scale: 2 }).notNull().default("0"),
  submittedBy: text("submitted_by"),
  submittedDate: text("submitted_date"),
  reconciliationStatus: text("reconciliation_status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFRFRecordSchema = createInsertSchema(frfRecordsTable).omit({ id: true, createdAt: true });
export type InsertFRFRecord = z.infer<typeof insertFRFRecordSchema>;
export type FRFRecord = typeof frfRecordsTable.$inferSelect;
