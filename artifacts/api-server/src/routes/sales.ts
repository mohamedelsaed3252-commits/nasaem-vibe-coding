import { randomUUID } from "node:crypto";
import { Router, type IRouter } from "express";
import { desc, eq, sql } from "drizzle-orm";
import {
  CreateSaleBody,
  CreateSaleResponse,
  GetSaleInvoiceParams,
  GetSaleInvoiceResponse,
  ListSalesQueryParams,
  ListSalesResponse,
  CancelSaleBody,
  CancelSaleParams,
  CancelSaleResponse,
} from "@workspace/api-zod";
import {
  db,
  productsTable,
  saleItemsTable,
  salesTable,
  staffTable,
  stockAdjustmentsTable,
} from "@workspace/db";
import { requireAppRole } from "../middlewares/appAuth";

const router: IRouter = Router();

async function loadSale(id: string) {
  const [sale] = await db
    .select()
    .from(salesTable)
    .where(eq(salesTable.id, id))
    .limit(1);
  if (!sale) return null;
  const items = await db
    .select()
    .from(saleItemsTable)
    .where(eq(saleItemsTable.saleId, sale.id));
  return { ...sale, items };
}

router.get("/sales", async (req, res): Promise<void> => {
  const params = ListSalesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sales = await db
    .select()
    .from(salesTable)
    .orderBy(desc(salesTable.createdAt))
    .limit(params.data.limit);
  const result = await Promise.all(
    sales.map(async (sale) => ({
      ...sale,
      items: await db
        .select()
        .from(saleItemsTable)
        .where(eq(saleItemsTable.saleId, sale.id)),
    })),
  );
  res.json(ListSalesResponse.parse(result));
});

router.post("/sales", async (req, res): Promise<void> => {
  const parsed = CreateSaleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const discount = Number(parsed.data.discount.toFixed(2));
  const quantities = new Map<string, number>();
  for (const item of parsed.data.items) {
    quantities.set(
      item.productId,
      Number(((quantities.get(item.productId) ?? 0) + item.quantity).toFixed(3)),
    );
  }
  const actor = res.locals.currentStaff as typeof staffTable.$inferSelect;

  try {
    const saleId = randomUUID();
    const created = await db.transaction(async (tx) => {
      const productById = new Map<
        string,
        typeof productsTable.$inferSelect
      >();
      for (const productId of [...quantities.keys()].sort()) {
        const [product] = await tx
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, productId))
          .for("update")
          .limit(1);
        if (!product || !product.isActive) {
          throw new Error("يوجد منتج غير متاح في الفاتورة");
        }
        const requested = quantities.get(productId) ?? 0;
        if (product.stock < requested) {
          throw new Error(`الكمية المتاحة من ${product.name} غير كافية`);
        }
        productById.set(productId, product);
      }

      const lines = parsed.data.items.map((item) => {
        const product = productById.get(item.productId)!;
        const lineTotal = Number((product.sellingPrice * item.quantity).toFixed(2));
        return {
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitPrice: product.sellingPrice,
          unitCost: product.purchasePrice,
          lineTotal,
        };
      });
      const subtotal = Number(
        lines.reduce((sum, item) => sum + item.lineTotal, 0).toFixed(2),
      );
      if (discount > subtotal) {
        throw new Error("الخصم لا يمكن أن يتجاوز قيمة الفاتورة");
      }
      const estimatedProfit = Number(
        (
          lines.reduce(
            (sum, item) =>
              sum + (item.unitPrice - item.unitCost) * item.quantity,
            0,
          ) - discount
        ).toFixed(2),
      );
      const [sale] = await tx
        .insert(salesTable)
        .values({
          id: saleId,
          invoiceNumber: `NS-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${saleId.slice(0, 6).toUpperCase()}`,
          subtotal,
          discount,
          total: Number((subtotal - discount).toFixed(2)),
          estimatedProfit,
          notes: parsed.data.notes?.trim() || null,
          actorUserId: actor.clerkUserId,
          actorName: actor.displayName,
        })
        .returning();

      for (const [productId, quantity] of quantities) {
        const product = productById.get(productId)!;
        await tx
          .update(productsTable)
          .set({ stock: Number((product.stock - quantity).toFixed(3)) })
          .where(eq(productsTable.id, productId));
      }
      await tx.insert(saleItemsTable).values(
        lines.map((line) => ({ ...line, saleId: sale.id })),
      );
      return { ...sale, items: lines };
    });
    res.status(201).json(CreateSaleResponse.parse(created));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "تعذر تسجيل عملية البيع";
    res.status(400).json({ error: message });
  }
});

router.post("/sales/:id/cancel", (req, res, next) =>
  requireAppRole(["owner", "manager"], req, res, next),
async (req, res): Promise<void> => {
  const params = CancelSaleParams.safeParse(req.params);
  const body = CancelSaleBody.safeParse(req.body);
  if (!params.success || !body.success || !body.data.reason.trim()) {
    res.status(400).json({ error: "اختر الفاتورة واكتب سبب الإلغاء" });
    return;
  }
  const actor = res.locals.currentStaff as typeof staffTable.$inferSelect;
  try {
    const result = await db.transaction(async (tx) => {
      const [sale] = await tx.select().from(salesTable)
        .where(eq(salesTable.id, params.data.id)).for("update").limit(1);
      if (!sale) return null;
      const items = await tx.select().from(saleItemsTable)
        .where(eq(saleItemsTable.saleId, sale.id));
      // The sale lock makes retries and simultaneous cancellations idempotent.
      if (sale.cancelledAt) return { ...sale, items };
      const quantities = new Map<string, number>();
      for (const item of items) {
        quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
      }
      for (const productId of [...quantities.keys()].sort()) {
        const quantity = Number(quantities.get(productId)!.toFixed(3));
        await tx.update(productsTable)
          .set({ stock: sql`${productsTable.stock} + ${quantity}` })
          .where(eq(productsTable.id, productId));
        await tx.insert(stockAdjustmentsTable).values({
          productId,
          productName: items.find(item => item.productId === productId)!.productName,
          delta: quantity,
          reason: `إلغاء ${sale.invoiceNumber}: ${body.data.reason.trim()}`,
          actorUserId: actor.clerkUserId,
          actorName: actor.displayName,
        });
      }
      const [cancelled] = await tx.update(salesTable).set({
        cancelledAt: new Date(),
        cancelledBy: actor.displayName,
        cancellationReason: body.data.reason.trim(),
      }).where(eq(salesTable.id, sale.id)).returning();
      return { ...cancelled, items };
    });
    if (!result) {
      res.status(404).json({ error: "الفاتورة غير موجودة" });
      return;
    }
    res.json(CancelSaleResponse.parse(result));
  } catch {
    res.status(500).json({ error: "تعذر إلغاء البيع؛ لم يتم تغيير المخزون. حاول مرة أخرى." });
  }
});

router.get("/sales/:id/invoice", async (req, res): Promise<void> => {
  const params = GetSaleInvoiceParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const sale = await loadSale(params.data.id);
  if (!sale) {
    res.status(404).json({ error: "الفاتورة غير موجودة" });
    return;
  }
  res.json(
    GetSaleInvoiceResponse.parse({
      ...sale,
      storeName: "نسايم للمنظفات",
    }),
  );
});

export default router;
