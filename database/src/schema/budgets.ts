import { pgTable, text, serial, timestamp, numeric, integer, pgEnum } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const budgetPeriodEnum = pgEnum("budget_period", ["monthly", "yearly"]);

export const budgetsTable = pgTable("budgets", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  category: text("category").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  period: budgetPeriodEnum("period").notNull().default("monthly"),
  year: integer("year").notNull(),
  month: integer("month"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Budget = typeof budgetsTable.$inferSelect;
