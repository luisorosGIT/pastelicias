import type { Request, Response, NextFunction } from 'express';
import prisma from '../services/prisma.service';
import { isTrialExpired } from '../config/plans';

/**
 * Cache TTL en memoria para evitar pegarle a la DB en cada request.
 * Cuando el usuario hace upgrade el cache se invalida en /settings/upgrade.
 */
const CACHE_TTL_MS = 60 * 1000;
interface CacheEntry {
  expired: boolean;
  trialEndsAt: string | null;
  expiresAt: number;
}
const trialCache = new Map<string, CacheEntry>();

/** Invalidar entrada del cache. Llamado desde /settings/upgrade. */
export function invalidateTrialCache(businessId: string): void {
  trialCache.delete(businessId);
}

/**
 * Bloquea métodos mutadores (POST/PUT/PATCH/DELETE) cuando el trial FREE
 * expiró. Permite GETs para que el usuario pueda ver sus datos y llegar a
 * la página de upgrade.
 *
 * Excepciones (siempre permitidas, aunque haya expirado):
 *  - cualquier ruta bajo /api/auth (login/signup/logout)
 *  - /api/settings/upgrade (cómo se sale del trial expirado)
 *  - /api/settings/plan, /api/settings/business (data para el banner)
 *
 * Lee businessId del req.user (poblado por authenticate middleware).
 */
// Paths relativos al router /api (sin el prefix). /auth ya no llega aquí
// porque se monta antes del authMiddleware, pero lo dejamos por defensa.
const EXEMPT_PATHS = [
  '/auth',
  '/settings/upgrade',
  '/settings/plan',
  '/settings/business',
  '/support', // chat de soporte: el endpoint hace su propio check de plan
];

export async function blockIfTrialExpired(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  // Solo bloqueamos mutaciones.
  if (req.method === 'GET' || req.method === 'OPTIONS' || req.method === 'HEAD') {
    next();
    return;
  }

  // Rutas exentas (login, upgrade, lectura de estado del plan).
  if (EXEMPT_PATHS.some((p) => req.path.startsWith(p))) {
    next();
    return;
  }

  // Si no hay user autenticado, deja pasar — otro middleware lo rechazará.
  const businessId = req.user?.businessId;
  if (!businessId) {
    next();
    return;
  }

  // Check cache
  const cached = trialCache.get(businessId);
  if (cached && cached.expiresAt > Date.now()) {
    if (cached.expired) {
      res.status(402).json({
        success: false,
        code: 'TRIAL_EXPIRED',
        error: `Tu prueba gratuita terminó el ${new Date(cached.trialEndsAt!).toLocaleDateString('es-PE')}. Mejora tu plan para seguir usando Pastelicias.`,
        trialEndsAt: cached.trialEndsAt,
      });
      return;
    }
    next();
    return;
  }

  // Miss → leer DB
  try {
    const business = await prisma.business.findUnique({
      where: { id: businessId },
      select: { plan: true, trialEndsAt: true },
    });
    if (!business) {
      next();
      return;
    }
    const expired = isTrialExpired(business);
    trialCache.set(businessId, {
      expired,
      trialEndsAt: business.trialEndsAt ? business.trialEndsAt.toISOString() : null,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    if (expired) {
      res.status(402).json({
        success: false,
        code: 'TRIAL_EXPIRED',
        error: `Tu prueba gratuita terminó el ${(business.trialEndsAt as Date).toLocaleDateString('es-PE')}. Mejora tu plan para seguir usando Pastelicias.`,
        trialEndsAt: business.trialEndsAt,
      });
      return;
    }
    next();
  } catch (err) {
    // Si la DB falla, no bloqueamos — preferimos un pass-through y que el
    // handler de la ruta arroje su propio error si corresponde.
    console.error('[blockIfTrialExpired] DB error, allowing through:', err);
    next();
  }
}
