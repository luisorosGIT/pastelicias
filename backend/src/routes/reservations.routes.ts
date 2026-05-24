import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma.service';
import { roles } from '../middleware/role.middleware';
import { withCache, invalidatePaths } from '../middleware/response-cache.middleware';
import { AuthRequest } from '../types';
import { ok, created, badRequest, notFound, serverError } from '../utils/response';

const router = Router();

const reservationSchema = z.object({
  clientName: z.string().min(1),
  phone: z.string().min(6),
  deliveryDate: z.string().datetime(),
  details: z.string().optional().nullable(),
  recipeId: z.string().uuid().optional().nullable(),
  customProduct: z.string().optional().nullable(),
  totalPrice: z.number().positive(),
  advance: z.number().min(0).default(0),
});

const statusOrder = ['PENDING', 'CONFIRMED', 'IN_PROCESS', 'READY', 'DELIVERED'] as const;
type ReservationStatus = (typeof statusOrder)[number];

// ─── GET /api/reservations ────────────────────────────────────────────────────
// OWNER en vista global → reservaciones de todo el business.
router.get('/', roles.noInventory, withCache(), async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branchId;

    const where = branchId
      ? { branchId }
      : { branch: { businessId: req.user.businessId } };

    const reservations = await prisma.reservation.findMany({
      where,
      orderBy: { deliveryDate: 'asc' },
    });

    // Agrupar por estado para el Kanban
    const grouped = statusOrder.reduce<Record<string, typeof reservations>>(
      (acc, status) => ({ ...acc, [status]: [] }),
      {}
    );

    reservations.forEach((r) => grouped[r.status].push(r));

    return ok(res, { grouped, all: reservations });
  } catch {
    return serverError(res);
  }
});

// ─── POST /api/reservations ───────────────────────────────────────────────────
router.post('/', roles.noInventory, async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branchId;
    if (!branchId) {
      return badRequest(
        res,
        'Selecciona una sucursal específica para crear una reservación.'
      );
    }

    const parsed = reservationSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const reservation = await prisma.reservation.create({
      data: { ...parsed.data, branchId, deliveryDate: new Date(parsed.data.deliveryDate) },
    });

    invalidatePaths('/api/reservations', '/api/dashboard');
    return created(res, reservation, 'Reservación creada');
  } catch {
    return serverError(res);
  }
});

// ─── PATCH /api/reservations/:id/status ──────────────────────────────────────
router.patch('/:id/status', roles.noInventory, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: ReservationStatus };

    if (!statusOrder.includes(status)) {
      return badRequest(res, `Estado inválido. Valores: ${statusOrder.join(', ')}`);
    }

    // OWNER en vista global puede modificar cualquier reservación de su business;
    // otros roles solo las de su sucursal.
    const existing = req.branchId
      ? await prisma.reservation.findFirst({ where: { id, branchId: req.branchId } })
      : await prisma.reservation.findFirst({
          where: { id, branch: { businessId: req.user.businessId } },
        });
    if (!existing) return notFound(res, 'Reservación no encontrada');

    const updated = await prisma.reservation.update({
      where: { id },
      data: { status },
    });

    invalidatePaths('/api/reservations');
    return ok(res, updated, `Reservación movida a ${status}`);
  } catch (e) {
    console.error('[reservations/update-status]', e);
    return serverError(res);
  }
});

// ─── PUT /api/reservations/:id ────────────────────────────────────────────────
router.put('/:id', roles.noInventory, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing = req.branchId
      ? await prisma.reservation.findFirst({ where: { id, branchId: req.branchId } })
      : await prisma.reservation.findFirst({
          where: { id, branch: { businessId: req.user.businessId } },
        });
    if (!existing) return notFound(res, 'Reservación no encontrada');

    const parsed = reservationSchema.partial().safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const data = parsed.data;
    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        ...data,
        ...(data.deliveryDate && { deliveryDate: new Date(data.deliveryDate) }),
      },
    });

    invalidatePaths('/api/reservations');
    return ok(res, updated);
  } catch {
    return serverError(res);
  }
});

export default router;
