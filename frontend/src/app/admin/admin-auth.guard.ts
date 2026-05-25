import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from './admin-auth.service';

/**
 * Guard que solo deja pasar si hay sesión de admin activa. Si no, redirige
 * al login público (/auth/login) que es el único punto de entrada — el
 * backend detecta si el email es admin y mete la sesión correspondiente.
 */
export const adminAuthGuard: CanActivateFn = (_route, _state) => {
  const auth = inject(AdminAuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) {
    router.navigate(['/auth/login']);
    return false;
  }
  return true;
};
