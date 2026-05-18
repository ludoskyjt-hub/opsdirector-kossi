import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { opsUsersTable } from "./ops-users";

export const opsReminderStatusEnum = pgEnum("ops_reminder_status", ["pending", "done", "snoozed"]);

export const opsRemindersTable = pgTable("ops_reminders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => opsUsersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  content: text("content"),
  dueAt: timestamp("due_at", { withTimezone: true }),
  status: opsReminderStatusEnum("status").notNull().default("pending"),
  projectId: integer("project_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OpsReminder = typeof opsRemindersTable.$inferSelect;
export type InsertOpsReminder = typeof opsRemindersTable.$inferInsert;
