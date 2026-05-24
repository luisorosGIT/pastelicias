import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma.service';
import { roles } from '../middleware/role.middleware';
import { withCache, invalidatePaths } from '../middleware/response-cache.middleware';

const PRODUCTION_INVALIDATION = [
  '/api/production', '/api/inventory', '/api/recipes', '/api/dashboard', '/api/reports',
];
import { AuthRequest, DateFilter } from '../types';
import { ok, created, badRequest, serverError } from '../utils/response';
import { getDateRange } from '../utils/dates';

const router = Router();

const productionSchema = z.object({
  recipeId: z.string().uuid(),
  quantity: z.number().int().positive(),
  notes: z.string().optional().nullable(),
});

// Compra de un producto de reventa (gaseosa, jugo, etc.) — incrementa stock
// y recalcula el costo unitario promedio (CPP) del producto.
const resalePurchaseSchema = z.object({
  recipeId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitCost: z.number().nonnegative(),
  notes: z.string().optional().nullable(),
});

const wasteSchema = z.object({
  type: z.enum(['INGREDIENT', 'PRODUCT']),
  ingredientId: z.string().uuid().optional().nullable(),
  recipeId: z.string().uuid().optional().nullable(),
  quantity: z.number().positive(),
  reason: z.enum(['EXPIRY', 'PHYSICAL_DAMAGE', 'CONTAMINATION', 'LOST_BROKEN', 'SPILL', 'OTHER']),
  notes: z.string().optional().nullable(),
});

// ─── POST /api/production ─────────────────────────────────────────────────────
router.post('/', roles.noSeller, async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branchId;
    if (!branchId) {
      return badRequest(
        res,
        'Selecciona una sucursal específica para registrar producción.'
      );
    }

    const parsed = productionSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const { recipeId, quantity, notes } = parsed.data;

    // Verificar que la receta pertenezca a esta sucursal
    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, branchId },
      include: {
        items: {
          include: { ingredient: { select: { name: true, stock: true, unit: true } } },
        },
      },
    });
    if (!recipe) {
      return badRequest(res, 'Receta no encontrada en esta sucursal');
    }
    if (recipe.isResale) {
      return badRequest(
        res,
        'Este producto es de reventa: no se fabrica, se compra. Usa "Registrar Compra de Reventa".'
      );
    }
    if (recipe.items.length === 0) {
      return badRequest(res, 'La receta no tiene insumos definidos (BOM vacío)');
    }

    // Validación previa fuera de la transacción: fallar rápido sin tomar conexión
    // de pool. La validación atómica REAL se hace dentro con updateMany.
    for (const ri of recipe.items) {
      const needed = ri.quantity * quantity;
      if (ri.ingredient.stock < needed) {
        return badRequest(
          res,
          `Stock insuficiente de "${ri.ingredient.name}": necesitas ${needed} ${ri.ingredient.unit.toLowerCase()} pero solo tienes ${ri.ingredient.stock}.`
        );
      }
    }

    const production = await prisma.$transaction(
      async (tx) => {
        // Descontar insumos atómicamente: el WHERE asegura que solo se decrementa
        // si hay stock suficiente. Si count === 0 algún otro proceso consumió stock
        // mientras tanto → abortar la transacción.
        for (const ri of recipe.items) {
          const needed = ri.quantity * quantity;
          const result = await tx.ingredient.updateMany({
            where: { id: ri.ingredientId, stock: { gte: needed } },
            data: { stock: { decrement: needed } },
          });
          if (result.count === 0) {
            throw new Error(
              `Stock insuficiente de "${ri.ingredient.name}". Otro proceso pudo haber consumido stock.`
            );
          }
        }

        // Incrementar el stock del producto terminado
        await tx.recipe.update({
          where: { id: recipeId },
          data: { stock: { increment: quantity } },
        });

        return tx.production.create({
          data: { branchId, recipeId, quantity, notes },
          include: { recipe: { select: { name: true, category: true } } },
        });
      },
      { timeout: 15000, maxWait: 8000 }
    );

    invalidatePaths(...PRODUCTION_INVALIDATION);
    return created(
      res,
      production,
      `Producción registrada. Se descontaron insumos y se sumaron ${quantity} unidades al stock de "${recipe.name}".`
    );
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Stock insuficiente')) {
      return badRequest(res, error.message);
    }
    console.error('[production/create]', error);
    return serverError(res);
  }
});

// ─── POST /api/production/resale-purchase ─────────────────────────────────────
// Registrar la compra de un producto de reventa (ej: gaseosa). Suma `quantity`
// unidades al stock de la receta y recalcula el costo promedio ponderado (CPP).
router.post('/resale-purchase', roles.noSeller, async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branchId;
    if (!branchId) {
      return badRequest(res, 'Selecciona una sucursal específica para registrar compras.');
    }

    const parsed = resalePurchaseSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const { recipeId, quantity, unitCost, notes } = parsed.data;

    const recipe = await prisma.recipe.findFirst({
      where: { id: recipeId, branchId },
      select: { id: true, name: true, isResale: true, stock: true, purchaseCost: true },
    });
    if (!recipe) return badRequest(res, 'Producto no encontrado en esta sucursal');
    if (!recipe.isResale) {
      return badRequest(
        res,
        `"${recipe.name}" no es un producto de reventa. Usa "Registrar Producción" para fabricados.`
      );
    }

    // CPP: ((stock × CPPactual) + (qty × costoCompra)) / (stock + qty)
    const currentCpp = recipe.purchaseCost ?? 0;
    const newStock = recipe.stock + quantity;
    const newCpp =
      newStock > 0
        ? (recipe.stock * currentCpp + quantity * unitCost) / newStock
        : unitCost;

    const updated = await prisma.recipe.update({
      where: { id: recipeId },
      data: {
        stock: { increment: quantity },
        purchaseCost: newCpp,
      },
      select: { id: true, name: true, stock: true, purchaseCost: true },
    });

    invalidatePaths(...PRODUCTION_INVALIDATION);
    return created(
      res,
      {
        recipe: updated,
        cpp: { previous: currentCpp, new: newCpp },
        notes: notes ?? null,
      },
      `Compra de reventa registrada. Stock de "${updated.name}": ${updated.stock} unidades. Nuevo CPP: S/ ${newCpp.toFixed(2)}.`
    );
  } catch (e) {
    console.error('[resale-purchase]', e);
    return serverError(res);
  }
});

// ─── GET /api/production ─────────────────────────────────────────────────────
// Optimizado: $queryRaw para mandar UNA sentencia SQL con JOIN en vez del
// patrón BEGIN+PREPARE+SELECT+DEALLOCATE+COMMIT de Prisma.
interface ProductionRow {
  id: string;
  branchId: string;
  recipeId: string;
  quantity: number;
  notes: string | null;
  createdAt: Date;
  recipe_name: string;
  recipe_category: string;
}

router.get('/', roles.noSeller, withCache(), async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branchId;
    const rows = branchId
      ? await prisma.$queryRaw<ProductionRow[]>`
          SELECT p.id, p."branchId", p."recipeId", p.quantity, p.notes, p."createdAt",
                 r.name AS recipe_name, r.category::text AS recipe_category
          FROM productions p
          INNER JOIN recipes r ON r.id = p."recipeId"
          WHERE p."branchId" = ${branchId}          ORDER BY p."createdAt" DESC
          LIMIT 50
        `
      : await prisma.$queryRaw<ProductionRow[]>`
          SELECT p.id, p."branchId", p."recipeId", p.quantity, p.notes, p."createdAt",
                 r.name AS recipe_name, r.category::text AS recipe_category
          FROM productions p
          INNER JOIN recipes r ON r.id = p."recipeId"
          INNER JOIN branches b ON b.id = p."branchId"
          WHERE b."businessId" = ${req.user.businessId}          ORDER BY p."createdAt" DESC
          LIMIT 50
        `;

    const productions = rows.map((r) => ({
      id: r.id,
      branchId: r.branchId,
      recipeId: r.recipeId,
      quantity: r.quantity,
      notes: r.notes,
      createdAt: r.createdAt,
      recipe: { name: r.recipe_name, category: r.recipe_category },
    }));

    return ok(res, productions);
  } catch (e) {
    console.error('[production/list]', e);
    return serverError(res);
  }
});

// ─── POST /api/production/waste ───────────────────────────────────────────────
router.post('/waste', roles.noSeller, async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branchId;
    if (!branchId) {
      return badRequest(
        res,
        'Selecciona una sucursal específica para registrar mermas.'
      );
    }

    const parsed = wasteSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const { type, ingredientId, recipeId, quantity, reason, notes } = parsed.data;

    // Calcular costo de la merma
    let cost = 0;

    if (type === 'INGREDIENT' && ingredientId) {
      const ingredient = await prisma.ingredient.findUnique({ where: { id: ingredientId } });
      if (!ingredient) return badRequest(res, 'Insumo no encontrado');
      cost = quantity * ingredient.unitCost;

      // Descontar del stock
      await prisma.ingredient.update({
        where: { id: ingredientId },
        data: { stock: { decrement: quantity } },
      });
    } else if (type === 'PRODUCT' && recipeId) {
      // Verificar stock disponible del producto terminado
      const recipe = await prisma.recipe.findFirst({
        where: { id: recipeId, branchId },
        select: { stock: true, name: true },
      });
      if (!recipe) return badRequest(res, 'Receta no encontrada en esta sucursal');
      if (recipe.stock < quantity) {
        return badRequest(
          res,
          `Stock insuficiente de "${recipe.name}": solo hay ${recipe.stock} unidades disponibles.`
        );
      }

      // Calcular costo BOM (valor de la merma = costo de producción)
      const recipeItems = await prisma.recipeItem.findMany({
        where: { recipeId },
        include: { ingredient: { select: { unitCost: true } } },
      });
      const bomCost = recipeItems.reduce(
        (sum, ri) => sum + ri.quantity * ri.ingredient.unitCost,
        0
      );
      cost = quantity * bomCost;

      // Decrementar el stock del producto terminado
      await prisma.recipe.update({
        where: { id: recipeId },
        data: { stock: { decrement: quantity } },
      });
    } else {
      return badRequest(res, 'Datos de merma incompletos');
    }

    const waste = await prisma.wasteLog.create({
      data: { branchId, type, ingredientId, recipeId, quantity, cost, reason, notes },
      include: {
        ingredient: { select: { name: true, unit: true } },
        recipe: { select: { name: true } },
      },
    });

    invalidatePaths(...PRODUCTION_INVALIDATION);
    return created(res, waste, 'Merma registrada');
  } catch {
    return serverError(res);
  }
});

// ─── GET /api/production/waste ────────────────────────────────────────────────
// Optimizado: $queryRaw con un LEFT JOIN doble (ingredient + recipe) en una sola
// sentencia. Reemplaza findMany + Prisma joins → 10x más rápido en frío.
interface WasteRow {
  id: string;
  branchId: string;
  type: string;
  ingredientId: string | null;
  recipeId: string | null;
  quantity: number;
  cost: number;
  reason: string;
  notes: string | null;
  createdAt: Date;
  ingredient_name: string | null;
  ingredient_unit: string | null;
  recipe_name: string | null;
}

router.get('/waste', roles.noSeller, withCache(), async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branchId;
    const rows = branchId
      ? await prisma.$queryRaw<WasteRow[]>`
          SELECT w.id, w."branchId", w.type::text, w."ingredientId", w."recipeId",
                 w.quantity, w.cost, w.reason::text, w.notes, w."createdAt",
                 i.name AS ingredient_name, i.unit::text AS ingredient_unit,
                 r.name AS recipe_name
          FROM waste_logs w
          LEFT JOIN ingredients i ON i.id = w."ingredientId"
          LEFT JOIN recipes r ON r.id = w."recipeId"
          WHERE w."branchId" = ${branchId}          ORDER BY w."createdAt" DESC
          LIMIT 100
        `
      : await prisma.$queryRaw<WasteRow[]>`
          SELECT w.id, w."branchId", w.type::text, w."ingredientId", w."recipeId",
                 w.quantity, w.cost, w.reason::text, w.notes, w."createdAt",
                 i.name AS ingredient_name, i.unit::text AS ingredient_unit,
                 r.name AS recipe_name
          FROM waste_logs w
          INNER JOIN branches b ON b.id = w."branchId"
          LEFT JOIN ingredients i ON i.id = w."ingredientId"
          LEFT JOIN recipes r ON r.id = w."recipeId"
          WHERE b."businessId" = ${req.user.businessId}          ORDER BY w."createdAt" DESC
          LIMIT 100
        `;

    let totalWasteCost = 0;
    const wastes = new Array(rows.length);
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      totalWasteCost += r.cost;
      wastes[i] = {
        id: r.id,
        branchId: r.branchId,
        type: r.type,
        ingredientId: r.ingredientId,
        recipeId: r.recipeId,
        quantity: r.quantity,
        cost: r.cost,
        reason: r.reason,
        notes: r.notes,
        createdAt: r.createdAt,
        ...(r.ingredient_name ? { ingredient: { name: r.ingredient_name, unit: r.ingredient_unit } } : {}),
        ...(r.recipe_name ? { recipe: { name: r.recipe_name } } : {}),
      };
    }
    return ok(res, { wastes, totalWasteCost });
  } catch (e) {
    console.error('[production/waste-list]', e);
    return serverError(res);
  }
});

/**
 * GET /api/production/waste-kpis?filter=today|week|month|...
 * KPIs profesionales de merma:
 *  1) Variación Monetaria de Inventario: suma de las varianzas negativas
 *     registradas en `inventory_counts` (merma "invisible": derrames, robos, mal pesaje).
 *  2) % Desperdicio Directo: (valor de mermas registradas / total de ventas) * 100
 *  3) Top 5 insumos con mayor pérdida (cantidad y monto).
 */
router.get('/waste-kpis', roles.noSeller, withCache(), async (req: AuthRequest, res: Response) => {
  try {
    const filter = (req.query.filter as DateFilter) || 'month';
    const branchId = req.branchId || undefined;
    const { from, to } = getDateRange(filter);

    // Agregaciones en el motor SQL, NO en JS. Un solo round-trip para 4 KPIs +
    // top 5 insumos via 4 sentencias paralelas a Postgres con UNION ALL podría ser
    // ideal, pero por claridad mantenemos 4 queries paralelas. Postgres devuelve
    // los conteos sin transferir todas las filas a JS (las antiguas findMany sí).
    const businessId = req.user.businessId;

    const [kpiRow, topIngredients] = await Promise.all([
      // KPIs principales en UN solo SELECT con expresiones FILTER
      branchId
        ? prisma.$queryRaw<Array<{
            invisible_loss: number;
            ingredient_waste: number;
            product_waste: number;
            total_sales: number;
            counts_registered: number;
          }>>`
          WITH params AS (SELECT ${branchId}::text AS branch_id)
          SELECT
            COALESCE((
              SELECT SUM(ABS("varianceCost"))::float8
              FROM inventory_counts ic
              WHERE ic."branchId" = (SELECT branch_id FROM params)
                AND ic."varianceCost" < 0
                AND ic."createdAt" BETWEEN ${from} AND ${to}
            ), 0) AS invisible_loss,
            COALESCE((
              SELECT SUM(cost)::float8 FROM waste_logs w
              WHERE w."branchId" = (SELECT branch_id FROM params)
                AND w.type::text = 'INGREDIENT'
                AND w."createdAt" BETWEEN ${from} AND ${to}
            ), 0) AS ingredient_waste,
            COALESCE((
              SELECT SUM(cost)::float8 FROM waste_logs w
              WHERE w."branchId" = (SELECT branch_id FROM params)
                AND w.type::text = 'PRODUCT'
                AND w."createdAt" BETWEEN ${from} AND ${to}
            ), 0) AS product_waste,
            COALESCE((
              SELECT SUM(total)::float8 FROM sales s
              WHERE s."branchId" = (SELECT branch_id FROM params)
                AND s."createdAt" BETWEEN ${from} AND ${to}
            ), 0) AS total_sales,
            COALESCE((
              SELECT COUNT(*)::int FROM inventory_counts ic
              WHERE ic."branchId" = (SELECT branch_id FROM params)
                AND ic."createdAt" BETWEEN ${from} AND ${to}
            ), 0) AS counts_registered
        `
        : prisma.$queryRaw<Array<{
            invisible_loss: number;
            ingredient_waste: number;
            product_waste: number;
            total_sales: number;
            counts_registered: number;
          }>>`
          WITH params AS (SELECT ${businessId}::text AS business_id)
          SELECT
            COALESCE((
              SELECT SUM(ABS(ic."varianceCost"))::float8
              FROM inventory_counts ic
              INNER JOIN branches b ON b.id = ic."branchId"
              WHERE b."businessId" = (SELECT business_id FROM params)
                AND ic."varianceCost" < 0
                AND ic."createdAt" BETWEEN ${from} AND ${to}
            ), 0) AS invisible_loss,
            COALESCE((
              SELECT SUM(w.cost)::float8 FROM waste_logs w
              INNER JOIN branches b ON b.id = w."branchId"
              WHERE b."businessId" = (SELECT business_id FROM params)
                AND w.type::text = 'INGREDIENT'
                AND w."createdAt" BETWEEN ${from} AND ${to}
            ), 0) AS ingredient_waste,
            COALESCE((
              SELECT SUM(w.cost)::float8 FROM waste_logs w
              INNER JOIN branches b ON b.id = w."branchId"
              WHERE b."businessId" = (SELECT business_id FROM params)
                AND w.type::text = 'PRODUCT'
                AND w."createdAt" BETWEEN ${from} AND ${to}
            ), 0) AS product_waste,
            COALESCE((
              SELECT SUM(s.total)::float8 FROM sales s
              INNER JOIN branches b ON b.id = s."branchId"
              WHERE b."businessId" = (SELECT business_id FROM params)
                AND s."createdAt" BETWEEN ${from} AND ${to}
            ), 0) AS total_sales,
            COALESCE((
              SELECT COUNT(*)::int FROM inventory_counts ic
              INNER JOIN branches b ON b.id = ic."branchId"
              WHERE b."businessId" = (SELECT business_id FROM params)
                AND ic."createdAt" BETWEEN ${from} AND ${to}
            ), 0) AS counts_registered
        `,
      // Top 5 insumos con mayor merma — agregación + motivo principal en SQL
      branchId
        ? prisma.$queryRaw<Array<{ name: string; quantity: number; cost: number; main_reason: string }>>`
          SELECT
            i.name,
            SUM(w.quantity)::float8 AS quantity,
            SUM(w.cost)::float8 AS cost,
            (
              SELECT reason::text FROM waste_logs w2
              WHERE w2."ingredientId" = i.id
                AND w2."branchId" = ${branchId}                AND w2."createdAt" BETWEEN ${from} AND ${to}
              GROUP BY reason
              ORDER BY COUNT(*) DESC
              LIMIT 1
            ) AS main_reason
          FROM waste_logs w
          INNER JOIN ingredients i ON i.id = w."ingredientId"
          WHERE w."branchId" = ${branchId}            AND w.type::text = 'INGREDIENT'
            AND w."createdAt" BETWEEN ${from} AND ${to}
          GROUP BY i.id, i.name
          ORDER BY cost DESC
          LIMIT 5
        `
        : prisma.$queryRaw<Array<{ name: string; quantity: number; cost: number; main_reason: string }>>`
          SELECT
            i.name,
            SUM(w.quantity)::float8 AS quantity,
            SUM(w.cost)::float8 AS cost,
            (
              SELECT reason::text FROM waste_logs w2
              INNER JOIN branches b2 ON b2.id = w2."branchId"
              WHERE w2."ingredientId" = i.id
                AND b2."businessId" = ${businessId}                AND w2."createdAt" BETWEEN ${from} AND ${to}
              GROUP BY reason
              ORDER BY COUNT(*) DESC
              LIMIT 1
            ) AS main_reason
          FROM waste_logs w
          INNER JOIN branches b ON b.id = w."branchId"
          INNER JOIN ingredients i ON i.id = w."ingredientId"
          WHERE b."businessId" = ${businessId}            AND w.type::text = 'INGREDIENT'
            AND w."createdAt" BETWEEN ${from} AND ${to}
          GROUP BY i.id, i.name
          ORDER BY cost DESC
          LIMIT 5
        `,
    ]);

    const k = kpiRow[0] ?? { invisible_loss: 0, ingredient_waste: 0, product_waste: 0, total_sales: 0, counts_registered: 0 };
    const totalWasteCost = k.ingredient_waste + k.product_waste;
    const wastePercent = k.total_sales > 0 ? (totalWasteCost / k.total_sales) * 100 : 0;

    return ok(res, {
      kpis: {
        invisibleLoss: Math.round(k.invisible_loss * 100) / 100,
        wastePercent: Math.round(wastePercent * 100) / 100,
        totalWasteCost: Math.round(totalWasteCost * 100) / 100,
        ingredientWasteCost: Math.round(k.ingredient_waste * 100) / 100,
        productWasteCost: Math.round(k.product_waste * 100) / 100,
        totalSales: Math.round(k.total_sales * 100) / 100,
        countsRegistered: k.counts_registered,
      },
      topIngredients: topIngredients.map((t) => ({
        name: t.name,
        quantity: t.quantity,
        cost: t.cost,
        mainReason: t.main_reason,
      })),
      period: { from, to, filter },
    });
  } catch (e) {
    console.error('[production/waste-kpis]', e);
    return serverError(res);
  }
});

export default router;
