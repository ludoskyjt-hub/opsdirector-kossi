import { pgTable, text, serial, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const mobileMoneyProviderEnum = pgEnum("mobile_money_provider", ["mtn_momo", "moov_money"]);

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  userId: serial("user_id").references(() => usersTable.id).notNull(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  role: text("role").notNull().default("employee"),
  mobileMoneyProvider: mobileMoneyProviderEnum("mobile_money_provider"),
  mobileMoneyNumber: text("mobile_money_number"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({ id: true, createdAt: true });
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
