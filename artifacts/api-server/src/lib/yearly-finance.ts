import { and, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { db, operatingExpensesTable, saleItemsTable, salesTable } from "@workspace/db";

const rounded = (value: number) => Number(value.toFixed(2));

export async function yearlyFinance(year: number) {
  const from = `${year}-01-01`;
  const until = `${year + 1}-01-01`;
  const saleMonth = sql<string>`to_char(${salesTable.createdAt} AT TIME ZONE 'Africa/Cairo', 'YYYY-MM')`;
  // Explicit timestamp cast: date AT TIME ZONE chooses the opposite overload.
  const saleFilter = and(
    isNull(salesTable.cancelledAt),
    sql`${salesTable.createdAt} >= (${from}::timestamp AT TIME ZONE 'Africa/Cairo')`,
    sql`${salesTable.createdAt} < (${until}::timestamp AT TIME ZONE 'Africa/Cairo')`,
  );
  const revenues = await db.select({
    month: saleMonth, total: sql<string>`sum(${salesTable.total})`,
  }).from(salesTable).where(saleFilter).groupBy(saleMonth);
  const costs = await db.select({
    month: saleMonth, total: sql<string>`sum(${saleItemsTable.quantity} * ${saleItemsTable.unitCost})`,
  }).from(saleItemsTable).innerJoin(salesTable, eq(saleItemsTable.saleId, salesTable.id))
    .where(saleFilter).groupBy(saleMonth);
  const expenseMonth = sql<string>`to_char(${operatingExpensesTable.expenseDate}, 'YYYY-MM')`;
  const expenses = await db.select({
    month: expenseMonth, category: operatingExpensesTable.category,
    total: sql<string>`sum(${operatingExpensesTable.amount})`,
  }).from(operatingExpensesTable)
    .where(and(gte(operatingExpensesTable.expenseDate, from), lt(operatingExpensesTable.expenseDate, until)))
    .groupBy(expenseMonth, operatingExpensesTable.category);
  const months = Array.from({ length: 12 }, (_, index) => {
    const month = `${year}-${String(index + 1).padStart(2, "0")}`;
    const salesRevenue = rounded(Number(revenues.find(row => row.month === month)?.total ?? 0));
    const costOfGoodsSold = rounded(Number(costs.find(row => row.month === month)?.total ?? 0));
    const expenseBreakdown = expenses.filter(row => row.month === month)
      .map(row => ({ category: row.category, total: rounded(Number(row.total)) }));
    const expensesTotal = rounded(expenseBreakdown.reduce((sum, row) => sum + row.total, 0));
    const grossProfit = rounded(salesRevenue - costOfGoodsSold);
    return { month, salesRevenue, costOfGoodsSold, grossProfit, expensesTotal,
      netProfit: rounded(grossProfit - expensesTotal), expenseBreakdown };
  });
  const sum = (key: "salesRevenue" | "costOfGoodsSold" | "grossProfit" | "expensesTotal" | "netProfit") =>
    rounded(months.reduce((total, month) => total + month[key], 0));
  return { year, salesRevenue: sum("salesRevenue"), costOfGoodsSold: sum("costOfGoodsSold"),
    grossProfit: sum("grossProfit"), expensesTotal: sum("expensesTotal"), netProfit: sum("netProfit"), months };
}
