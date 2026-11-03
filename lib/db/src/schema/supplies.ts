import {
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { productsTable } from "./products";

export const suppliesTable = pgTable(
  "nasaem_supplies",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    supplierName: text("supplier_name").notNull(),
    reference: text("reference"),
    total: numeric("total", {
      precision: 12,
      scale: 2,
      mode: "number",
    }).notNull(),
    amountPaid: numeric("amount_paid", {
      precision: 12,
      scale: 2,
      mode: "number",
    }),
    notes: text("notes"),
    actorUserId: text("actor_user_id"),
    actorName: text("actor_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("nasaem_supplies_created_at_idx").on(table.createdAt)],
);

export const supplyItemsTable = pgTable("nasaem_supply_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  supplyId: uuid("supply_id")
    .notNull()
    .references(() => suppliesTable.id, { onDelete: "cascade" }),
  productId: uuid("product_id")
    .notNull()
    .references(() => productsTable.id, { onDelete: "restrict" }),
  productName: text("product_name").notNull(),
  quantity: numeric("quantity", {
    precision: 14,
    scale: 3,
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

export const stockAdjustmentsTable = pgTable(
  "nasaem_stock_adjustments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    productId: uuid("product_id")
      .notNull()
      .references(() => productsTable.id, { onDelete: "restrict" }),
    productName: text("product_name").notNull(),
    delta: numeric("delta", {
      precision: 14,
      scale: 3,
      mode: "number",
    }).notNull(),
    reason: text("reason").notNull(),
    actorUserId: text("actor_user_id"),
    actorName: text("actor_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("nasaem_stock_adjustments_created_at_idx").on(table.createdAt),
  ],
);
