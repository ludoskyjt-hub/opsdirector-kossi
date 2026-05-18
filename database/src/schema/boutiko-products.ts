import { pgTable, text, serial, timestamp, integer, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const boutikoProductsTable = pgTable("boutiko_products", {
  id: serial("id").primaryKey(),
  boutiqueId: integer("boutique_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  price: numeric("price", { precision: 14, scale: 2 }).notNull(),
  costPrice: numeric("cost_price", { precision: 14, scale: 2 }),
  stock: integer("stock").notNull().default(0),
  unit: text("unit"),
  category: text("category"),
  imageUrl: text("image_url"),
  barcode: text("barcode"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertBoutikoProductSchema = createInsertSchema(boutikoProductsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertBoutikoProduct = z.infer<typeof insertBoutikoProductSchema>;
export type BoutikoProduct = typeof boutikoProductsTable.$inferSelect;
