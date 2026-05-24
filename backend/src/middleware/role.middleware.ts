import { Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import { AuthRequest } from '../types';

/**
 * Factory que devuelve un middleware de autorización por rol.
 *
 * Uso:
 *   router.get('/reports', requireRole('OWNER'), handler)
 *   router.get('/inventory', requireRole('OWNER', 'MANAGER', 'INVENTORY'), handler)
 */
export function requireRole(...allowedRoles: Role[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, error: 'No autenticado' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        error: `Acceso denegado. Se requiere uno de los roles: ${allowedRoles.join(', ')}`,
      });
      return;
    }

    next();
  };
}

/**
 * Shorthand para las combinaciones más comunes.
 */
export const roles = {
  ownerOnly: requireRole('OWNER'),
  ownerOrManager: requireRole('OWNER', 'MANAGER'),
  noSeller: requireRole('OWNER', 'MANAGER', 'INVENTORY'),
  noInventory: requireRole('OWNER', 'MANAGER', 'SELLER'),
  all: requireRole('OWNER', 'MANAGER', 'SELLER', 'INVENTORY'),
};
