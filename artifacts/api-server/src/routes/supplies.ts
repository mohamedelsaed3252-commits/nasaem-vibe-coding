import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  CreateSupplyBody,
  CreateSupplyResponse,
  ListSuppliesQueryParams,
  ListSuppliesResponse,
} from "@workspace/api-zod";
import {
  db,
  productsTable,
  staffTable,
  suppliesTable,
  supplyItemsTable,
  debtsTable,
  debtPaymentsTable,
} from "@workspace/db";
import { requireAppRole } from "../middlewares/appAuth";

const router: IRouter = Router();
const requireManager = (req: Parameters<typeof requireAppRole>[1], res: Parameters<typeof requireAppRole>[2], next: Parameters<typeof requireAppRole>[3]) =>
  requireAppRole(["owner", "manager"], req, res, next);

router.get("/supplies", async (req, res): Promise<void> => {
  const params = ListSuppliesQueryParams.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const supplies = await db
    .select()
    .from(suppliesTable)
    .orderBy(desc(suppliesTable.createdAt))
    .limit(params.data.limit);
  const result = await Promise.all(
    supplies.map(async (supply) => ({
      ...supply,
      items: await db
        .select()
        .from(supplyItemsTable)
        .where(eq(supplyItemsTable.supplyId, supply.id)),
    })),
  );
  res.json(ListSuppliesResponse.parse(result));
});

router.post("/supplies", requireManager, async (req, res): Promise<void> => {
  const parsed = CreateSupplyBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const actor = res.locals.currentStaff as typeof staffTable.$inferSelect;

  try {
    const created = await db.transaction(async (tx) => {
      const ids = [...new Set(parsed.data.items.map((item) => item.productId))].sort();
      const products = new Map<string, typeof productsTable.$inferSelect>();
      for (const productId of ids) {
        const [product] = await tx
          .select()
          .from(productsTable)
          .where(eq(productsTable.id, productId))
          .for("update")
          .limit(1);
        if (!product || !product.isActive) {
          throw new Error("يوجد منتج غير متاح في التوريد");
        }
        products.set(productId, product);
      }

      const lines = parsed.data.items.map((item) => {
        const product = products.get(item.productId)!;
        return {
          productId: product.id,
          productName: product.name,
          quantity: item.quantity,
          unitCost: item.unitCost,
          lineTotal: Number((item.quantity * item.unitCost).toFixed(2)),
        };
      });
      const total = Number(
        lines.reduce((sum, line) => sum + line.lineTotal, 0).toFixed(2),
      );
      const amountPaid = Number((parsed.data.amountPaid ?? 0).toFixed(2));
      if (amountPaid > total) {
        throw new Error("المبلغ المدفوع لا يمكن أن يتجاوز إجمالي التوريد");
      }
      const [supply] = await tx
        .insert(suppliesTable)
        .values({
          supplierName: parsed.data.supplierName.trim(),
          reference: parsed.data.reference?.trim() || null,
          total,
          amountPaid,
          notes: parsed.data.notes?.trim() || null,
          actorUserId: actor.clerkUserId,
          actorName: actor.displayName,
        })
        .returning();
      if (total > 0) {
        const [debt] = await tx.insert(debtsTable).values({
          direction: "payable",
          partyType: "supplier",
          partyName: parsed.data.supplierName.trim(),
          amount: total,
          paidAmount: amountPaid,
          notes: parsed.data.notes?.trim() || null,
          supplyId: supply.id,
          actorUserId: actor.clerkUserId,
          actorName: actor.displayName,
        }).returning();
        if (amountPaid > 0) {
          await tx.insert(debtPaymentsTable).values({
            debtId: debt.id,
            amount: amountPaid,
            notes: "دفعة عند تسجيل التوريد",
            actorUserId: actor.clerkUserId,
            actorName: actor.displayName,
          });
        }
      }
      await tx.insert(supplyItemsTable).values(
        lines.map((line) => ({ ...line, supplyId: supply.id })),
      );

      const quantities = new Map<string, number>();
      parsed.data.items.forEach((item) => {
        quantities.set(
          item.productId,
          (quantities.get(item.productId) ?? 0) + item.quantity,
        );
      });
      for (const [productId, quantity] of quantities) {
        const product = products.get(productId)!;
        const latestCost = [...parsed.data.items]
          .reverse()
          .find((item) => item.productId === productId)!.unitCost;
        await tx
          .update(productsTable)
          .set({
            stock: Number((product.stock + quantity).toFixed(3)),
            purchasePrice: latestCost,
          })
          .where(eq(productsTable.id, productId));
      }
      return { ...supply, items: lines };
    });
    res.status(201).json(CreateSupplyResponse.parse(created));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "تعذر تسجيل التوريد";
    res.status(400).json({ error: message });
  }
});

export default router;
