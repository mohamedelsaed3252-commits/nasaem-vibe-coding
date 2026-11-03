import { Router, type IRouter } from "express";
import { desc, eq } from "drizzle-orm";
import {
  ExportBackupResponse,
  RestoreBackupBody,
  RestoreBackupResponse,
} from "@workspace/api-zod";
import {
  db,
  productsTable,
  saleItemsTable,
  salesTable,
  suppliesTable,
  supplyItemsTable,
  debtsTable,
  debtPaymentsTable,
  operatingExpensesTable,
} from "@workspace/db";
import { requireAppRole } from "../middlewares/appAuth";

const router: IRouter = Router();
const requireOwner = (
  req: Parameters<typeof requireAppRole>[1],
  res: Parameters<typeof requireAppRole>[2],
  next: Parameters<typeof requireAppRole>[3],
) => requireAppRole(["owner"], req, res, next);

async function listSales() {
  const rows = await db.select().from(salesTable).orderBy(salesTable.createdAt);
  return Promise.all(
    rows.map(async (sale) => ({
      ...sale,
      items: await db
        .select()
        .from(saleItemsTable)
        .where(eq(saleItemsTable.saleId, sale.id)),
    })),
  );
}

async function listSupplies() {
  const rows = await db
    .select()
    .from(suppliesTable)
    .orderBy(suppliesTable.createdAt);
  return Promise.all(
    rows.map(async (supply) => ({
      ...supply,
      items: await db
        .select()
        .from(supplyItemsTable)
        .where(eq(supplyItemsTable.supplyId, supply.id)),
    })),
  );
}

async function listDebts() {
  const debts = await db.select().from(debtsTable).orderBy(debtsTable.createdAt);
  return Promise.all(debts.map(async (debt) => ({
    ...debt,
    remaining: Number((debt.amount - debt.paidAmount).toFixed(2)),
    payments: await db.select().from(debtPaymentsTable)
      .where(eq(debtPaymentsTable.debtId, debt.id))
      .orderBy(desc(debtPaymentsTable.createdAt)),
  })));
}

router.get("/backup", requireOwner, async (_req, res): Promise<void> => {
  const [products, sales, supplies, debts, expenses] = await Promise.all([
    db.select().from(productsTable).orderBy(productsTable.createdAt),
    listSales(),
    listSupplies(),
    listDebts(),
    db.select().from(operatingExpensesTable).orderBy(operatingExpensesTable.expenseDate),
  ]);
  res.json(
    ExportBackupResponse.parse({
      version: 1,
      exportedAt: new Date(),
      products,
      sales,
      supplies,
      debts,
      expenses,
    }),
  );
});

router.post("/backup", requireOwner, async (req, res): Promise<void> => {
  const parsed = RestoreBackupBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const backup = parsed.data;
  try {
    await db.transaction(async (tx) => {
      for (const product of backup.products) {
        await tx
          .insert(productsTable)
          .values({
            id: product.id,
            name: product.name,
            sku: product.sku,
            category: product.category,
            unit: product.unit,
            unitsPerCarton: product.unitsPerCarton ?? 1,
            purchasePrice: product.purchasePrice,
            sellingPrice: product.sellingPrice,
            stock: product.stock,
            lowStockThreshold: product.lowStockThreshold,
            isActive: product.isActive,
            updatedAt: product.updatedAt,
          })
          .onConflictDoUpdate({
            target: productsTable.id,
            set: {
              name: product.name,
              sku: product.sku,
              category: product.category,
              unit: product.unit,
              unitsPerCarton: product.unitsPerCarton ?? 1,
              purchasePrice: product.purchasePrice,
              sellingPrice: product.sellingPrice,
              stock: product.stock,
              lowStockThreshold: product.lowStockThreshold,
              isActive: product.isActive,
              updatedAt: product.updatedAt,
            },
          });
      }

      for (const sale of backup.sales) {
        await tx
          .insert(salesTable)
          .values({
            id: sale.id,
            invoiceNumber: sale.invoiceNumber,
            subtotal: sale.subtotal,
            discount: sale.discount,
            total: sale.total,
            estimatedProfit: sale.estimatedProfit,
            notes: sale.notes,
            cancelledAt: sale.cancelledAt ?? null,
            cancelledBy: sale.cancelledBy ?? null,
            cancellationReason: sale.cancellationReason ?? null,
            actorName: sale.actorName,
            createdAt: sale.createdAt,
          })
          .onConflictDoUpdate({
            target: salesTable.id,
            set: {
              invoiceNumber: sale.invoiceNumber,
              subtotal: sale.subtotal,
              discount: sale.discount,
              total: sale.total,
              estimatedProfit: sale.estimatedProfit,
              notes: sale.notes,
              cancelledAt: sale.cancelledAt ?? null,
              cancelledBy: sale.cancelledBy ?? null,
              cancellationReason: sale.cancellationReason ?? null,
              actorName: sale.actorName,
              createdAt: sale.createdAt,
            },
          });
        await tx
          .delete(saleItemsTable)
          .where(eq(saleItemsTable.saleId, sale.id));
        if (sale.items.length) {
          await tx.insert(saleItemsTable).values(
            sale.items.map((item) => ({
              saleId: sale.id,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              unitCost: item.unitCost,
              lineTotal: item.lineTotal,
            })),
          );
        }
      }

      for (const supply of backup.supplies) {
        await tx
          .insert(suppliesTable)
          .values({
            id: supply.id,
            supplierName: supply.supplierName,
            reference: supply.reference,
            total: supply.total,
            amountPaid: supply.amountPaid ?? null,
            notes: supply.notes,
            actorName: supply.actorName,
            createdAt: supply.createdAt,
          })
          .onConflictDoUpdate({
            target: suppliesTable.id,
            set: {
              supplierName: supply.supplierName,
              reference: supply.reference,
              total: supply.total,
              amountPaid: supply.amountPaid ?? null,
              notes: supply.notes,
              actorName: supply.actorName,
              createdAt: supply.createdAt,
            },
          });
        await tx
          .delete(supplyItemsTable)
          .where(eq(supplyItemsTable.supplyId, supply.id));
        if (supply.items.length) {
          await tx.insert(supplyItemsTable).values(
            supply.items.map((item) => ({
              supplyId: supply.id,
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unitCost: item.unitCost,
              lineTotal: item.lineTotal,
            })),
          );
        }
      }

      for (const debt of backup.debts ?? []) {
        await tx.insert(debtsTable).values({
          id: debt.id,
          direction: debt.direction,
          partyType: debt.partyType,
          partyName: debt.partyName,
          amount: debt.amount,
          paidAmount: debt.paidAmount,
          notes: debt.notes,
          supplyId: debt.supplyId,
          actorName: debt.actorName,
          createdAt: debt.createdAt,
        }).onConflictDoUpdate({
          target: debtsTable.id,
          set: {
            direction: debt.direction,
            partyType: debt.partyType,
            partyName: debt.partyName,
            amount: debt.amount,
            paidAmount: debt.paidAmount,
            notes: debt.notes,
            supplyId: debt.supplyId,
            actorName: debt.actorName,
            createdAt: debt.createdAt,
          },
        });
        await tx.delete(debtPaymentsTable).where(eq(debtPaymentsTable.debtId, debt.id));
        if (debt.payments.length) {
          await tx.insert(debtPaymentsTable).values(debt.payments.map((payment) => ({
            id: payment.id,
            debtId: debt.id,
            amount: payment.amount,
            notes: payment.notes,
            actorName: payment.actorName,
            createdAt: payment.createdAt,
          })));
        }
      }

      for (const expense of backup.expenses ?? []) {
        const expenseDate = expense.expenseDate instanceof Date
          ? expense.expenseDate.toISOString().slice(0, 10)
          : String(expense.expenseDate).slice(0, 10);
        await tx.insert(operatingExpensesTable).values({
          id: expense.id,
          category: expense.category,
          amount: expense.amount,
          expenseDate,
          notes: expense.notes,
          actorName: expense.actorName,
          createdAt: expense.createdAt,
        }).onConflictDoUpdate({
          target: operatingExpensesTable.id,
          set: {
            category: expense.category,
            amount: expense.amount,
            expenseDate,
            notes: expense.notes,
            actorName: expense.actorName,
            createdAt: expense.createdAt,
          },
        });
      }
    });
  } catch (error) {
    req.log.warn({ err: error }, "Backup restore failed");
    res.status(400).json({ error: "تعذر استعادة النسخة؛ تأكد من سلامة الملف" });
    return;
  }

  res.json(
    RestoreBackupResponse.parse({
      productsRestored: backup.products.length,
      salesRestored: backup.sales.length,
      suppliesRestored: backup.supplies.length,
    }),
  );
});

export default router;
