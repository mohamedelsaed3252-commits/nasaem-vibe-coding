import { Router, type IRouter } from "express";
import {
  and,
  desc,
  eq,
  ilike,
  lte,
  or,
} from "drizzle-orm";
import {
  AdjustStockBody,
  AdjustStockParams,
  AdjustStockResponse,
  CreateProductBody,
  CreateProductResponse,
  DeleteProductParams,
  GetProductParams,
  GetProductResponse,
  ListProductsQueryParams,
  ListProductsResponse,
  UpdateProductBody,
  UpdateProductParams,
  UpdateProductResponse,
} from "@workspace/api-zod";
import { db, productsTable, stockAdjustmentsTable } from "@workspace/db";
import { requireAppRole } from "../middlewares/appAuth";

const router: IRouter = Router();
const requireManager = (req: Parameters<typeof requireAppRole>[1], res: Parameters<typeof requireAppRole>[2], next: Parameters<typeof requireAppRole>[3]) =>
  requireAppRole(["owner", "manager"], req, res, next);

router.get("/products", async (req, res): Promise<void> => {
  const rawLowStock = req.query.lowStock;
  const rawIncludeInactive = req.query.includeInactive;
  const invalidBoolean =
    (typeof rawLowStock === "string" &&
      rawLowStock !== "true" &&
      rawLowStock !== "false") ||
    (typeof rawIncludeInactive === "string" &&
      rawIncludeInactive !== "true" &&
      rawIncludeInactive !== "false");
  if (invalidBoolean) {
    res.status(400).json({ error: "قيمة تصفية المنتجات غير صالحة" });
    return;
  }
  const params = ListProductsQueryParams.safeParse({
    ...req.query,
    lowStock:
      rawLowStock === "true"
        ? true
        : rawLowStock === "false"
          ? false
          : rawLowStock,
    includeInactive:
      rawIncludeInactive === "true"
        ? true
        : rawIncludeInactive === "false"
          ? false
          : rawIncludeInactive,
  });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const predicates = [];
  if (!params.data.includeInactive) {
    predicates.push(eq(productsTable.isActive, true));
  }
  if (params.data.search?.trim()) {
    const pattern = `%${params.data.search.trim()}%`;
    predicates.push(
      or(
        ilike(productsTable.name, pattern),
        ilike(productsTable.category, pattern),
        ilike(productsTable.sku, pattern),
      )!,
    );
  }
  if (params.data.lowStock) {
    predicates.push(lte(productsTable.stock, productsTable.lowStockThreshold));
  }

  const rows = await db
    .select()
    .from(productsTable)
    .where(predicates.length ? and(...predicates) : undefined)
    .orderBy(desc(productsTable.updatedAt));
  res.json(ListProductsResponse.parse(rows));
});

router.post("/products", requireManager, async (req, res): Promise<void> => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const sku = parsed.data.sku?.trim() || null;
  if (sku) {
    const [duplicate] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.sku, sku))
      .limit(1);
    if (duplicate) {
      res.status(400).json({ error: "رمز المنتج مستخدم بالفعل" });
      return;
    }
  }

  const [product] = await db
    .insert(productsTable)
    .values({ ...parsed.data, sku })
    .returning();
  res.status(201).json(CreateProductResponse.parse(product));
});

router.get("/products/:id", async (req, res): Promise<void> => {
  const params = GetProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [product] = await db
    .select()
    .from(productsTable)
    .where(eq(productsTable.id, params.data.id))
    .limit(1);
  if (!product) {
    res.status(404).json({ error: "المنتج غير موجود" });
    return;
  }
  res.json(GetProductResponse.parse(product));
});

router.patch("/products/:id", requireManager, async (req, res): Promise<void> => {
  const params = UpdateProductParams.safeParse(req.params);
  const parsed = UpdateProductBody.safeParse(req.body);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const values = { ...parsed.data };
  if (values.sku !== undefined) values.sku = values.sku?.trim() || null;
  if (values.sku) {
    const [duplicate] = await db
      .select({ id: productsTable.id })
      .from(productsTable)
      .where(eq(productsTable.sku, values.sku))
      .limit(1);
    if (duplicate && duplicate.id !== params.data.id) {
      res.status(400).json({ error: "رمز المنتج مستخدم بالفعل" });
      return;
    }
  }

  const [product] = await db
    .update(productsTable)
    .set(values)
    .where(eq(productsTable.id, params.data.id))
    .returning();
  if (!product) {
    res.status(404).json({ error: "المنتج غير موجود" });
    return;
  }
  res.json(UpdateProductResponse.parse(product));
});

router.delete("/products/:id", requireManager, async (req, res): Promise<void> => {
  const params = DeleteProductParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [product] = await db
    .update(productsTable)
    .set({ isActive: false })
    .where(eq(productsTable.id, params.data.id))
    .returning({ id: productsTable.id });
  if (!product) {
    res.status(404).json({ error: "المنتج غير موجود" });
    return;
  }
  res.sendStatus(204);
});

router.post(
  "/products/:id/stock",
  requireManager,
  async (req, res): Promise<void> => {
    const params = AdjustStockParams.safeParse(req.params);
    const parsed = AdjustStockBody.safeParse(req.body);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    if (parsed.data.delta === 0) {
      res.status(400).json({ error: "يجب أن تكون الكمية مختلفة عن صفر" });
      return;
    }

    const actor = res.locals.currentStaff;
    const updated = await db.transaction(async (tx) => {
      const [product] = await tx
        .select()
        .from(productsTable)
        .where(eq(productsTable.id, params.data.id))
        .for("update")
        .limit(1);
      if (!product) return null;
      const nextStock = Number((product.stock + parsed.data.delta).toFixed(3));
      if (nextStock < 0) {
        throw new Error("المخزون لا يسمح بهذا التعديل");
      }
      const [row] = await tx
        .update(productsTable)
        .set({ stock: nextStock })
        .where(eq(productsTable.id, product.id))
        .returning();
      await tx.insert(stockAdjustmentsTable).values({
        productId: product.id,
        productName: product.name,
        delta: parsed.data.delta,
        reason: parsed.data.reason.trim(),
        actorUserId: actor.clerkUserId,
        actorName: actor.displayName,
      });
      return row;
    }).catch((error: unknown) => {
      if (error instanceof Error && error.message === "المخزون لا يسمح بهذا التعديل") {
        return "negative" as const;
      }
      throw error;
    });

    if (updated === "negative") {
      res.status(400).json({ error: "المخزون لا يسمح بهذا التعديل" });
      return;
    }
    if (!updated) {
      res.status(404).json({ error: "المنتج غير موجود" });
      return;
    }
    res.json(AdjustStockResponse.parse(updated));
  },
);

export default router;
