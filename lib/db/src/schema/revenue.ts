import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const revenueEntriesTable = pgTable("revenue_entries", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  paymentType: text("payment_type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  quantity: integer("quantity"),
  receivedDate: text("received_date"),
  notes: text("notes"),
  enteredBy: text("entered_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRevenueEntrySchema = createInsertSchema(revenueEntriesTable).omit({ id: true, createdAt: true });
export type InsertRevenueEntry = z.infer<typeof insertRevenueEntrySchema>;
export type RevenueEntry = typeof revenueEntriesTable.$inferSelect;
