import { inject } from '@angular/core';
import { CanActivateFn, Router, ActivatedRouteSnapshot } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { Role } from '../models';
import { homePathForRole } from '../utils/home-path';

/**
 * Guard de rol — el componente/ruta debe declarar `data: { roles: Role[] }`.
 *
 * Ejemplo:
 *   { path: 'reports', canActivate: [roleGuard], data: { roles: ['OWNER'] } }
 *
 * Si el usuario no tiene permiso, lo redirige a la página principal de su rol
 * (no a una ruta fija — eso causaría loop si su home tampoco es accesible).
 */
export const roleGuard: CanActivateFn = (route: ActivatedRouteSnapshot) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const allowedRoles = route.data['roles'] as Role[] | undefined;
  const userRole = authService.role();

  if (!userRole) {
    router.navigate(['/auth/login']);
    return false;
  }

  if (!allowedRoles || allowedRoles.includes(userRole)) return true;

  // Redirigir al home del rol del usuario
  router.navigate([homePathForRole(userRole)]);
  return false;
};
