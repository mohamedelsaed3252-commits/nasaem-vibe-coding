import {
  date,
  index,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { suppliesTable } from "./supplies";

export const debtsTable = pgTable(
  "nasaem_debts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    direction: text("direction").notNull(),
    partyType: text("party_type").notNull(),
    partyName: text("party_name").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    paidAmount: numeric("paid_amount", { precision: 12, scale: 2, mode: "number" }).notNull().default(0),
    notes: text("notes"),
    supplyId: uuid("supply_id").references(() => suppliesTable.id, { onDelete: "set null" }),
    actorUserId: text("actor_user_id"),
    actorName: text("actor_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("nasaem_debts_created_at_idx").on(table.createdAt),
    index("nasaem_debts_party_idx").on(table.partyType, table.partyName),
    uniqueIndex("nasaem_debts_supply_id_unique").on(table.supplyId),
  ],
);

export const debtPaymentsTable = pgTable(
  "nasaem_debt_payments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    debtId: uuid("debt_id").notNull().references(() => debtsTable.id, { onDelete: "cascade" }),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    notes: text("notes"),
    actorUserId: text("actor_user_id"),
    actorName: text("actor_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("nasaem_debt_payments_debt_idx").on(table.debtId, table.createdAt)],
);

export const operatingExpensesTable = pgTable(
  "nasaem_operating_expenses",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    category: text("category").notNull(),
    amount: numeric("amount", { precision: 12, scale: 2, mode: "number" }).notNull(),
    expenseDate: date("expense_date", { mode: "string" }).notNull(),
    notes: text("notes"),
    actorUserId: text("actor_user_id"),
    actorName: text("actor_name").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("nasaem_expenses_date_idx").on(table.expenseDate)],
);
