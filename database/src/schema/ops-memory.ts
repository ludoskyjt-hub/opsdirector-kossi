import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { opsUsersTable } from "./ops-users";

export const opsMemoryTypeEnum = pgEnum("ops_memory_type", [
  "fact", "preference", "project_context", "decision", "reminder_context", "synergy",
]);
export const opsMemoryImportanceEnum = pgEnum("ops_memory_importance", ["low", "medium", "high"]);

export const opsMemoryEntriesTable = pgTable("ops_memory_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => opsUsersTable.id, { onDelete: "cascade" }),
  type: opsMemoryTypeEnum("type").notNull(),
  content: text("content").notNull(),
  projectId: integer("project_id"),
  importance: opsMemoryImportanceEnum("importance").notNull().default("medium"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OpsMemoryEntry = typeof opsMemoryEntriesTable.$inferSelect;
export type InsertOpsMemoryEntry = typeof opsMemoryEntriesTable.$inferInsert;
