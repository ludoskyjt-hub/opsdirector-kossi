import { pgTable, text, serial, timestamp, integer, numeric, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const boutikoPaymentMethodEnum = pgEnum("boutiko_payment_method", ["cash", "mobile_money", "card", "credit"]);
export const boutikoSaleStatusEnum = pgEnum("boutiko_sale_status", ["completed", "pending", "cancelled"]);

export const boutikoSalesTable = pgTable("boutiko_sales", {
  id: serial("id").primaryKey(),
  boutiqueId: integer("boutique_id").notNull(),
  clientId: integer("client_id"),
  clientName: text("client_name"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull(),
  paymentMethod: boutikoPaymentMethodEnum("payment_method").notNull(),
  status: boutikoSaleStatusEnum("status").notNull().default("completed"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const boutikoSaleItemsTable = pgTable("boutiko_sale_items", {
  id: serial("id").primaryKey(),
  saleId: integer("sale_id").notNull(),
  productId: integer("product_id").notNull(),
  productName: text("product_name").notNull(),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  totalPrice: numeric("total_price", { precision: 14, scale: 2 }).notNull(),
});

export const insertBoutikoSaleSchema = createInsertSchema(boutikoSalesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBoutikoSaleItemSchema = createInsertSchema(boutikoSaleItemsTable).omit({ id: true });
export type InsertBoutikoSale = z.infer<typeof insertBoutikoSaleSchema>;
export type InsertBoutikoSaleItem = z.infer<typeof insertBoutikoSaleItemSchema>;
export type BoutikoSale = typeof boutikoSalesTable.$inferSelect;
export type BoutikoSaleItem = typeof boutikoSaleItemsTable.$inferSelect;
