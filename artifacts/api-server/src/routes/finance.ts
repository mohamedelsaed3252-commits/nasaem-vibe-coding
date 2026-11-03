import { Router, type IRouter } from "express";
import { and, desc, eq, gte, inArray, isNull, lt, sql } from "drizzle-orm";
import {
  CreateDebtBody,
  CreateDebtPaymentBody,
  CreateDebtPaymentParams,
  CreateDebtPaymentResponse,
  CreateDebtResponse,
  CreateExpenseBody,
  CreateExpenseResponse,
  GetMonthlyFinanceQueryParams,
  GetMonthlyFinanceResponse,
  ListDebtsResponse,
  ListExpensesQueryParams,
  ListExpensesResponse,
} from "@workspace/api-zod";
import {
  db,
  debtsTable,
  debtPaymentsTable,
  operatingExpensesTable,
  salesTable,
  saleItemsTable,
  staffTable,
  suppliesTable,
} from "@workspace/db";
import { requireAppRole } from "../middlewares/appAuth";

const router: IRouter = Router();
const requireManager = (
  req: Parameters<typeof requireAppRole>[1],
  res: Parameters<typeof requireAppRole>[2],
  next: Parameters<typeof requireAppRole>[3],
) => requireAppRole(["owner", "manager"], req, res, next);

function validMonth(value: string) {
  const [year, month] = value.split("-").map(Number);
  return year >= 2000 && year <= 2200 && month >= 1 && month <= 12;
}

function monthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);
  const from = `${month}-01`;
  const next = new Date(Date.UTC(year, monthNumber, 1));
  const until = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-01`;
  return { from, until };
}

async function loadDebt(id: string) {
  const [debt] = await db.select().from(debtsTable).where(eq(debtsTable.id, id)).limit(1);
  if (!debt) return null;
  const payments = await db.select().from(debtPaymentsTable)
    .where(eq(debtPaymentsTable.debtId, debt.id))
    .orderBy(desc(debtPaymentsTable.createdAt));
  return {
    ...debt,
    remaining: Number((debt.amount - debt.paidAmount).toFixed(2)),
    payments,
  };
}

router.get("/debts", async (_req, res): Promise<void> => {
  const debts = await db.select().from(debtsTable)
    .orderBy(desc(debtsTable.createdAt)).limit(500);
  const ids = debts.map((debt) => debt.id);
  const payments = ids.length
    ? await db.select().from(debtPaymentsTable)
      .where(inArray(debtPaymentsTable.debtId, ids))
      .orderBy(desc(debtPaymentsTable.createdAt))
    : [];
  const byDebt = new Map<string, typeof payments>();
  for (const payment of payments) {
    const rows = byDebt.get(payment.debtId) ?? [];
    rows.push(payment);
    byDebt.set(payment.debtId, rows);
  }
  res.json(ListDebtsResponse.parse(debts.map((debt) => ({
    ...debt,
    remaining: Number((debt.amount - debt.paidAmount).toFixed(2)),
    payments: byDebt.get(debt.id) ?? [],
  }))));
});

router.post("/debts", requireManager, async (req, res): Promise<void> => {
  const parsed = CreateDebtBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { amount, paidAmount = 0 } = parsed.data;
  if (paidAmount > amount) {
    res.status(400).json({ error: "المبلغ المدفوع لا يمكن أن يتجاوز أصل الدين" });
    return;
  }
  const actor = res.locals.currentStaff as typeof staffTable.$inferSelect;
  const debt = await db.transaction(async (tx) => {
    const [created] = await tx.insert(debtsTable).values({
      direction: parsed.data.direction,
      partyType: parsed.data.partyType,
      partyName: parsed.data.partyName.trim(),
      amount: Number(amount.toFixed(2)),
      paidAmount: Number(paidAmount.toFixed(2)),
      notes: parsed.data.notes?.trim() || null,
      actorUserId: actor.clerkUserId,
      actorName: actor.displayName,
    }).returning();
    if (paidAmount > 0) {
      await tx.insert(debtPaymentsTable).values({
        debtId: created.id,
        amount: Number(paidAmount.toFixed(2)),
        notes: "دفعة عند تسجيل الدين",
        actorUserId: actor.clerkUserId,
        actorName: actor.displayName,
      });
    }
    return created;
  });
  res.status(201).json(CreateDebtResponse.parse(await loadDebt(debt.id)));
});

router.post("/debts/:id/payments", requireManager, async (req, res): Promise<void> => {
  const params = CreateDebtPaymentParams.safeParse(req.params);
  const parsed = CreateDebtPaymentBody.safeParse(req.body);
  if (!params.success || !parsed.success) {
    res.status(400).json({ error: "بيانات سداد الدين غير صالحة" });
    return;
  }
  const actor = res.locals.currentStaff as typeof staffTable.$inferSelect;
  const outcome = await db.transaction(async (tx) => {
    const [debt] = await tx.select().from(debtsTable)
      .where(eq(debtsTable.id, params.data.id)).for("update").limit(1);
    if (!debt) return "missing" as const;
    const amount = Number(parsed.data.amount.toFixed(2));
    const remaining = Number((debt.amount - debt.paidAmount).toFixed(2));
    if (amount > remaining) return "overpaid" as const;
    await tx.insert(debtPaymentsTable).values({
      debtId: debt.id,
      amount,
      notes: parsed.data.notes?.trim() || null,
      actorUserId: actor.clerkUserId,
      actorName: actor.displayName,
    });
    const paidAmount = Number((debt.paidAmount + amount).toFixed(2));
    await tx.update(debtsTable).set({ paidAmount }).where(eq(debtsTable.id, debt.id));
    if (debt.supplyId) {
      const [supply] = await tx.select().from(suppliesTable)
        .where(eq(suppliesTable.id, debt.supplyId)).for("update").limit(1);
      if (supply) {
        await tx.update(suppliesTable)
          .set({ amountPaid: Number(((supply.amountPaid ?? debt.paidAmount) + amount).toFixed(2)) })
          .where(eq(suppliesTable.id, supply.id));
      }
    }
    return "ok" as const;
  });
  if (outcome === "missing") {
    res.status(404).json({ error: "الدين غير موجود" });
    return;
  }
  if (outcome === "overpaid") {
    res.status(400).json({ error: "المبلغ أكبر من المتبقي على الدين" });
    return;
  }
  res.json(CreateDebtPaymentResponse.parse(await loadDebt(params.data.id)));
});

router.get("/expenses", async (req, res): Promise<void> => {
  const parsed = ListExpensesQueryParams.safeParse(req.query);
  if (!parsed.success || !validMonth(parsed.data.month)) {
    res.status(400).json({ error: "الشهر المحدد غير صالح" });
    return;
  }
  const { from, until } = monthRange(parsed.data.month);
  const rows = await db.select().from(operatingExpensesTable)
    .where(and(gte(operatingExpensesTable.expenseDate, from), lt(operatingExpensesTable.expenseDate, until)))
    .orderBy(desc(operatingExpensesTable.expenseDate), desc(operatingExpensesTable.createdAt));
  res.json(ListExpensesResponse.parse(rows));
});

router.post("/expenses", requireManager, async (req, res): Promise<void> => {
  const parsed = CreateExpenseBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const expenseDate = typeof req.body.expenseDate === "string"
    ? req.body.expenseDate
    : parsed.data.expenseDate.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(expenseDate)) {
    res.status(400).json({ error: "تاريخ المصروف غير صالح" });
    return;
  }
  const actor = res.locals.currentStaff as typeof staffTable.$inferSelect;
  const [expense] = await db.insert(operatingExpensesTable).values({
    category: parsed.data.category,
    amount: Number(parsed.data.amount.toFixed(2)),
    expenseDate,
    notes: parsed.data.notes?.trim() || null,
    actorUserId: actor.clerkUserId,
    actorName: actor.displayName,
  }).returning();
  res.status(201).json(CreateExpenseResponse.parse(expense));
});

router.get("/finance/monthly", async (req, res): Promise<void> => {
  const parsed = GetMonthlyFinanceQueryParams.safeParse(req.query);
  if (!parsed.success || !validMonth(parsed.data.month)) {
    res.status(400).json({ error: "الشهر المحدد غير صالح" });
    return;
  }
  const month = parsed.data.month;
  const [sales] = await db.select({
    revenue: sql<string>`coalesce(sum(${salesTable.total}), 0)`,
  }).from(salesTable).where(and(
    isNull(salesTable.cancelledAt),
    sql`to_char(${salesTable.createdAt} AT TIME ZONE 'Africa/Cairo', 'YYYY-MM') = ${month}`,
  ));
  const [costs] = await db.select({
    cost: sql<string>`coalesce(sum(${saleItemsTable.quantity} * ${saleItemsTable.unitCost}), 0)`,
  }).from(saleItemsTable)
    .innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .where(and(
      isNull(salesTable.cancelledAt),
      sql`to_char(${salesTable.createdAt} AT TIME ZONE 'Africa/Cairo', 'YYYY-MM') = ${month}`,
    ));
  const { from, until } = monthRange(month);
  const breakdownRows = await db.select({
    category: operatingExpensesTable.category,
    total: sql<string>`coalesce(sum(${operatingExpensesTable.amount}), 0)`,
  }).from(operatingExpensesTable)
    .where(and(
      gte(operatingExpensesTable.expenseDate, from),
      lt(operatingExpensesTable.expenseDate, until),
    ))
    .groupBy(operatingExpensesTable.category);
  const salesRevenue = Number(sales?.revenue ?? 0);
  const costOfGoodsSold = Number(costs?.cost ?? 0);
  const expensesTotal = Number(breakdownRows.reduce((sum, row) => sum + Number(row.total), 0).toFixed(2));
  const grossProfit = Number((salesRevenue - costOfGoodsSold).toFixed(2));
  res.json(GetMonthlyFinanceResponse.parse({
    month,
    salesRevenue,
    costOfGoodsSold,
    grossProfit,
    expensesTotal,
    netProfit: Number((grossProfit - expensesTotal).toFixed(2)),
    expenseBreakdown: breakdownRows.map((row) => ({ category: row.category, total: Number(row.total) })),
  }));
});

export default router;
