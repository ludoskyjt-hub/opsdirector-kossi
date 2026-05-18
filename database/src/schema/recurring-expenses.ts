import { pgTable, text, serial, timestamp, numeric, integer, boolean, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { accountsTable } from "./accounts";

export const recurringFrequencyEnum = pgEnum("recurring_frequency", ["daily", "weekly", "monthly", "yearly"]);

export const recurringExpensesTable = pgTable("recurring_expenses", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id).notNull(),
  accountId: integer("account_id").references(() => accountsTable.id),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  category: text("category").notNull(),
  frequency: recurringFrequencyEnum("frequency").notNull().default("monthly"),
  nextDueDate: timestamp("next_due_date", { withTimezone: true }).notNull(),
  lastGeneratedAt: timestamp("last_generated_at", { withTimezone: true }),
  active: boolean("active").notNull().default(true),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRecurringExpenseSchema = createInsertSchema(recurringExpensesTable).omit({ id: true, createdAt: true });
export type InsertRecurringExpense = z.infer<typeof insertRecurringExpenseSchema>;
export type RecurringExpense = typeof recurringExpensesTable.$inferSelect;
