import { pgTable, text, serial, timestamp, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const boutikoClientsTable = pgTable("boutiko_clients", {
  id: serial("id").primaryKey(),
  boutiqueId: integer("boutique_id").notNull(),
  name: text("name").notNull(),
  phone: text("phone"),
  email: text("email"),
  address: text("address"),
  totalPurchases: numeric("total_purchases", { precision: 14, scale: 2 }).notNull().default("0"),
  lastPurchaseAt: timestamp("last_purchase_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBoutikoClientSchema = createInsertSchema(boutikoClientsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBoutikoClient = z.infer<typeof insertBoutikoClientSchema>;
export type BoutikoClient = typeof boutikoClientsTable.$inferSelect;
