import { Router, type IRouter } from "express";
import { and, count, desc, eq, isNull, sql } from "drizzle-orm";
import {
  GetDashboardResponse,
  ListRecentActivityQueryParams,
  ListRecentActivityResponse,
  ListSalesResponse,
} from "@workspace/api-zod";
import {
  db,
  productsTable,
  saleItemsTable,
  salesTable,
  stockAdjustmentsTable,
  suppliesTable,
} from "@workspace/db";

const router: IRouter = Router();

async function salesWithItems(limit: number) {
  const sales = await db
    .select()
    .from(salesTable)
    .orderBy(desc(salesTable.createdAt))
    .limit(limit);
  return Promise.all(
    sales.map(async (sale) => ({
      ...sale,
      items: await db
        .select()
        .from(saleItemsTable)
        .where(eq(saleItemsTable.saleId, sale.id)),
    })),
  );
}

router.get("/dashboard", async (_req, res): Promise<void> => {
  const [productTotal] = await db
    .select({ value: count() })
    .from(productsTable)
    .where(eq(productsTable.isActive, true));
  const [lowStockTotal] = await db
    .select({ value: count() })
    .from(productsTable)
    .where(
      and(
        eq(productsTable.isActive, true),
        sql`${productsTable.stock} <= ${productsTable.lowStockThreshold}`,
      ),
    );
  const lowStockProducts = await db
    .select()
    .from(productsTable)
    .where(
      and(
        eq(productsTable.isActive, true),
        sql`${productsTable.stock} <= ${productsTable.lowStockThreshold}`,
      ),
    )
    .orderBy(productsTable.stock)
    .limit(8);
  const [todayTotals] = await db
    .select({
      sales: sql<string>`coalesce(sum(${salesTable.total}), 0)`,
      saleCount: count(),
      profit: sql<string>`coalesce(sum(${salesTable.estimatedProfit}), 0)`,
    })
    .from(salesTable)
    .where(
      and(
        isNull(salesTable.cancelledAt),
        sql`(${salesTable.createdAt} AT TIME ZONE 'Africa/Cairo')::date = (now() AT TIME ZONE 'Africa/Cairo')::date`,
      ),
    );
  const recentSales = ListSalesResponse.parse(await salesWithItems(5));
  res.json(
    GetDashboardResponse.parse({
      productCount: productTotal?.value ?? 0,
      lowStockCount: lowStockTotal?.value ?? 0,
      todaySales: Number(todayTotals?.sales ?? 0),
      todaySaleCount: todayTotals?.saleCount ?? 0,
      estimatedProfit: Number(todayTotals?.profit ?? 0),
      recentSales,
      lowStockProducts,
    }),
  );
});

router.get("/activity", async (req, res): Promise<void> => {
  const params = ListRecentActivityQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const limit = params.data.limit;
  const [sales, supplies, adjustments] = await Promise.all([
    db.select().from(salesTable).orderBy(desc(salesTable.createdAt)).limit(limit),
    db
      .select()
      .from(suppliesTable)
      .orderBy(desc(suppliesTable.createdAt))
      .limit(limit),
    db
      .select()
      .from(stockAdjustmentsTable)
      .orderBy(desc(stockAdjustmentsTable.createdAt))
      .limit(limit),
  ]);
  const result = [
    ...sales.map((sale) => ({
      id: `sale:${sale.id}`,
      kind: "sale" as const,
      label: `${sale.cancelledAt ? "إلغاء فاتورة" : "فاتورة"} ${sale.invoiceNumber}`,
      amount: sale.cancelledAt ? 0 : sale.total,
      createdAt: sale.cancelledAt ?? sale.createdAt,
      actorName: sale.cancelledBy ?? sale.actorName,
    })),
    ...supplies.map((supply) => ({
      id: `supply:${supply.id}`,
      kind: "supply" as const,
      label: `توريد من ${supply.supplierName}`,
      amount: supply.total,
      createdAt: supply.createdAt,
      actorName: supply.actorName,
    })),
    ...adjustments.map((adjustment) => ({
      id: `adjustment:${adjustment.id}`,
      kind: "adjustment" as const,
      label: `${adjustment.productName}: ${adjustment.reason}`,
      amount: null,
      createdAt: adjustment.createdAt,
      actorName: adjustment.actorName,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
  res.json(ListRecentActivityResponse.parse(result));
});

export default router;
