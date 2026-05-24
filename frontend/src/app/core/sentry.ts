import { environment } from '@env/environment';

/**
 * Wrapper opt-in para Sentry.
 *
 * Diseño: no importa @sentry/angular estáticamente — se carga dinámicamente
 * SOLO si environment.sentryDsn está definido. Así el bundle de dev no incluye
 * el SDK y el tamaño en prod es opcional.
 *
 * Para activar:
 *   1. npm install @sentry/angular
 *   2. Pega tu DSN en environments/environment.prod.ts (campo `sentryDsn`)
 *   3. Listo. initSentry() arrancará al inicio del bootstrap.
 *
 * GlobalErrorHandler ya delega a `window.Sentry.captureException()` si está
 * disponible, así que no hay que tocar nada más.
 */
export async function initSentry(): Promise<void> {
  if (!environment.sentryDsn) return;

  try {
    // Import dinámico — si @sentry/angular no está instalado, falla silenciosa
    const Sentry = (await import(/* @vite-ignore */ '@sentry/angular' as string).catch(() => null)) as
      | { init: (opts: object) => void; captureException: (e: unknown) => void }
      | null;

    if (!Sentry) {
      console.warn('[Sentry] DSN configurado pero @sentry/angular no instalado. Run: npm install @sentry/angular');
      return;
    }

    Sentry.init({
      dsn: environment.sentryDsn,
      environment: environment.production ? 'production' : 'development',
      tracesSampleRate: 0.1, // 10% de transacciones para no agotar el plan gratis
    });

    // Exponer en window para que GlobalErrorHandler lo encuentre
    (window as unknown as { Sentry: typeof Sentry }).Sentry = Sentry;
    console.info('[Sentry] inicializado');
  } catch (e) {
    console.warn('[Sentry] no se pudo inicializar:', e);
  }
}
