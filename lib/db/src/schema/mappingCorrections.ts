import { pgTable, text, serial, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";

export const mappingCorrectionsTable = pgTable(
  "mapping_corrections",
  {
    id: serial("id").primaryKey(),
    headerNorm: text("header_norm").notNull(),
    entity: text("entity").notNull(),
    field: text("field").notNull(),
    useCount: integer("use_count").notNull().default(1),
    lastUsed: timestamp("last_used", { withTimezone: true }).notNull().defaultNow(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("mapping_corrections_unique").on(t.headerNorm, t.entity, t.field)],
);

export type MappingCorrection = typeof mappingCorrectionsTable.$inferSelect;
