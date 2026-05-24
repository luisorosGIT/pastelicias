import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';

/**
 * Cache en memoria de respuestas de API GET. La idea:
 *  - Una request GET típica tarda ~780ms (latencia Lima → us-west-1 × overhead Prisma).
 *  - La segunda vez que un usuario pide la misma URL en 30s, la respondemos desde
 *    memoria en ~5ms.
 *  - Cualquier mutación (POST/PUT/DELETE) invalida selectivamente con `invalidatePaths`.
 *
 * La clave del cache es (userId, originalUrl) — así un MANAGER de la Sucursal A
 * no recibe los datos cacheados de la Sucursal B.
 */

interface CacheEntry {
  data: unknown;
  expiresAt: number;
}

const DEFAULT_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

// Limpieza periódica de entradas expiradas (evita fuga de memoria si los
// usuarios visitan páginas que luego nunca regresan).
//
// IMPORTANTE: en serverless (Vercel) cada invocación es un proceso nuevo y
// no hay loop event que mantenga setInterval — además el cache en memoria
// NO se comparte entre invocaciones, así que limpiarlo no aporta nada.
// Skip si VERCEL está en env.
if (!process.env.VERCEL) {
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of cache) {
      if (v.expiresAt <= now) cache.delete(k);
    }
  }, 60_000).unref();
}

function keyFor(req: AuthRequest): string {
  return `${req.user.id}::${req.originalUrl}`;
}

/**
 * Middleware. Si la request es GET y hay un valor cacheado, lo devuelve.
 * Si no, intercepta `res.json` para guardar la respuesta antes de enviarla.
 */
export function withCache(ttlMs: number = DEFAULT_TTL_MS) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (req.method !== 'GET') {
      next();
      return;
    }

    const key = keyFor(req);
    const entry = cache.get(key);

    // IMPORTANTE: NO cachear en el navegador (no Cache-Control max-age) porque
    // las mutaciones del lado del servidor no pueden invalidar el cache del
    // navegador. Eso causaba bugs tipo "elimino X, navego, vuelvo, X reaparece"
    // porque el navegador servía la respuesta vieja sin pedir al backend.
    // El cache server-side (instantáneo, ~5ms HIT) es suficiente.
    res.setHeader('Cache-Control', 'no-store');

    if (entry && entry.expiresAt > Date.now()) {
      res.setHeader('X-Cache', 'HIT');
      res.status(200).json(entry.data);
      return;
    }

    res.setHeader('X-Cache', 'MISS');
    const originalJson = res.json.bind(res);
    res.json = (body: unknown): Response => {
      // Solo cachea respuestas exitosas
      if (res.statusCode >= 200 && res.statusCode < 300) {
        cache.set(key, { data: body, expiresAt: Date.now() + ttlMs });
      }
      return originalJson(body);
    };
    next();
  };
}

/**
 * Invalida cualquier entrada cuya clave contenga uno de los fragmentos.
 * Llamar después de mutaciones que afecten esos endpoints.
 *
 * Ej: `invalidatePaths('/api/inventory', '/api/recipes')` borra todas las
 * entradas relacionadas con inventario y recetas, para cualquier usuario.
 */
export function invalidatePaths(...pathFragments: string[]): void {
  if (pathFragments.length === 0) return;
  for (const k of cache.keys()) {
    if (pathFragments.some((p) => k.includes(p))) {
      cache.delete(k);
    }
  }
}

/** Limpia todo el cache. Útil para tests o operaciones administrativas. */
export function clearResponseCache(): void {
  cache.clear();
}
