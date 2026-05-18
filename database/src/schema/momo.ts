import { pgTable, text, serial, timestamp, numeric, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { expensesTable } from "./expenses";

export const momoProviderEnum = pgEnum("momo_provider", ["mtn_momo", "moov_money", "orange_money"]);
export const momoTypeEnum = pgEnum("momo_type", ["debit", "credit"]);
export const momoStatusEnum = pgEnum("momo_status", ["pending", "processed", "ignored"]);

export const momoTransactionsTable = pgTable("momo_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  provider: momoProviderEnum("provider").notNull(),
  phone: text("phone").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  type: momoTypeEnum("type").notNull(),
  description: text("description").notNull(),
  reference: text("reference").notNull().unique(),
  status: momoStatusEnum("status").notNull().default("pending"),
  expenseId: integer("expense_id").references(() => expensesTable.id),
  rawPayload: text("raw_payload"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertMomoTransactionSchema = createInsertSchema(momoTransactionsTable).omit({ id: true, createdAt: true });
export type InsertMomoTransaction = z.infer<typeof insertMomoTransactionSchema>;
export type MomoTransaction = typeof momoTransactionsTable.$inferSelect;
