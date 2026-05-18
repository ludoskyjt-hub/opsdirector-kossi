import { pgTable, text, serial, timestamp, pgEnum, integer, boolean, type AnyPgColumn } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userRoleEnum = pgEnum("user_role", ["admin", "accountant", "employee"]);

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  companyName: text("company_name").notNull(),
  ifu: text("ifu").notNull(),
  phone: text("phone"),
  country: text("country").notNull().default("BJ"),
  role: userRoleEnum("role").notNull().default("admin"),
  companyId: integer("company_id").references((): AnyPgColumn => usersTable.id, { onDelete: "set null" }),
  emailNotificationsEnabled: boolean("email_notifications_enabled").notNull().default(true),
  defaultCurrency: text("default_currency").notNull().default("XOF"),
  dgiToken: text("dgi_token"),
  dgiSecret: text("dgi_secret"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
