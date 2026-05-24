import type { ErrorRequestHandler, RequestHandler } from 'express';

/**
 * Wrapper opt-in para Sentry en el backend. Mismo diseño que el frontend:
 *  - Si SENTRY_DSN no está en env, todas las funciones son no-op.
 *  - Si está, intenta cargar @sentry/node dinámicamente. Si no está instalado,
 *    loguea un warning pero no rompe el server.
 *
 * Activar:
 *   1. npm install @sentry/node
 *   2. Setear SENTRY_DSN en .env
 *   3. Reiniciar backend
 */

interface SentryAPI {
  init: (opts: object) => void;
  captureException: (e: unknown) => void;
  Handlers: {
    requestHandler: () => RequestHandler;
    errorHandler: () => ErrorRequestHandler;
  };
}

let sentry: SentryAPI | null = null;

export async function initSentry(): Promise<void> {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  try {
    // Import dinámico para no requerir @sentry/node como dependencia obligatoria
    sentry = (await import('@sentry/node' as string).catch(() => null)) as SentryAPI | null;

    if (!sentry) {
      console.warn('[Sentry] DSN configurado pero @sentry/node no instalado. Run: npm install @sentry/node');
      return;
    }

    sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      tracesSampleRate: 0.1,
    });

    console.info('[Sentry] inicializado');
  } catch (e) {
    console.warn('[Sentry] no se pudo inicializar:', e);
  }
}

/** Capturar manualmente una excepción (no-op si Sentry no está activo). */
export function captureException(error: unknown): void {
  sentry?.captureException(error);
}

/** Middleware de request handler de Sentry. Si no hay Sentry, no-op. */
export function sentryRequestHandler(): RequestHandler {
  return sentry?.Handlers.requestHandler() ?? ((_, __, next) => next());
}

/** Middleware de error handler de Sentry. Si no hay Sentry, no-op. */
export function sentryErrorHandler(): ErrorRequestHandler {
  return sentry?.Handlers.errorHandler() ?? ((err, _req, _res, next) => next(err));
}
