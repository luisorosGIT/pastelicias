import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma.service';
import { roles } from '../middleware/role.middleware';
import { withCache, invalidatePaths } from '../middleware/response-cache.middleware';
import { AuthRequest } from '../types';
import { ok, created, badRequest, notFound, serverError, planLimitReached } from '../utils/response';
import { assertWithinLimit, PlanLimitError } from '../config/plans';

// Mutaciones de inventario afectan estos endpoints:
const INVENTORY_INVALIDATION = ['/api/inventory', '/api/recipes', '/api/dashboard', '/api/production'];

const router = Router();

// ─── Schema de validación ─────────────────────────────────────────────────────
const ingredientSchema = z.object({
  name: z.string().min(1, 'Nombre requerido'),
  unit: z.enum(['KG', 'G', 'L', 'ML', 'UNIT']),
  presentationSize: z.number().positive('Tamaño de presentación debe ser positivo'),
  stock: z.number().min(0).default(0),
  minStock: z.number().min(0, 'Stock mínimo no puede ser negativo'),
  unitCost: z.number().positive('Costo unitario debe ser positivo'),
});

const REQUIRE_BRANCH_MSG =
  'Selecciona una sucursal específica para esta operación. Cada insumo pertenece a una sucursal.';

// ─── GET /api/inventory ───────────────────────────────────────────────────────
// OWNER en vista global (sin branchId) → ve insumos de TODAS las sucursales del business.
// Otros roles (o OWNER con sucursal seleccionada) → solo esa sucursal.
//
// Optimizado: usa $queryRaw para enviar UNA sola sentencia SQL en vez del
// patrón BEGIN+SELECT+DEALLOCATE+COMMIT que Prisma genera para findMany.
// Esto baja de ~4 round-trips a 1. En Lima ↔ us-west-1 (~200ms RTT) eso son
// ~600ms menos por request en frío.
interface IngredientRow {
  id: string;
  name: string;
  unit: string;
  presentationSize: number;
  stock: number;
  minStock: number;
  unitCost: number;
  branchId: string;
  createdAt: Date;
  updatedAt: Date;
  branch_id: string | null;
  branch_name: string | null;
}

router.get('/', roles.noSeller, withCache(), async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branchId; // '' = vista global de OWNER
    const includeBranch = !branchId;

    const rows = branchId
      ? await prisma.$queryRaw<IngredientRow[]>`
          SELECT i.id, i.name, i.unit::text, i."presentationSize", i.stock,
                 i."minStock", i."unitCost", i."branchId",
                 i."createdAt", i."updatedAt",
                 NULL::text AS branch_id, NULL::text AS branch_name
          FROM ingredients i
          WHERE i."branchId" = ${branchId}          ORDER BY i.name ASC
        `
      : await prisma.$queryRaw<IngredientRow[]>`
          SELECT i.id, i.name, i.unit::text, i."presentationSize", i.stock,
                 i."minStock", i."unitCost", i."branchId",
                 i."createdAt", i."updatedAt",
                 b.id AS branch_id, b.name AS branch_name
          FROM ingredients i
          INNER JOIN branches b ON b.id = i."branchId"
          WHERE b."businessId" = ${req.user.businessId}          ORDER BY i.name ASC
        `;

    // Acumular KPIs en una sola pasada (en vez de 3 map/filter/reduce separados).
    let totalValue = 0;
    let criticalCount = 0;
    const data = new Array(rows.length);
    for (let idx = 0; idx < rows.length; idx++) {
      const r = rows[idx];
      const tv = r.stock * r.unitCost;
      const critical = r.stock <= r.minStock;
      totalValue += tv;
      if (critical) criticalCount++;
      data[idx] = {
        id: r.id,
        name: r.name,
        unit: r.unit,
        presentationSize: r.presentationSize,
        stock: r.stock,
        minStock: r.minStock,
        unitCost: r.unitCost,
        branchId: r.branchId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        totalPresentations: Math.floor(r.stock / r.presentationSize),
        isCritical: critical,
        totalValue: tv,
        ...(includeBranch && r.branch_id
          ? { branch: { id: r.branch_id, name: r.branch_name } }
          : {}),
      };
    }

    return ok(res, {
      ingredients: data,
      kpis: { totalValue, criticalCount, total: data.length },
    });
  } catch (e) {
    console.error('[inventory/list]', e);
    return serverError(res);
  }
});

// ─── POST /api/inventory ──────────────────────────────────────────────────────
router.post('/', roles.noSeller, async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branchId;
    if (!branchId) return badRequest(res, REQUIRE_BRANCH_MSG);

    // Verificar que la sucursal pertenece al business del usuario (defensa en profundidad)
    const branch = await prisma.branch.findFirst({
      where: { id: branchId, businessId: req.user.businessId },
      select: { id: true },
    });
    if (!branch) return badRequest(res, 'Sucursal no válida');

    const parsed = ingredientSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    // Validar límite del plan antes de crear
    await assertWithinLimit(req.user.businessId, 'ingredients');

    const ingredient = await prisma.ingredient.create({
      data: { ...parsed.data, branchId },
    });

    invalidatePaths(...INVENTORY_INVALIDATION);
    return created(res, ingredient, 'Insumo creado correctamente');
  } catch (e) {
    if (e instanceof PlanLimitError) {
      return planLimitReached(res, e.message, {
        resource: e.resource,
        plan: e.plan,
        currentUsage: e.currentUsage,
        limit: e.limit,
      });
    }
    console.error('[inventory/create]', e);
    return serverError(res);
  }
});

// ─── PUT /api/inventory/:id ───────────────────────────────────────────────────
router.put('/:id', roles.noSeller, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const branchId = req.branchId;

    // OWNER en vista global puede editar cualquier insumo de su business; otros solo su sucursal.
    const existing = branchId
      ? await prisma.ingredient.findFirst({ where: { id, branchId } })
      : await prisma.ingredient.findFirst({
          where: { id, branch: { businessId: req.user.businessId } },
        });
    if (!existing) return notFound(res, 'Insumo no encontrado');

    const parsed = ingredientSchema.partial().safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const updated = await prisma.ingredient.update({ where: { id }, data: parsed.data });
    invalidatePaths(...INVENTORY_INVALIDATION);
    return ok(res, updated, 'Insumo actualizado');
  } catch (e) {
    console.error('[inventory/update]', e);
    return serverError(res);
  }
});

// ─── DELETE /api/inventory/:id ────────────────────────────────────────────────
router.delete('/:id', roles.noSeller, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const branchId = req.branchId;

    const existing = branchId
      ? await prisma.ingredient.findFirst({ where: { id, branchId } })
      : await prisma.ingredient.findFirst({
          where: { id, branch: { businessId: req.user.businessId } },
        });
    if (!existing) return notFound(res, 'Insumo no encontrado');

    await prisma.ingredient.delete({ where: { id } });
    invalidatePaths(...INVENTORY_INVALIDATION);
    return ok(res, null, 'Insumo eliminado');
  } catch (e) {
    console.error('[inventory/delete]', e);
    return serverError(res);
  }
});

// ─── GET /api/inventory/critical ─────────────────────────────────────────────
router.get('/critical', roles.noSeller, withCache(), async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branchId;

    const where = branchId
      ? { branchId }
      : { branch: { businessId: req.user.businessId } };

    const all = await prisma.ingredient.findMany({ where });
    const critical = all
      .filter((i) => i.stock <= i.minStock)
      .sort((a, b) => a.stock / Math.max(0.0001, a.minStock) - b.stock / Math.max(0.0001, b.minStock));

    return ok(res, critical);
  } catch (e) {
    console.error('[inventory/critical]', e);
    return serverError(res);
  }
});

export default router;
