import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const salesTable = pgTable(
  "nasaem_sales",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    invoiceNumber: text("invoice_number").notNull().unique(),
    subtotal: numeric("subtotal", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    discount: numeric("discount", {
      precision: 12,
      scale: 2,
      mode: "number",
    })
      .notNull()
      .default(0),
    total: numeric("total", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    estimatedProfit: numeric("estimated_profit", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    notes: text("notes"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    cancelledBy: text("cancelled_by"),
    cancellationReason: text("cancellation_reason"),
    actorUserId: text("actor_user_id"),
    actorName: text("actor_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("nasaem_sales_created_at_idx").on(table.createdAt)],
);

export const saleItemsTable = pgTable("nasaem_sale_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  saleId: uuid("sale_id")
    .notNull()
    .references(() => salesTable.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "restrict" }),
  productName: text("product_name").notNull(),
  quantity: numeric("quantity", {
    precision: 14,
    scale: 3,
    mode: "number",
  }).notNull(),
  unitPrice: numeric("unit_price", {
    precision: 12,
    scale: 2,
    mode: "number",
  }).notNull(),
  unitCost: numeric("unit_cost", {
    precision: 12,
    scale: 2,
    mode: "number",
  }).notNull(),
  lineTotal: numeric("line_total", {
    precision: 12,
    scale: 2,
    mode: "number",
  }).notNull(),
});
