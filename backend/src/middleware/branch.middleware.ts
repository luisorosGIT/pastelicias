import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types';

/**
 * Middleware de aislamiento por sucursal — capa 2 de seguridad.
 *
 * Lógica:
 * - OWNER puede pasar `branchId` en query/body para filtrar una sucursal específica,
 *   o no pasarlo para ver datos globales (req.branchId = undefined en ese caso).
 * - Todos los demás roles DEBEN tener un branchId asignado en su perfil.
 *   Si el branchId del query no coincide con el suyo, se rechaza.
 *
 * Inyecta `req.branchId` resuelto para que los controllers lo usen directamente.
 */
export function branchMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void {
  const { user } = req;

  // branchId puede venir como query param, body o header personalizado
  const requestedBranchId =
    (req.query.branchId as string) ||
    (req.body?.branchId as string) ||
    (req.params?.branchId as string);

  if (user.role === 'OWNER') {
    // Propietario: puede solicitar una sucursal o todas
    req.branchId = requestedBranchId || ''; // '' = vista global
    next();
    return;
  }

  // Roles no-OWNER DEBEN tener branchId en su perfil
  if (!user.branchId) {
    res.status(403).json({
      success: false,
      error: 'No tienes una sucursal asignada. Contacta al administrador.',
    });
    return;
  }

  // Si piden un branchId diferente al suyo → rechazar
  if (requestedBranchId && requestedBranchId !== user.branchId) {
    res.status(403).json({
      success: false,
      error: 'No tienes permiso para acceder a datos de otra sucursal.',
    });
    return;
  }

  req.branchId = user.branchId;
  next();
}
