import { pgTable, text, serial, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const opsPlanEnum = pgEnum("ops_plan", ["starter", "pro", "executive"]);
export const opsRoleEnum = pgEnum("ops_role", ["user", "admin"]);

export const opsUsersTable = pgTable("ops_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name"),
  role: opsRoleEnum("role").notNull().default("user"),
  plan: opsPlanEnum("plan").notNull().default("starter"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  planExpiresAt: timestamp("plan_expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  lastSignedIn: timestamp("last_signed_in", { withTimezone: true }).notNull().defaultNow(),
});

export const insertOpsUserSchema = createInsertSchema(opsUsersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOpsUser = z.infer<typeof insertOpsUserSchema>;
export type OpsUser = typeof opsUsersTable.$inferSelect;
