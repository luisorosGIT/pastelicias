import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { AdminAuthService } from '../../admin/admin-auth.service';

/**
 * Interceptor funcional (Angular 17+) que:
 *  - añade el JWT a cada request (excepto a las de auth pública),
 *  - usa el token de admin para /admin/* y el token de user para el resto,
 *  - en caso de 401, fuerza logout y redirige al login,
 *  - en caso de 402 (límite de plan alcanzado), muestra un snackbar con
 *    acción "Mejorar plan" que lleva a /app/upgrade.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const adminAuthService = inject(AdminAuthService);
  const router = inject(Router);
  const snack = inject(MatSnackBar);

  const isAuthPublic =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/signup') ||
    req.url.includes('/auth/refresh') ||
    req.url.includes('/auth/forgot-password') ||
    req.url.includes('/auth/reset-password') ||
    req.url.includes('/admin/auth/login') ||
    req.url.includes('/admin/auth/setup');

  // Las rutas /admin/* usan el token de admin (genimatech_admin_token)
  // en lugar del token de user normal.
  const isAdminApi = req.url.includes('/api/admin/');

  const outgoing = (() => {
    if (isAuthPublic) return req;
    const token = isAdminApi ? adminAuthService.getToken() : authService.getToken();
    if (!token) return req;
    return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  })();

  return next(outgoing).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isAuthPublic) {
        if (isAdminApi) {
          adminAuthService.forceLogout();
          router.navigate(['/admin/login']);
        } else {
          // Token rechazado por el backend → limpiar sesión y mandar al login.
          authService.forceLogout();
          router.navigate(['/auth/login']);
        }
      } else if (err.status === 402) {
        const body = err.error as { error?: string; code?: string } | null;
        const message = body?.error ?? 'Has alcanzado el límite de tu plan';
        if (body?.code === 'TRIAL_EXPIRED') {
          // Trial gratis terminó → redirigir directo al upgrade (más urgente
          // que un snackbar que se ignora).
          snack.open(message, 'OK', { duration: 6000 });
          router.navigate(['/app/upgrade']);
        } else {
          // Límite del plan alcanzado → snackbar con CTA al upgrade.
          const ref = snack.open(message, 'Mejorar plan', { duration: 8000 });
          ref.onAction().subscribe(() => {
            router.navigate(['/app/upgrade']);
          });
        }
      }
      return throwError(() => err);
    })
  );
};
