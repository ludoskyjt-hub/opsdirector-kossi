import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { opsUsersTable } from "./ops-users";

export const opsTaskStatusEnum = pgEnum("ops_task_status", ["todo", "in_progress", "done", "cancelled"]);
export const opsTaskPriorityEnum = pgEnum("ops_task_priority", ["low", "medium", "high", "critical"]);

export const opsTasksTable = pgTable("ops_tasks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => opsUsersTable.id, { onDelete: "cascade" }),
  projectId: integer("project_id"),
  title: text("title").notNull(),
  description: text("description"),
  status: opsTaskStatusEnum("status").notNull().default("todo"),
  priority: opsTaskPriorityEnum("priority").notNull().default("medium"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OpsTask = typeof opsTasksTable.$inferSelect;
export type InsertOpsTask = typeof opsTasksTable.$inferInsert;
