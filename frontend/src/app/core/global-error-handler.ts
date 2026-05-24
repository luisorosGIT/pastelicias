import { ErrorHandler, Injectable, inject, isDevMode } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Handler global de errores Angular. Atrapa cualquier excepción no manejada
 * en componentes, services, lifecycle hooks, etc.
 *
 * En dev: imprime el error completo en consola con stack trace.
 * En prod: muestra un snackbar genérico al usuario y reporta a Sentry si
 *   está configurado (window._sentry está inyectado en main.ts).
 *
 * No re-tira el error para no romper el flujo del usuario por bugs no críticos.
 */
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private snack = inject(MatSnackBar);

  handleError(error: unknown): void {
    // En desarrollo, mostrar todo el detalle
    if (isDevMode()) {
      console.error('[GlobalErrorHandler]', error);
    }

    // Reportar a Sentry si está disponible (lo setea Sentry.init en main.ts)
    const sentry = (window as unknown as { Sentry?: { captureException: (e: unknown) => void } }).Sentry;
    if (sentry?.captureException) {
      try {
        sentry.captureException(error);
      } catch {
        // ignore — no podemos romper el handler de errores
      }
    }

    // Mostrar mensaje al usuario, evitando spamearlo si fueron varios errores seguidos
    if (!this._spamming) {
      this._spamming = true;
      const message =
        error instanceof Error
          ? this.friendlyMessage(error)
          : 'Algo salió mal. Si persiste, contacta soporte.';
      this.snack.open(message, 'OK', { duration: 5000 });
      setTimeout(() => (this._spamming = false), 3000);
    }
  }

  /** Anti-spam de snackbars (si caen 100 errores no quiero 100 snackbars). */
  private _spamming = false;

  /**
   * Filtra mensajes técnicos crípticos y los reemplaza por algo entendible.
   * Si el mensaje ya es útil (ej: "Stock insuficiente..."), lo deja pasar.
   */
  private friendlyMessage(err: Error): string {
    const m = err.message ?? '';
    // Errores de red comunes
    if (m.includes('Http failure') || m.includes('Network')) {
      return 'Sin conexión con el servidor. Revisa tu internet.';
    }
    if (m.includes('ChunkLoadError') || m.includes('Loading chunk')) {
      return 'Se publicó una nueva versión. Recarga la página.';
    }
    // Si tiene un mensaje legible (en español), pasarlo tal cual
    if (m.length > 0 && m.length < 200 && !m.includes('TypeError') && !m.includes('ReferenceError')) {
      return m;
    }
    return 'Algo salió mal. Si persiste, contacta soporte.';
  }
}
