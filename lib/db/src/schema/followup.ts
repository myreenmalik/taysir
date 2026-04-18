import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const followUpTasksTable = pgTable("follow_up_tasks", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id"),
  attendeeId: integer("attendee_id"),
  donorId: integer("donor_id"),
  taskType: text("task_type").notNull(),
  recommendedAction: text("recommended_action").notNull(),
  status: text("status").notNull().default("not-started"),
  dueDate: text("due_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertFollowUpTaskSchema = createInsertSchema(followUpTasksTable).omit({ id: true, createdAt: true });
export type InsertFollowUpTask = z.infer<typeof insertFollowUpTaskSchema>;
export type FollowUpTask = typeof followUpTasksTable.$inferSelect;
