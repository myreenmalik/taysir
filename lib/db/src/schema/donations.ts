import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const donationsTable = pgTable("donations", {
  id: serial("id").primaryKey(),
  donorId: integer("donor_id").notNull(),
  eventId: integer("event_id"),
  date: text("date").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  cause: text("cause"),
  campaign: text("campaign"),
  season: text("season"),
  donationType: text("donation_type").notNull().default("one-time"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertDonationSchema = createInsertSchema(donationsTable).omit({ id: true, createdAt: true });
export type InsertDonation = z.infer<typeof insertDonationSchema>;
export type Donation = typeof donationsTable.$inferSelect;
