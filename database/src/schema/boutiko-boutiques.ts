import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const boutikoBoutiquesTable = pgTable("boutiko_boutiques", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  currency: text("currency").notNull().default("XOF"),
  country: text("country"),
  logoUrl: text("logo_url"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBoutikoBoutiqueSchema = createInsertSchema(boutikoBoutiquesTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBoutikoBoutique = z.infer<typeof insertBoutikoBoutiqueSchema>;
export type BoutikoBoutique = typeof boutikoBoutiquesTable.$inferSelect;
