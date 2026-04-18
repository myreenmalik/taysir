import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const logisticsTasksTable = pgTable("logistics_tasks", {
  id: serial("id").primaryKey(),
  eventId: integer("event_id").notNull(),
  taskName: text("task_name").notNull(),
  assignedTo: text("assigned_to"),
  dueDate: text("due_date"),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertLogisticsTaskSchema = createInsertSchema(logisticsTasksTable).omit({ id: true, createdAt: true });
export type InsertLogisticsTask = z.infer<typeof insertLogisticsTaskSchema>;
export type LogisticsTask = typeof logisticsTasksTable.$inferSelect;
