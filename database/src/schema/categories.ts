import { pgTable, serial, integer, varchar, boolean } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const categoriesTable = pgTable("categories", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 7 }).notNull().default("#6b7280"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
});

export type Category = typeof categoriesTable.$inferSelect;
