import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';

/** Guard que solo deja pasar si hay sesión de admin activa. */
export const adminAuthGuard: CanActivateFn = (_route, _state) => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    router.navigate(['/admin/login']);
    return false;
  }
  return true;
};

/** Guard para /admin/login y /admin/setup: si ya hay sesión, redirige a dashboard. */
export const adminGuestGuard: CanActivateFn = (_route, _state) => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);
  if (auth.isAuthenticated()) {
    router.navigate(['/admin/dashboard']);
    return false;
  }
  return true;
};
