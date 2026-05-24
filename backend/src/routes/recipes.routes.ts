import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma.service';
import { roles } from '../middleware/role.middleware';
import { withCache, invalidatePaths } from '../middleware/response-cache.middleware';
import { AuthRequest } from '../types';
import { ok, created, badRequest, notFound, serverError, planLimitReached } from '../utils/response';
import { assertWithinLimit, PlanLimitError } from '../config/plans';

const RECIPE_INVALIDATION = ['/api/recipes', '/api/dashboard'];

const router = Router();

const recipeItemSchema = z.object({
  ingredientId: z.string().uuid(),
  quantity: z.number().positive('Cantidad debe ser positiva'),
});

const recipeBaseFields = {
  name: z.string().min(1),
  category: z.enum(['PANADERIA', 'PASTELERIA', 'BEBIDAS', 'OTROS']),
  salePrice: z.number().positive(),
  imageUrl: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  isResale: z.boolean().optional().default(false),
  purchaseCost: z.number().nonnegative().optional().nullable(),
  initialStock: z.number().int().nonnegative().optional(),
  items: z.array(recipeItemSchema).optional().default([]),
};

// Schema para crear (estricto, con validación cruzada)
const recipeCreateSchema = z
  .object(recipeBaseFields)
  .refine(
    (d) => d.isResale || d.items.length > 0,
    { message: 'Una receta fabricada necesita al menos un insumo en el BOM', path: ['items'] }
  )
  .refine(
    (d) => !d.isResale || (typeof d.purchaseCost === 'number' && d.purchaseCost >= 0),
    { message: 'Producto de reventa requiere costo de compra', path: ['purchaseCost'] }
  );

// Schema para actualizar (parcial — todos opcionales, sin refines cruzados)
const recipeUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.enum(['PANADERIA', 'PASTELERIA', 'BEBIDAS', 'OTROS']).optional(),
  salePrice: z.number().positive().optional(),
  imageUrl: z.string().url().optional().nullable(),
  description: z.string().optional().nullable(),
  isResale: z.boolean().optional(),
  purchaseCost: z.number().nonnegative().optional().nullable(),
  items: z.array(recipeItemSchema).optional(),
});

// ─── Función helper: calcular costo BOM ──────────────────────────────────────
async function calculateBomCost(
  items: { ingredientId: string; quantity: number }[]
): Promise<number> {
  const ingredientIds = items.map((i) => i.ingredientId);
  const ingredients = await prisma.ingredient.findMany({
    where: { id: { in: ingredientIds } },
    select: { id: true, unitCost: true },
  });

  const costMap = new Map(ingredients.map((ing) => [ing.id, ing.unitCost]));

  return items.reduce((total, item) => {
    const cost = costMap.get(item.ingredientId) ?? 0;
    return total + item.quantity * cost;
  }, 0);
}

// ─── GET /api/recipes ─────────────────────────────────────────────────────────
// OWNER en vista global → recetas de todas las sucursales del business.
// Optimizado: $queryRaw con json_agg para devolver recetas + items + ingredient
// en UNA sola consulta SQL. Reemplaza Prisma findMany con joins → 10x más rápido.
interface RecipeRow {
  id: string;
  branchId: string;
  name: string;
  category: string;
  salePrice: number;
  stock: number;
  imageUrl: string | null;
  description: string | null;
  isActive: boolean;
  isResale: boolean;
  purchaseCost: number | null;
  createdAt: Date;
  updatedAt: Date;
  branch_id: string | null;
  branch_name: string | null;
  items: Array<{
    id: string;
    recipeId: string;
    ingredientId: string;
    quantity: number;
    ingredient: {
      id: string;
      name: string;
      unit: string;
      unitCost: number;
      stock: number;
    };
  }>;
}

router.get('/', withCache(), async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branchId;
    const includeBranch = !branchId;

    const rows = branchId
      ? await prisma.$queryRaw<RecipeRow[]>`
          SELECT r.id, r."branchId", r.name, r.category::text, r."salePrice", r.stock,
                 r."imageUrl", r.description, r."isActive", r."isResale", r."purchaseCost",
                 r."createdAt", r."updatedAt",
                 NULL::text AS branch_id, NULL::text AS branch_name,
                 COALESCE(json_agg(
                   json_build_object(
                     'id', ri.id,
                     'recipeId', ri."recipeId",
                     'ingredientId', ri."ingredientId",
                     'quantity', ri.quantity,
                     'ingredient', json_build_object(
                       'id', i.id, 'name', i.name, 'unit', i.unit::text,
                       'unitCost', i."unitCost", 'stock', i.stock
                     )
                   )
                 ) FILTER (WHERE ri.id IS NOT NULL), '[]'::json) AS items
          FROM recipes r
          LEFT JOIN recipe_items ri ON ri."recipeId" = r.id
          LEFT JOIN ingredients i ON i.id = ri."ingredientId"
          WHERE r."branchId" = ${branchId} AND r."isActive" = true
          GROUP BY r.id
          ORDER BY r.name ASC
        `
      : await prisma.$queryRaw<RecipeRow[]>`
          SELECT r.id, r."branchId", r.name, r.category::text, r."salePrice", r.stock,
                 r."imageUrl", r.description, r."isActive", r."isResale", r."purchaseCost",
                 r."createdAt", r."updatedAt",
                 b.id AS branch_id, b.name AS branch_name,
                 COALESCE(json_agg(
                   json_build_object(
                     'id', ri.id,
                     'recipeId', ri."recipeId",
                     'ingredientId', ri."ingredientId",
                     'quantity', ri.quantity,
                     'ingredient', json_build_object(
                       'id', i.id, 'name', i.name, 'unit', i.unit::text,
                       'unitCost', i."unitCost", 'stock', i.stock
                     )
                   )
                 ) FILTER (WHERE ri.id IS NOT NULL), '[]'::json) AS items
          FROM recipes r
          INNER JOIN branches b ON b.id = r."branchId"
          LEFT JOIN recipe_items ri ON ri."recipeId" = r.id
          LEFT JOIN ingredients i ON i.id = ri."ingredientId"
          WHERE b."businessId" = ${req.user.businessId} AND r."isActive" = true
          GROUP BY r.id, b.id
          ORDER BY r.name ASC
        `;

    // Enriquecer con costo BOM, margen y disponibilidad en una sola pasada O(n)
    const enriched = rows.map((r) => {
      let bomCost = 0;
      let producible = 0;

      if (r.isResale) {
        // Producto de reventa: el costo unitario es lo que pagamos por unidad.
        // No hay "producible" (no se fabrica) — el stock se mete con compras.
        bomCost = r.purchaseCost ?? 0;
      } else {
        // Producto fabricado: bomCost = suma de los componentes del BOM.
        let prod = r.items.length === 0 ? 0 : Number.POSITIVE_INFINITY;
        for (const it of r.items) {
          bomCost += it.quantity * it.ingredient.unitCost;
          if (it.quantity > 0) {
            const possible = Math.floor(it.ingredient.stock / it.quantity);
            if (possible < prod) prod = possible;
          }
        }
        producible = prod === Number.POSITIVE_INFINITY ? 0 : prod;
      }

      const margin = r.salePrice > 0 ? ((r.salePrice - bomCost) / r.salePrice) * 100 : 0;

      return {
        id: r.id,
        branchId: r.branchId,
        name: r.name,
        category: r.category,
        salePrice: r.salePrice,
        stock: r.stock,
        imageUrl: r.imageUrl,
        description: r.description,
        isActive: r.isActive,
        isResale: r.isResale,
        purchaseCost: r.purchaseCost,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        items: r.items,
        bomCost,
        margin: Math.round(margin * 100) / 100,
        isAvailable: r.stock > 0,
        producible,
        ...(includeBranch && r.branch_id
          ? { branch: { id: r.branch_id, name: r.branch_name } }
          : {}),
      };
    });

    return ok(res, enriched);
  } catch (e) {
    console.error('[recipes/list]', e);
    return serverError(res);
  }
});

// ─── POST /api/recipes ────────────────────────────────────────────────────────
router.post('/', roles.ownerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branchId;
    if (!branchId) {
      return badRequest(
        res,
        'Selecciona una sucursal específica para crear una receta.'
      );
    }

    const parsed = recipeCreateSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const { items, initialStock, isResale, purchaseCost, ...recipeData } = parsed.data;

    // Validar límite del plan antes de crear producto
    await assertWithinLimit(req.user.businessId, 'recipes');

    const recipe = await prisma.recipe.create({
      data: {
        ...recipeData,
        branchId,
        isResale,
        purchaseCost: isResale ? purchaseCost ?? 0 : null,
        // Si es reventa, ponemos el stock inicial directamente. Si es fabricado,
        // el stock siempre arranca en 0 (se incrementa con Production).
        stock: isResale ? (initialStock ?? 0) : 0,
        items: isResale ? undefined : { create: items },
      },
      include: { items: { include: { ingredient: true } } },
    });

    invalidatePaths(...RECIPE_INVALIDATION);
    return created(res, recipe, 'Receta creada');
  } catch (e) {
    if (e instanceof PlanLimitError) {
      return planLimitReached(res, e.message, {
        resource: e.resource,
        plan: e.plan,
        currentUsage: e.currentUsage,
        limit: e.limit,
      });
    }
    console.error('[recipes/create]', e);
    return serverError(res);
  }
});

// ─── PUT /api/recipes/:id ─────────────────────────────────────────────────────
router.put('/:id', roles.ownerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const branchId = req.branchId;

    const existing = branchId
      ? await prisma.recipe.findFirst({ where: { id, branchId } })
      : await prisma.recipe.findFirst({
          where: { id, branch: { businessId: req.user.businessId } },
        });
    if (!existing) return notFound(res, 'Receta no encontrada');

    const parsed = recipeUpdateSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const { items, isResale, purchaseCost, ...recipeData } = parsed.data;

    // Si el flag cambia o ya es reventa, ajustar purchaseCost / items en consecuencia
    const finalIsResale = isResale ?? existing.isResale;

    const recipe = await prisma.recipe.update({
      where: { id },
      data: {
        ...recipeData,
        ...(isResale !== undefined && { isResale }),
        ...(purchaseCost !== undefined && { purchaseCost: finalIsResale ? purchaseCost : null }),
        ...(items && !finalIsResale && {
          items: {
            deleteMany: {},
            create: items,
          },
        }),
        // Si se está marcando como reventa, limpiar el BOM heredado
        ...(isResale === true && { items: { deleteMany: {} } }),
      },
      include: { items: { include: { ingredient: true } } },
    });

    invalidatePaths(...RECIPE_INVALIDATION);
    return ok(res, recipe, 'Receta actualizada');
  } catch (e) {
    console.error('[recipes/update]', e);
    return serverError(res);
  }
});

// ─── DELETE /api/recipes/:id ──────────────────────────────────────────────────
router.delete('/:id', roles.ownerOrManager, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const branchId = req.branchId;

    const existing = branchId
      ? await prisma.recipe.findFirst({ where: { id, branchId } })
      : await prisma.recipe.findFirst({
          where: { id, branch: { businessId: req.user.businessId } },
        });
    if (!existing) return notFound(res, 'Receta no encontrada');

    // Soft delete
    await prisma.recipe.update({ where: { id }, data: { isActive: false } });
    invalidatePaths(...RECIPE_INVALIDATION);
    return ok(res, null, 'Receta eliminada');
  } catch {
    return serverError(res);
  }
});

export default router;
