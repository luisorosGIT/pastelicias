import { Role } from '../models';

/**
 * Página principal ("espacio de trabajo") por rol — donde cada usuario
 * aterriza al iniciar sesión y a donde redirigimos si intenta acceder a
 * una página que no le corresponde.
 *
 *  - OWNER    → Dashboard (vista global)
 *  - MANAGER  → Dashboard (su sucursal)
 *  - SELLER   → POS (su herramienta principal)
 *  - INVENTORY → Inventario (su área de trabajo)
 */
export function homePathForRole(role: Role | null | undefined): string {
  switch (role) {
    case 'OWNER':
    case 'MANAGER':
      return '/app/dashboard';
    case 'SELLER':
      return '/app/pos';
    case 'INVENTORY':
      return '/app/inventory';
    default:
      return '/auth/login';
  }
}
