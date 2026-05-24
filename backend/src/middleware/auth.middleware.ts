import { Request, Response, NextFunction } from 'express';
import { createClient } from '@supabase/supabase-js';
import { Role } from '@prisma/client';
import prisma from '../services/prisma.service';
import { AuthRequest, AuthUser } from '../types';

// Cliente Supabase con service_role — se usa solo para validar tokens (NO para
// hacer queries a la DB; eso lo hace Prisma).
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ─── Cache de validación de tokens ─────────────────────────────────────────────
// La validación contra Supabase Auth + el lookup en Prisma agregan ~300-600ms
// a cada request. Como los tokens cambian pocas veces, cacheamos la resolución
// del Authorization → AuthUser durante 60 segundos.
//
// Trade-off: si un OWNER desactiva a un usuario o cambia su rol, ese cambio
// tarda hasta 60s en aplicarse al usuario afectado. Aceptable para un POS.

interface CachedAuth {
  user: AuthUser;
  expiresAt: number; // unix ms
  isActive: boolean;
}
const CACHE_TTL_MS = 60 * 1000;
const tokenCache = new Map<string, CachedAuth>();

// Limpieza periódica de entradas expiradas para evitar fuga de memoria.
// Skip en serverless (Vercel) — cada invocación es proceso nuevo, no aplica.
if (!process.env.VERCEL) {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of tokenCache) {
      if (v.expiresAt <= now) tokenCache.delete(k);
    }
  }, 5 * 60 * 1000).unref();
}

/** Invalida cualquier entrada cacheada de un usuario específico.
 *  Llamar al desactivar/cambiar rol/cambiar sucursal de un usuario. */
export function invalidateAuthCacheForUser(userId: string): void {
  for (const [k, v] of tokenCache) {
    if (v.user.id === userId) tokenCache.delete(k);
  }
}

/**
 * Middleware de autenticación — capa 1 de seguridad.
 *
 * Flujo:
 *  1. Extrae el Bearer token.
 *  2. Si está en caché y no expiró → reusa.
 *  3. Si no, valida contra Supabase Auth + busca user en Prisma; cachea 60s.
 *  4. Inyecta `req.user`.
 */
export async function authMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ success: false, error: 'Token de autenticación requerido' });
      return;
    }

    const token = authHeader.split(' ')[1];

    // ── Fast path: cache hit ──────────────────────────────────────────────────
    const cached = tokenCache.get(token);
    if (cached && cached.expiresAt > Date.now()) {
      if (!cached.isActive) {
        res.status(403).json({ success: false, error: 'Cuenta de usuario desactivada' });
        return;
      }
      (req as AuthRequest).user = cached.user;
      next();
      return;
    }

    // ── Slow path: validar contra Supabase + Prisma ──────────────────────────
    const { data: authResult, error: authError } = await supabaseAdmin.auth.getUser(token);

    if (authError || !authResult.user) {
      tokenCache.delete(token); // por si quedó algo viejo
      res.status(401).json({ success: false, error: 'Token inválido o expirado' });
      return;
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: authResult.user.id },
      select: {
        id: true,
        email: true,
        role: true,
        businessId: true,
        branchId: true,
        isActive: true,
      },
    });

    if (!dbUser) {
      res.status(401).json({ success: false, error: 'Usuario no encontrado en el sistema' });
      return;
    }

    const user: AuthUser = {
      id: dbUser.id,
      email: dbUser.email,
      role: dbUser.role as Role,
      businessId: dbUser.businessId,
      branchId: dbUser.branchId,
    };

    // Guardar en caché aun si el usuario está inactivo, así no martilleamos Supabase
    // con cada request fallido — el cache se invalida solo al cambiar la cuenta.
    tokenCache.set(token, {
      user,
      isActive: dbUser.isActive,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });

    if (!dbUser.isActive) {
      res.status(403).json({ success: false, error: 'Cuenta de usuario desactivada' });
      return;
    }

    (req as AuthRequest).user = user;
    next();
  } catch (error) {
    console.error('[authMiddleware] Error inesperado:', error);
    res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}
