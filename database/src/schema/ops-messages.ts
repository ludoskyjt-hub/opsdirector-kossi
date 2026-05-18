import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { opsUsersTable } from "./ops-users";
import { opsConversationsTable } from "./ops-conversations";

export const opsMessageRoleEnum = pgEnum("ops_message_role", ["user", "assistant", "system"]);

export const opsMessagesTable = pgTable("ops_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => opsConversationsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => opsUsersTable.id, { onDelete: "cascade" }),
  role: opsMessageRoleEnum("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type OpsMessage = typeof opsMessagesTable.$inferSelect;
export type InsertOpsMessage = typeof opsMessagesTable.$inferInsert;
