import { pgTable, text, serial, timestamp, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const accountTypeEnum = pgEnum("account_type", ["cash", "bank", "mobile_money"]);

export const accountsTable = pgTable("accounts", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => usersTable.id).notNull(),
  name: text("name").notNull(),
  type: accountTypeEnum("type").notNull(),
  balance: numeric("balance", { precision: 15, scale: 2 }).notNull().default("0"),
  currency: text("currency").notNull().default("FCFA"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertAccountSchema = createInsertSchema(accountsTable).omit({ id: true, createdAt: true });
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Account = typeof accountsTable.$inferSelect;
