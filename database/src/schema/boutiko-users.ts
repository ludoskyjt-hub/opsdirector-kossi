import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const boutikoUsersTable = pgTable("boutiko_users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBoutikoUserSchema = createInsertSchema(boutikoUsersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBoutikoUser = z.infer<typeof insertBoutikoUserSchema>;
export type BoutikoUser = typeof boutikoUsersTable.$inferSelect;
