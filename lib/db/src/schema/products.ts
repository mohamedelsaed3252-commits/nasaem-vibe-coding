import {
  boolean,
  integer,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const productsTable = pgTable(
  "nasaem_products",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: text("name").notNull(),
    sku: text("sku"),
    category: text("category").notNull().default("عام"),
    unit: text("unit").notNull().default("قطعة"),
    unitsPerCarton: integer("units_per_carton").notNull().default(1),
    purchasePrice: numeric("purchase_price", {
      precision: 12,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),
    sellingPrice: numeric("selling_price", {
      precision: 12,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),
    stock: numeric("stock", {
      precision: 14,
      scale: 3,
      mode: "number",
    })
      .notNull()
      .default(0),
    lowStockThreshold: numeric("low_stock_threshold", {
      precision: 14,
      scale: 3,
      mode: "number",
    })
      .notNull()
      .default(5),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [index("nasaem_products_name_idx").on(table.name)],
);

export const insertProductSchema = createInsertSchema(productsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Product = typeof productsTable.$inferSelect;
