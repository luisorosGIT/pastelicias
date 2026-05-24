import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { homePathForRole } from '../utils/home-path';

/**
 * Guard principal: requiere autenticación. Si está autenticado pero el OWNER
 * no terminó el onboarding, lo redirige al wizard.
 */
export const authGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/auth/login']);
    return false;
  }

  // OWNER que aún no completó onboarding → forzar wizard
  const user = authService.user();
  if (user?.role === 'OWNER' && !authService.onboardingCompleted()) {
    router.navigate(['/onboarding']);
    return false;
  }

  return true;
};

/**
 * Guard de rutas públicas (landing, login, signup): si ya está autenticado,
 * lo manda a su home (o al onboarding si está pendiente).
 */
export const guestGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) return true;

  const user = authService.user();
  if (user?.role === 'OWNER' && !authService.onboardingCompleted()) {
    router.navigate(['/onboarding']);
  } else if (user) {
    router.navigate([homePathForRole(user.role)]);
  } else {
    router.navigate(['/auth/login']);
  }
  return false;
};

/**
 * Guard del wizard de onboarding: solo accesible para OWNER autenticado con
 * onboarding pendiente. Cualquier otro estado redirige a la ruta apropiada.
 */
export const onboardingGuard: CanActivateFn = (_route, _state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (!authService.isAuthenticated()) {
    router.navigate(['/']);
    return false;
  }

  const user = authService.user();
  if (!user) {
    router.navigate(['/']);
    return false;
  }

  // Solo OWNER pasa por el wizard
  if (user.role !== 'OWNER') {
    router.navigate([homePathForRole(user.role)]);
    return false;
  }

  // Si ya completó el onboarding, no debe regresar al wizard
  if (authService.onboardingCompleted()) {
    router.navigate([homePathForRole(user.role)]);
    return false;
  }

  return true;
};
