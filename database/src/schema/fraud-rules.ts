import { pgTable, serial, text, numeric, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const fraudRulesTable = pgTable("fraud_rules", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => usersTable.id).notNull(),
  category: text("category").notNull(),
  maxAmount: numeric("max_amount", { precision: 15, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type FraudRule = typeof fraudRulesTable.$inferSelect;
