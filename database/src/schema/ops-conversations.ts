import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { opsUsersTable } from "./ops-users";

export const opsConversationsTable = pgTable("ops_conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => opsUsersTable.id, { onDelete: "cascade" }),
  title: text("title").default("Nouvelle conversation"),
  summary: text("summary"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OpsConversation = typeof opsConversationsTable.$inferSelect;
export type InsertOpsConversation = typeof opsConversationsTable.$inferInsert;
