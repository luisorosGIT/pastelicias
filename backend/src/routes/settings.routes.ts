import { Router, Response } from 'express';
import { z } from 'zod';
import { createClient } from '@supabase/supabase-js';
import prisma from '../services/prisma.service';
import { roles } from '../middleware/role.middleware';
import { invalidateAuthCacheForUser } from '../middleware/auth.middleware';
import { withCache, invalidatePaths } from '../middleware/response-cache.middleware';
import { AuthRequest } from '../types';
import { ok, created, badRequest, notFound, serverError, planLimitReached } from '../utils/response';
import {
  assertWithinLimit,
  countResource,
  PLAN_LIMITS,
  PLAN_LABEL,
  PLAN_PRICE_PEN,
  PlanLimitError,
  isTrialExpired,
  trialDaysRemaining,
} from '../config/plans';
import { invalidateTrialCache } from '../middleware/trial.middleware';
import { Plan } from '@prisma/client';

const router = Router();

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// ─── Schemas ──────────────────────────────────────────────────────────────────
const branchSchema = z.object({
  name: z.string().min(1),
  address: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

const businessSchema = z.object({
  name: z.string().min(1),
  ruc: z.string().optional().nullable(),
  taxRate: z.number().min(0).max(100),
  hideIngredientCosts: z.boolean().optional(),
  allowBulkInventoryEdit: z.boolean().optional(),
  // URL del logo. Si llega "" lo guardamos como null para limpiar.
  logoUrl: z
    .string()
    .url('logoUrl debe ser una URL válida')
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
});

const inviteUserSchema = z.object({
  email: z.string().email(),
  fullName: z.string().min(1),
  password: z.string().min(8),
  role: z.enum(['OWNER', 'MANAGER', 'SELLER', 'INVENTORY']),
  branchId: z.string().uuid().optional().nullable(),
});

const updateUserSchema = z.object({
  fullName: z.string().min(1).optional(),
  role: z.enum(['OWNER', 'MANAGER', 'SELLER', 'INVENTORY']).optional(),
  branchId: z.string().uuid().nullable().optional(),
  isActive: z.boolean().optional(),
});

// ─── GET /api/settings/bootstrap ──────────────────────────────────────────────
// Devuelve branches + business + users en 1 sola request. Las 3 queries corren
// en paralelo, así la página Settings carga ~3x más rápido que antes (1 ida
// por la red en lugar de 3).
router.get('/bootstrap', roles.ownerOnly, withCache(60_000), async (req: AuthRequest, res: Response) => {
  try {
    const [branches, business, users] = await Promise.all([
      // Solo sucursales activas. Las inactivas son leftover del viejo soft-delete
      // y se ocultan de la UI; el DELETE ahora es hard-delete.
      prisma.branch.findMany({
        where: { businessId: req.user.businessId, isActive: true },
        orderBy: { name: 'asc' },
      }),
      prisma.business.findUnique({ where: { id: req.user.businessId } }),
      prisma.user.findMany({
        where: { businessId: req.user.businessId },
        include: { branch: { select: { name: true } } },
        orderBy: { fullName: 'asc' },
        relationLoadStrategy: 'join',
      }),
    ]);
    return ok(res, { branches, business, users });
  } catch (e) {
    console.error('[settings/bootstrap]', e);
    return serverError(res);
  }
});

// ─── GET /api/settings/branches ───────────────────────────────────────────────
// Solo devuelve sucursales activas. Las inactivas son residuos del viejo
// soft-delete y se ocultan de la UI.
router.get('/branches', roles.ownerOnly, withCache(60_000), async (req: AuthRequest, res: Response) => {
  try {
    const branches = await prisma.branch.findMany({
      where: { businessId: req.user.businessId, isActive: true },
      orderBy: { name: 'asc' },
    });
    return ok(res, branches);
  } catch {
    return serverError(res);
  }
});

// ─── POST /api/settings/branches ─────────────────────────────────────────────
router.post('/branches', roles.ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = branchSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    // Validar límite del plan antes de crear
    await assertWithinLimit(req.user.businessId, 'branches');

    const branch = await prisma.branch.create({
      data: { ...parsed.data, businessId: req.user.businessId },
    });
    invalidatePaths('/api/settings');
    return created(res, branch, 'Sucursal creada');
  } catch (e) {
    if (e instanceof PlanLimitError) {
      return planLimitReached(res, e.message, {
        resource: e.resource,
        plan: e.plan,
        currentUsage: e.currentUsage,
        limit: e.limit,
      });
    }
    console.error('[settings/create-branch]', e);
    return serverError(res);
  }
});

// ─── PUT /api/settings/branches/:id ──────────────────────────────────────────
router.put('/branches/:id', roles.ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await prisma.branch.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!existing) return notFound(res, 'Sucursal no encontrada');

    const parsed = branchSchema.partial().safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const updated = await prisma.branch.update({ where: { id: req.params.id }, data: parsed.data });
    invalidatePaths('/api/settings');
    return ok(res, updated);
  } catch {
    return serverError(res);
  }
});

// ─── DELETE /api/settings/branches/:id ──────────────────────────────────────
// HARD DELETE: elimina la sucursal y TODA su data asociada de la base de datos
// (ventas, mermas, producciones, productos, insumos, conteos, compras, reservaciones).
// Los USUARIOS NO se eliminan — se desvinculan poniendo `branchId = null`.
//
// ⚠️ Esta acción es irreversible. El frontend muestra un confirm dialog explícito.
//
// Reglas de protección:
//   - Debe pertenecer al business del usuario.
//   - No se puede borrar la ÚLTIMA sucursal del business (debe quedar al menos una).
router.delete('/branches/:id', roles.ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const businessId = req.user.businessId;

    const existing = await prisma.branch.findFirst({
      where: { id, businessId },
    });
    if (!existing) return notFound(res, 'Sucursal no encontrada');

    // Verificar que no sea la única sucursal del negocio
    const totalCount = await prisma.branch.count({
      where: { businessId },
    });
    if (totalCount <= 1) {
      return badRequest(
        res,
        'No puedes eliminar la única sucursal del negocio. Crea otra primero.'
      );
    }

    // Transacción de borrado en cascada manual (orden estricto por FKs):
    //   1. sales → cascada elimina saleItems
    //   2. wasteLogs (referencia branch + opcionalmente ingredient/recipe)
    //   3. productions (referencia branch + recipe)
    //   4. reservations (referencia branch + recipe — debe ir ANTES de recipes)
    //   5. recipes → cascada elimina recipeItems
    //   6. inventoryCounts (referencia branch + ingredient)
    //   7. purchases (referencia branch + ingredient)
    //   8. ingredients
    //   9. desvincular users (branchId = null, NO se eliminan)
    //  10. eliminar la branch
    await prisma.$transaction(
      async (tx) => {
        await tx.sale.deleteMany({ where: { branchId: id } });
        await tx.wasteLog.deleteMany({ where: { branchId: id } });
        await tx.production.deleteMany({ where: { branchId: id } });
        await tx.reservation.deleteMany({ where: { branchId: id } });
        await tx.recipe.deleteMany({ where: { branchId: id } });
        await tx.inventoryCount.deleteMany({ where: { branchId: id } });
        await tx.purchase.deleteMany({ where: { branchId: id } });
        await tx.ingredient.deleteMany({ where: { branchId: id } });
        await tx.user.updateMany({ where: { branchId: id }, data: { branchId: null } });
        await tx.branch.delete({ where: { id } });
      },
      { timeout: 30000, maxWait: 10000 }
    );

    invalidatePaths('/api/settings', '/api/inventory', '/api/recipes', '/api/sales', '/api/production', '/api/dashboard', '/api/reports', '/api/reservations');
    return ok(res, { id }, `Sucursal "${existing.name}" eliminada permanentemente.`);
  } catch (e) {
    console.error('[settings/delete-branch]', e);
    return serverError(res);
  }
});

// ─── GET /api/settings/business ──────────────────────────────────────────────
// Accesible para todos los roles autenticados (POS necesita la tasa de IGV).
router.get('/business', roles.all, withCache(60_000), async (req: AuthRequest, res: Response) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.user.businessId },
    });
    if (!business) return notFound(res, 'Negocio no encontrado');
    return ok(res, business);
  } catch {
    return serverError(res);
  }
});

// ─── GET /api/settings/plan ──────────────────────────────────────────────────
// Devuelve el plan actual del business + límites + uso de cada recurso.
// El frontend usa esto para pintar progress bars y deshabilitar acciones.
router.get('/plan', roles.ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.user.businessId },
      select: { plan: true, trialEndsAt: true },
    });
    if (!business) return notFound(res, 'Negocio no encontrado');

    const plan = business.plan;
    const limits = PLAN_LIMITS[plan];

    // Contar el uso de los 4 recursos limitados en paralelo
    const [branches, ingredients, recipes, users] = await Promise.all([
      countResource(req.user.businessId, 'branches'),
      countResource(req.user.businessId, 'ingredients'),
      countResource(req.user.businessId, 'recipes'),
      countResource(req.user.businessId, 'users'),
    ]);

    // `Infinity` no es JSON-serializable → enviamos null para "ilimitado"
    const serializeLimit = (n: number) => (n === Infinity ? null : n);

    return ok(res, {
      plan,
      label: PLAN_LABEL[plan],
      priceMonthlyPen: PLAN_PRICE_PEN[plan],
      // Estado del periodo de prueba.
      trialEndsAt: business.trialEndsAt ? business.trialEndsAt.toISOString() : null,
      trialDaysRemaining: trialDaysRemaining(business),
      trialExpired: isTrialExpired(business),
      limits: {
        branches: serializeLimit(limits.branches),
        ingredients: serializeLimit(limits.ingredients),
        recipes: serializeLimit(limits.recipes),
        users: serializeLimit(limits.users),
      },
      usage: { branches, ingredients, recipes, users },
      // Catálogo completo de planes (para mostrar comparativa en página de upgrade)
      allPlans: (['FREE', 'PRO', 'BUSINESS'] as Plan[]).map((p) => ({
        plan: p,
        label: PLAN_LABEL[p],
        priceMonthlyPen: PLAN_PRICE_PEN[p],
        limits: {
          branches: serializeLimit(PLAN_LIMITS[p].branches),
          ingredients: serializeLimit(PLAN_LIMITS[p].ingredients),
          recipes: serializeLimit(PLAN_LIMITS[p].recipes),
          users: serializeLimit(PLAN_LIMITS[p].users),
        },
      })),
    });
  } catch (e) {
    console.error('[settings/plan]', e);
    return serverError(res);
  }
});

// ─── POST /api/settings/upgrade ──────────────────────────────────────────────
// MOCK: cambia el plan sin cobrar. En Fase 3 lo reemplazaremos con un webhook
// de la pasarela de pago (Culqi/Stripe).
//
// Antes de bajar de plan, verifica que el uso actual quepa dentro de los
// nuevos límites — si no, rechaza con explicación clara.
const upgradeSchema = z.object({
  plan: z.enum(['FREE', 'PRO', 'BUSINESS']),
});

router.post('/upgrade', roles.ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = upgradeSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const newPlan = parsed.data.plan;

    // Si está bajando de plan, validar que el uso quepa en los nuevos límites
    const newLimits = PLAN_LIMITS[newPlan];
    const [branches, ingredients, recipes, users] = await Promise.all([
      countResource(req.user.businessId, 'branches'),
      countResource(req.user.businessId, 'ingredients'),
      countResource(req.user.businessId, 'recipes'),
      countResource(req.user.businessId, 'users'),
    ]);
    const checks: Array<[string, number, number]> = [
      ['sucursales', branches, newLimits.branches],
      ['insumos', ingredients, newLimits.ingredients],
      ['productos', recipes, newLimits.recipes],
      ['usuarios', users, newLimits.users],
    ];
    for (const [label, used, max] of checks) {
      if (used > max) {
        return badRequest(
          res,
          `No puedes bajar al plan ${PLAN_LABEL[newPlan]}: tienes ${used} ${label} ` +
          `y el límite es ${max}. Elimina o desactiva primero.`
        );
      }
    }

    // Si pasa a un plan pagado, anular el trial (ya no aplica).
    // Si baja a FREE, le damos 30 días nuevos.
    const newTrialEndsAt =
      newPlan === 'FREE'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : null;

    const updated = await prisma.business.update({
      where: { id: req.user.businessId },
      data: { plan: newPlan, trialEndsAt: newTrialEndsAt },
    });

    invalidatePaths('/api/settings');
    invalidateTrialCache(req.user.businessId);
    return ok(res, updated, `Plan cambiado a ${PLAN_LABEL[newPlan]}`);
  } catch (e) {
    console.error('[settings/upgrade]', e);
    return serverError(res);
  }
});

// ─── POST /api/settings/complete-onboarding ──────────────────────────────────
// Marca el onboardingCompleted del business como true. Llamado al final del
// wizard del frontend. Solo el OWNER puede completarlo (es su tenant).
router.post('/complete-onboarding', roles.ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const updated = await prisma.business.update({
      where: { id: req.user.businessId },
      data: { onboardingCompleted: true },
    });
    invalidatePaths('/api/settings');
    return ok(res, updated, 'Onboarding completado');
  } catch (e) {
    console.error('[settings/complete-onboarding]', e);
    return serverError(res);
  }
});

// ─── PUT /api/settings/business ──────────────────────────────────────────────
router.put('/business', roles.ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = businessSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const updated = await prisma.business.update({
      where: { id: req.user.businessId },
      data: parsed.data,
    });
    // taxRate y hideIngredientCosts afectan inventario y POS también
    invalidatePaths('/api/settings', '/api/inventory', '/api/recipes');
    return ok(res, updated, 'Configuración actualizada');
  } catch {
    return serverError(res);
  }
});

// ─── GET /api/settings/users ──────────────────────────────────────────────────
router.get('/users', roles.ownerOnly, withCache(60_000), async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: { businessId: req.user.businessId },
      include: { branch: { select: { name: true } } },
      orderBy: { fullName: 'asc' },
      relationLoadStrategy: 'join', // 1 query SQL en vez de 2
    });
    return ok(res, users);
  } catch {
    return serverError(res);
  }
});

// ─── POST /api/settings/users/invite ─────────────────────────────────────────
router.post('/users/invite', roles.ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const parsed = inviteUserSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const { email, fullName, password, role, branchId } = parsed.data;

    // Roles distintos a OWNER requieren sucursal
    if (role !== 'OWNER' && !branchId) {
      return badRequest(res, 'La sucursal es obligatoria para este rol');
    }

    // Validar límite del plan antes de crear usuario
    await assertWithinLimit(req.user.businessId, 'users');

    // Crear usuario en Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (authError || !authData.user) {
      return badRequest(res, authError?.message ?? 'Error al crear usuario en Auth');
    }

    // Crear perfil en nuestra DB usando el mismo ID de Supabase
    const user = await prisma.user.create({
      data: {
        id: authData.user.id,
        email,
        fullName,
        role,
        branchId: branchId ?? null,
        businessId: req.user.businessId,
      },
    });

    invalidatePaths('/api/settings');
    return created(res, { id: user.id, email, fullName, role }, 'Usuario invitado');
  } catch (e) {
    if (e instanceof PlanLimitError) {
      return planLimitReached(res, e.message, {
        resource: e.resource,
        plan: e.plan,
        currentUsage: e.currentUsage,
        limit: e.limit,
      });
    }
    console.error('[settings/invite-user]', e);
    return serverError(res);
  }
});

// ─── PUT /api/settings/users/:id ──────────────────────────────────────────────
router.put('/users/:id', roles.ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!user) return notFound(res, 'Usuario no encontrado');

    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const { role, branchId, fullName, isActive } = parsed.data;

    // Si el rol final no es OWNER, exigir branchId (del payload o el existente)
    const effectiveRole = role ?? user.role;
    const effectiveBranchId =
      branchId !== undefined ? branchId : user.branchId;
    if (effectiveRole !== 'OWNER' && !effectiveBranchId) {
      return badRequest(res, 'La sucursal es obligatoria para este rol');
    }

    const updated = await prisma.user.update({
      where: { id: req.params.id },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(role !== undefined && { role }),
        ...(branchId !== undefined && { branchId: effectiveRole === 'OWNER' ? null : branchId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { branch: { select: { id: true, name: true } } },
    });

    // Invalidar cache de auth (rol/sucursal/isActive cambiaron) y de respuestas
    invalidateAuthCacheForUser(req.params.id);
    invalidatePaths('/api/settings');

    return ok(res, updated, 'Usuario actualizado');
  } catch {
    return serverError(res);
  }
});

// ─── DELETE /api/settings/users/:id ──────────────────────────────────────────
router.delete('/users/:id', roles.ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!user) return notFound(res, 'Usuario no encontrado');

    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: false } });
    invalidateAuthCacheForUser(req.params.id);
    invalidatePaths('/api/settings');
    return ok(res, null, 'Usuario desactivado');
  } catch {
    return serverError(res);
  }
});

// ─── POST /api/settings/users/:id/reactivate ─────────────────────────────────
router.post('/users/:id/reactivate', roles.ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const user = await prisma.user.findFirst({
      where: { id: req.params.id, businessId: req.user.businessId },
    });
    if (!user) return notFound(res, 'Usuario no encontrado');

    await prisma.user.update({ where: { id: req.params.id }, data: { isActive: true } });
    invalidateAuthCacheForUser(req.params.id);
    invalidatePaths('/api/settings');
    return ok(res, null, 'Usuario reactivado');
  } catch {
    return serverError(res);
  }
});

export default router;
