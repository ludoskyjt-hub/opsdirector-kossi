import { pgTable, text, serial, timestamp, numeric, integer, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";
import { accountsTable } from "./accounts";
import { employeesTable } from "./employees";

export const expenseStatusEnum = pgEnum("expense_status", ["pending", "validated", "rejected", "synced"]);
export const dgiStatusEnum = pgEnum("dgi_status", ["not_submitted", "pending", "normalized", "failed"]);
export const riskLevelEnum = pgEnum("risk_level", ["none", "low", "medium", "high"]);

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => usersTable.id).notNull(),
  accountId: integer("account_id").references(() => accountsTable.id),
  employeeId: integer("employee_id").references(() => employeesTable.id),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 15, scale: 2 }).notNull(),
  category: text("category").notNull(),
  status: expenseStatusEnum("status").notNull().default("pending"),
  dgiStatus: dgiStatusEnum("dgi_status").notNull().default("not_submitted"),
  dgiQrCode: text("dgi_qr_code"),
  dgiReference: text("dgi_reference"),
  receiptUrl: text("receipt_url"),
  notes: text("notes"),
  submittedBy: integer("submitted_by").references(() => usersTable.id, { onDelete: "set null" }),
  rejectionReason: text("rejection_reason"),
  riskLevel: riskLevelEnum("risk_level").notNull().default("none"),
  flagReason: text("flag_reason"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export type InsertExpense = z.infer<typeof insertExpenseSchema>;
export type Expense = typeof expensesTable.$inferSelect;
