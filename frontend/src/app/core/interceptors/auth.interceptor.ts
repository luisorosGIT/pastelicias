import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatSnackBar } from '@angular/material/snack-bar';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/**
 * Interceptor funcional (Angular 17+) que:
 *  - añade el JWT a cada request (excepto a las de auth pública),
 *  - en caso de 401, fuerza logout y redirige al login,
 *  - en caso de 402 (límite de plan alcanzado), muestra un snackbar con
 *    acción "Mejorar plan" que lleva a /app/upgrade.
 */
export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const snack = inject(MatSnackBar);

  const isAuthPublic =
    req.url.includes('/auth/login') ||
    req.url.includes('/auth/signup') ||
    req.url.includes('/auth/refresh');

  const outgoing = (() => {
    if (isAuthPublic) return req;
    const token = authService.getToken();
    if (!token) return req;
    return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
  })();

  return next(outgoing).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status === 401 && !isAuthPublic) {
        // Token rechazado por el backend → limpiar sesión y mandar al login.
        authService.forceLogout();
        router.navigate(['/auth/login']);
      } else if (err.status === 402) {
        // Plan limit reached — mostrar snackbar con CTA al upgrade.
        const body = err.error as { error?: string; code?: string } | null;
        const message = body?.error ?? 'Has alcanzado el límite de tu plan';
        const ref = snack.open(message, 'Mejorar plan', { duration: 8000 });
        ref.onAction().subscribe(() => {
          router.navigate(['/app/upgrade']);
        });
      }
      return throwError(() => err);
    })
  );
};
