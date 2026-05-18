import { pgTable, serial, integer, numeric, pgEnum, boolean, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { employeesTable } from "./employees";

export const limitPeriodEnum = pgEnum("limit_period", ["daily", "weekly", "monthly"]);

export const employeeLimitsTable = pgTable("employee_limits", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull().references(() => employeesTable.id, { onDelete: "cascade" }),
  period: limitPeriodEnum("period").notNull().default("monthly"),
  maxAmount: numeric("max_amount", { precision: 14, scale: 2 }).notNull(),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type EmployeeLimit = typeof employeeLimitsTable.$inferSelect;
