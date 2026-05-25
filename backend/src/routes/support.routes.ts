import { Router, Response, Request } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma.service';
import { roles } from '../middleware/role.middleware';
import { AuthRequest } from '../types';
import { ok, badRequest, notFound, serverError } from '../utils/response';

const router = Router();

/**
 * Chat de soporte (Pro / Business).
 *
 * Modelo: una conversación por business, abierta indefinidamente. El OWNER
 * envía mensajes y el ADMIN (Genimatech) responde. Mientras no haya panel
 * admin, las respuestas se manejan via endpoint /admin protegido por
 * ADMIN_SECRET env var (o por inserción directa en la DB).
 *
 * Plan check: solo Pro/Business pueden iniciar/postear mensajes. Free recibe
 * 402 con código UPGRADE_REQUIRED.
 */

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Devuelve la conversación abierta del business, o la crea si no existe. */
async function getOrCreateConversation(businessId: string, userId: string) {
  let conv = await prisma.supportConversation.findFirst({
    where: { businessId, status: 'OPEN' },
    orderBy: { updatedAt: 'desc' },
  });
  if (!conv) {
    conv = await prisma.supportConversation.create({
      data: { businessId, userId },
    });
  }
  return conv;
}

async function isPaidPlan(businessId: string): Promise<boolean> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { plan: true },
  });
  return business?.plan === 'PRO' || business?.plan === 'BUSINESS';
}

// ─── GET /api/support/conversation ────────────────────────────────────────────
// Obtiene (o crea) la conversación activa del business + sus últimos N mensajes.
router.get('/conversation', roles.ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const paid = await isPaidPlan(req.user.businessId);
    if (!paid) {
      res.status(402).json({
        success: false,
        code: 'UPGRADE_REQUIRED',
        error: 'El chat de soporte está disponible en los planes Pro y Business. Mejora tu plan para activarlo.',
      });
      return;
    }

    const conv = await getOrCreateConversation(req.user.businessId, req.user.id);
    const messages = await prisma.supportMessage.findMany({
      where: { conversationId: conv.id },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    return ok(res, { conversation: conv, messages });
  } catch (e) {
    console.error('[support/conversation GET]', e);
    return serverError(res);
  }
});

// ─── GET /api/support/conversation/messages ──────────────────────────────────
// Devuelve solo mensajes nuevos desde un id (para polling sin re-fetch full).
router.get('/conversation/messages', roles.ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const paid = await isPaidPlan(req.user.businessId);
    if (!paid) {
      return ok(res, { messages: [], unreadCount: 0 });
    }

    const conv = await prisma.supportConversation.findFirst({
      where: { businessId: req.user.businessId, status: 'OPEN' },
      orderBy: { updatedAt: 'desc' },
    });
    if (!conv) return ok(res, { messages: [], unreadCount: 0 });

    const sinceParam = (req.query['since'] as string | undefined) ?? '0';
    const since = new Date(Number(sinceParam) || 0);

    const messages = await prisma.supportMessage.findMany({
      where: { conversationId: conv.id, createdAt: { gt: since } },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });

    // Conteo de mensajes ADMIN no leídos por el user
    const unreadCount = await prisma.supportMessage.count({
      where: {
        conversationId: conv.id,
        senderRole: 'ADMIN',
        isReadByUser: false,
      },
    });

    return ok(res, { messages, unreadCount });
  } catch (e) {
    console.error('[support/conversation/messages GET]', e);
    return serverError(res);
  }
});

// ─── POST /api/support/messages ──────────────────────────────────────────────
const messageSchema = z.object({
  content: z.string().trim().min(1, 'El mensaje no puede estar vacío').max(2000, 'Máximo 2000 caracteres'),
});

router.post('/messages', roles.ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const paid = await isPaidPlan(req.user.businessId);
    if (!paid) {
      res.status(402).json({
        success: false,
        code: 'UPGRADE_REQUIRED',
        error: 'El chat de soporte está disponible en los planes Pro y Business.',
      });
      return;
    }

    const parsed = messageSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const conv = await getOrCreateConversation(req.user.businessId, req.user.id);

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { fullName: true },
    });

    const msg = await prisma.supportMessage.create({
      data: {
        conversationId: conv.id,
        senderRole: 'USER',
        senderName: user?.fullName ?? null,
        content: parsed.data.content,
      },
    });

    // Actualizar updatedAt de la conv para que aparezca arriba en el panel admin.
    await prisma.supportConversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date(), status: 'OPEN' },
    });

    return ok(res, msg);
  } catch (e) {
    console.error('[support/messages POST]', e);
    return serverError(res);
  }
});

// ─── POST /api/support/read ──────────────────────────────────────────────────
// Marca todos los mensajes ADMIN de la conv activa como leídos por el user.
router.post('/read', roles.ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const conv = await prisma.supportConversation.findFirst({
      where: { businessId: req.user.businessId, status: 'OPEN' },
    });
    if (!conv) return ok(res, null);

    await prisma.supportMessage.updateMany({
      where: { conversationId: conv.id, senderRole: 'ADMIN', isReadByUser: false },
      data: { isReadByUser: true },
    });
    return ok(res, null);
  } catch (e) {
    console.error('[support/read POST]', e);
    return serverError(res);
  }
});

export default router;

// ─── ENDPOINTS ADMIN (público, protegidos por ADMIN_SECRET en header) ────────
// Se montan en routes/index.ts ANTES del authMiddleware. Pensados para
// responder mensajes desde un cliente HTTP (curl/Postman/script) o un
// panel admin futuro.
export const supportAdminRouter = Router();

function requireAdminSecret(req: Request, res: Response): boolean {
  const expected = process.env.ADMIN_SECRET;
  if (!expected) {
    res.status(503).json({ success: false, error: 'ADMIN_SECRET no configurado en el servidor.' });
    return false;
  }
  const got = req.header('X-Admin-Secret');
  if (got !== expected) {
    res.status(401).json({ success: false, error: 'No autorizado.' });
    return false;
  }
  return true;
}

// GET /api/support-admin/conversations — listar todas
supportAdminRouter.get('/conversations', async (req: Request, res: Response) => {
  if (!requireAdminSecret(req, res)) return;
  try {
    const convs = await prisma.supportConversation.findMany({
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        business: { select: { id: true, name: true, plan: true } },
        user: { select: { id: true, fullName: true, email: true } },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1, // último mensaje para preview
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
    console.error('[admin/conversations]', e);
    return serverError(res);
  }
});

// GET /api/support-admin/conversations/:id/messages
supportAdminRouter.get('/conversations/:id/messages', async (req: Request, res: Response) => {
  if (!requireAdminSecret(req, res)) return;
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

    // Marca todos los USER msgs como leídos por admin
    await prisma.supportMessage.updateMany({
      where: { conversationId: conv.id, senderRole: 'USER', isReadByAdmin: false },
      data: { isReadByAdmin: true },
    });

    return ok(res, { conversation: conv, messages });
  } catch (e) {
    console.error('[admin/conversations/:id/messages]', e);
    return serverError(res);
  }
});

// POST /api/support-admin/conversations/:id/messages — responder como ADMIN
const adminMessageSchema = z.object({
  content: z.string().trim().min(1).max(2000),
  senderName: z.string().optional(),
});

supportAdminRouter.post('/conversations/:id/messages', async (req: Request, res: Response) => {
  if (!requireAdminSecret(req, res)) return;
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
        senderName: parsed.data.senderName || 'Soporte Genimatech',
        content: parsed.data.content,
      },
    });

    await prisma.supportConversation.update({
      where: { id: conv.id },
      data: { updatedAt: new Date() },
    });

    return ok(res, msg);
  } catch (e) {
    console.error('[admin POST message]', e);
    return serverError(res);
  }
});
