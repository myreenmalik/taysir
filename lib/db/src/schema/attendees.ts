import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const attendeesTable = pgTable("attendees", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  name: text("name").notNull(),
  email: text("email"),
  phone: text("phone"),
  attended: boolean("attended").notNull().default(true),
  donated: boolean("donated").notNull().default(false),
  donationAmount: numeric("donation_amount", { precision: 12, scale: 2 }),
  volunteerInterest: boolean("volunteer_interest").notNull().default(false),
  attendeeType: text("attendee_type").notNull().default("first-time"),
  engagementLevel: text("engagement_level"),
  notes: text("notes"),
  donorId: integer("donor_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAttendeeSchema = createInsertSchema(attendeesTable).omit({ id: true, createdAt: true });
export type InsertAttendee = z.infer<typeof insertAttendeeSchema>;
export type Attendee = typeof attendeesTable.$inferSelect;
