import { Router, Request, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../services/prisma.service';
import { adminMiddleware, signAdminToken } from '../middleware/admin.middleware';
import { ok, badRequest, notFound, serverError, created } from '../utils/response';

/**
 * Rutas del panel de administración del SaaS Genimatech.
 *
 * Auth: tabla `admins` con bcrypt + JWT propio con audience='admin'.
 * Separada de la auth normal de los users de business.
 *
 * Estructura:
 *  - /admin/auth/setup  → crea el primer admin si no hay ninguno (público)
 *  - /admin/auth/login  → login con email+password (público)
 *  - /admin/auth/me     → datos del admin autenticado (protegido)
 *  - /admin/dashboard   → KPIs globales del SaaS
 *  - /admin/businesses  → lista con búsqueda + drill-down
 *  - /admin/users       → lista de usuarios totales
 *  - /admin/support/*   → conversaciones del chat de soporte
 */
const router = Router();

// ─── Auth pública ─────────────────────────────────────────────────────────────

const setupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Mínimo 8 caracteres'),
  name: z.string().min(2, 'Nombre requerido'),
});

/** POST /api/admin/auth/setup — bootstrap del primer admin.
 *  Solo funciona si la tabla `admins` está vacía. Después rechaza todo. */
router.post('/auth/setup', async (req: Request, res: Response) => {
  try {
    const parsed = setupSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const count = await prisma.admin.count();
    if (count > 0) {
      return badRequest(
        res,
        'Ya hay un administrador configurado. Usa POST /admin/auth/login para entrar.'
      );
    }

    const { email, password, name } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 12);

    const admin = await prisma.admin.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        name,
        isActive: true,
      },
    });

    const token = signAdminToken({ id: admin.id, email: admin.email, name: admin.name });
    return created(res, {
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name },
    }, 'Administrador creado');
  } catch (e) {
    console.error('[admin/auth/setup]', e);
    return serverError(res);
  }
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/** POST /api/admin/auth/login — entrar con email+password. */
router.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const email = parsed.data.email.toLowerCase().trim();
    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin || !admin.isActive) {
      return badRequest(res, 'Credenciales inválidas');
    }
    const valid = await bcrypt.compare(parsed.data.password, admin.passwordHash);
    if (!valid) return badRequest(res, 'Credenciales inválidas');

    // Actualizar lastLoginAt — fire-and-forget
    prisma.admin.update({
      where: { id: admin.id },
      data: { lastLoginAt: new Date() },
    }).catch(() => {});

    const token = signAdminToken({ id: admin.id, email: admin.email, name: admin.name });
    return ok(res, {
      token,
      admin: { id: admin.id, email: admin.email, name: admin.name },
    }, 'Sesión iniciada');
  } catch (e) {
    console.error('[admin/auth/login]', e);
    return serverError(res);
  }
});

// ─── Rutas protegidas (todas requieren adminMiddleware) ─────────────────────

router.use(adminMiddleware);

router.get('/auth/me', (req: Request, res: Response) => {
  return ok(res, req.admin);
});

// ─── Dashboard: KPIs globales ──────────────────────────────────────────────
router.get('/dashboard', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last7  = new Date(now.getTime() - 7  * 24 * 60 * 60 * 1000);

    const [
      totalBusinesses,
      activeBusinesses,
      newBusinesses30d,
      newBusinesses7d,
      planBreakdown,
      totalUsers,
      totalBranches,
      totalSales,
      sales30d,
      sales7d,
      openConversations,
      unreadAdminMessages,
    ] = await Promise.all([
      prisma.business.count(),
      // Activos: con onboarding completo Y al menos un user activo
      prisma.business.count({ where: { onboardingCompleted: true } }),
      prisma.business.count({ where: { createdAt: { gte: last30 } } }),
      prisma.business.count({ where: { createdAt: { gte: last7 } } }),
      prisma.business.groupBy({
        by: ['plan'],
        _count: { _all: true },
      }),
      prisma.user.count({ where: { isActive: true } }),
      prisma.branch.count({ where: { isActive: true } }),
      prisma.sale.count(),
      prisma.sale.aggregate({
        _sum: { total: true },
        _count: { _all: true },
        where: { createdAt: { gte: last30 } },
      }),
      prisma.sale.aggregate({
        _sum: { total: true },
        _count: { _all: true },
        where: { createdAt: { gte: last7 } },
      }),
      prisma.supportConversation.count({ where: { status: 'OPEN' } }),
      prisma.supportMessage.count({
        where: { senderRole: 'USER', isReadByAdmin: false },
      }),
    ]);

    const plans = { FREE: 0, PRO: 0, BUSINESS: 0 };
    for (const row of planBreakdown) {
      plans[row.plan] = row._count._all;
    }

    return ok(res, {
      businesses: {
        total: totalBusinesses,
        active: activeBusinesses,
        new30d: newBusinesses30d,
        new7d: newBusinesses7d,
        byPlan: plans,
      },
      users: { total: totalUsers, branches: totalBranches },
      sales: {
        total: totalSales,
        last30d: {
          count: sales30d._count._all ?? 0,
          revenue: sales30d._sum.total ?? 0,
        },
        last7d: {
          count: sales7d._count._all ?? 0,
          revenue: sales7d._sum.total ?? 0,
        },
      },
      support: {
        openConversations,
        unreadFromUsers: unreadAdminMessages,
      },
    });
  } catch (e) {
    console.error('[admin/dashboard]', e);
    return serverError(res);
  }
});

// ─── Businesses: lista + detalle ───────────────────────────────────────────
router.get('/businesses', async (req: Request, res: Response) => {
  try {
    const q = ((req.query['q'] as string) || '').trim().toLowerCase();
    const plan = (req.query['plan'] as string) || '';
    const limit = Math.min(parseInt((req.query['limit'] as string) || '50', 10) || 50, 200);

    const businesses = await prisma.business.findMany({
      where: {
        ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
        ...(plan && ['FREE', 'PRO', 'BUSINESS'].includes(plan)
          ? { plan: plan as 'FREE' | 'PRO' | 'BUSINESS' }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        name: true,
        plan: true,
        onboardingCompleted: true,
        trialEndsAt: true,
        createdAt: true,
        _count: {
          select: { branches: true, users: true },
        },
      },
    });

    return ok(res, businesses);
  } catch (e) {
    console.error('[admin/businesses GET]', e);
    return serverError(res);
  }
});

router.get('/businesses/:id', async (req: Request, res: Response) => {
  try {
    const business = await prisma.business.findUnique({
      where: { id: req.params['id'] },
      include: {
        branches: { select: { id: true, name: true, isActive: true } },
        users: {
          select: {
            id: true, email: true, fullName: true, role: true, isActive: true,
            branchId: true, branch: { select: { name: true } },
          },
        },
      },
    });
    if (!business) return notFound(res, 'Negocio no encontrado');

    // KPIs del negocio
    const branchIds = business.branches.map((b) => b.id);
    const [salesAgg, ingredientCount, recipeCount] = await Promise.all([
      prisma.sale.aggregate({
        where: { branchId: { in: branchIds } },
        _sum: { total: true },
        _count: { _all: true },
      }),
      prisma.ingredient.count({ where: { branchId: { in: branchIds } } }),
      prisma.recipe.count({ where: { branchId: { in: branchIds }, isActive: true } }),
    ]);

    return ok(res, {
      ...business,
      kpis: {
        totalSales: salesAgg._count._all ?? 0,
        revenue: salesAgg._sum.total ?? 0,
        ingredients: ingredientCount,
        recipes: recipeCount,
      },
    });
  } catch (e) {
    console.error('[admin/businesses/:id GET]', e);
    return serverError(res);
  }
});

const updateBusinessSchema = z.object({
  plan: z.enum(['FREE', 'PRO', 'BUSINESS']).optional(),
  trialEndsAt: z.string().nullable().optional(),
});

router.patch('/businesses/:id', async (req: Request, res: Response) => {
  try {
    const parsed = updateBusinessSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const data: Record<string, unknown> = {};
    if (parsed.data.plan) {
      data['plan'] = parsed.data.plan;
      // Si pasa a plan pagado, limpiar trial
      data['trialEndsAt'] = parsed.data.plan === 'FREE'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
        : null;
    }
    if (parsed.data.trialEndsAt !== undefined) {
      data['trialEndsAt'] = parsed.data.trialEndsAt
        ? new Date(parsed.data.trialEndsAt)
        : null;
    }

    const updated = await prisma.business.update({
      where: { id: req.params['id'] },
      data,
    });
    return ok(res, updated, 'Negocio actualizado');
  } catch (e) {
    console.error('[admin/businesses/:id PATCH]', e);
    return serverError(res);
  }
});

// ─── Users: lista global ───────────────────────────────────────────────────
router.get('/users', async (req: Request, res: Response) => {
  try {
    const q = ((req.query['q'] as string) || '').trim().toLowerCase();
    const limit = Math.min(parseInt((req.query['limit'] as string) || '100', 10) || 100, 500);

    const users = await prisma.user.findMany({
      where: q
        ? {
            OR: [
              { email: { contains: q, mode: 'insensitive' } },
              { fullName: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {},
      orderBy: { email: 'asc' },
      take: limit,
      select: {
        id: true, email: true, fullName: true, role: true, isActive: true,
        business: { select: { id: true, name: true, plan: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    return ok(res, users);
  } catch (e) {
    console.error('[admin/users GET]', e);
    return serverError(res);
  }
});

// ─── Support: usa los modelos de chat existentes ────────────────────────────
// Lista todas las conversaciones con el último mensaje + count de no leídos.
router.get('/support/conversations', async (_req: Request, res: Response) => {
  try {
    const convs = await prisma.supportConversation.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        business: { select: { id: true, name: true, plan: true } },
        user: { select: { id: true, fullName: true, email: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            messages: {
              where: { senderRole: 'USER', isReadByAdmin: false },
            },
          },
        },
      },
    });
    return ok(res, convs);
  } catch (e) {
    console.error('[admin/support/conversations]', e);
    return serverError(res);
  }
});

router.get('/support/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const conv = await prisma.supportConversation.findUnique({
      where: { id: req.params['id'] },
      include: {
        business: { select: { name: true, plan: true } },
        user: { select: { fullName: true, email: true } },
      },
    });
    if (!conv) return notFound(res, 'Conversación no encontrada');

    const messages = await prisma.supportMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'asc' },
    });

    // Marca todos los USER como leídos por admin (al abrir la conv los considera leídos)
    await prisma.supportMessage.updateMany({
      where: { conversationId: conv.id, senderRole: 'USER', isReadByAdmin: false },
      data: { isReadByAdmin: true },
    });

    return ok(res, { conversation: conv, messages });
  } catch (e) {
    console.error('[admin/support/conversations/:id/messages]', e);
    return serverError(res);
  }
});

const adminMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
});

router.post('/support/conversations/:id/messages', async (req: Request, res: Response) => {
  try {
    const parsed = adminMessageSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const conv = await prisma.supportConversation.findUnique({
      where: { id: req.params['id'] },
    });
    if (!conv) return notFound(res, 'Conversación no encontrada');

    const msg = await prisma.supportMessage.create({
      data: {
        conversationId: conv.id,
        senderRole: 'ADMIN',
        senderName: req.admin!.name,
        content: parsed.data.content,
      },
    });

    await prisma.supportConversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() },
    });

    return ok(res, msg);
  } catch (e) {
    console.error('[admin/support POST message]', e);
    return serverError(res);
  }
});

export default router;
