import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../services/prisma.service';

export interface AdminPayload {
  id: string;
  email: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      admin?: AdminPayload;
    }
  }
}

/**
 * Middleware para rutas de admin del SaaS.
 *
 * Valida un JWT con `aud='admin'` firmado con JWT_SECRET, busca el admin en la
 * tabla y lo expone en req.admin. Rechaza con 401 si:
 *  - No hay token
 *  - El token es inválido o no tiene aud='admin'
 *  - El admin no existe o está inactivo
 *
 * Es independiente del authMiddleware normal (que es para users de business).
 */
export async function adminMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) {
      res.status(401).json({ success: false, error: 'Token de admin requerido' });
      return;
    }

    let payload: jwt.JwtPayload;
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET!, {
        audience: 'admin',
      });
      if (typeof decoded === 'string') throw new Error('Invalid token shape');
      payload = decoded;
    } catch {
      res.status(401).json({ success: false, error: 'Token inválido o expirado' });
      return;
    }

    if (!payload['sub']) {
      res.status(401).json({ success: false, error: 'Token sin sub' });
      return;
    }

    const admin = await prisma.admin.findUnique({
      where: { id: payload['sub'] as string },
      select: { id: true, email: true, name: true, isActive: true },
    });
    if (!admin || !admin.isActive) {
      res.status(401).json({ success: false, error: 'Admin no encontrado o desactivado' });
      return;
    }

    req.admin = { id: admin.id, email: admin.email, name: admin.name };
    next();
  } catch (err) {
    console.error('[adminMiddleware]', err);
    res.status(500).json({ success: false, error: 'Error de autenticación' });
  }
}

/** Genera un JWT de admin con audience='admin', 7 días de duración. */
export function signAdminToken(admin: AdminPayload): string {
  return jwt.sign(
    { email: admin.email, name: admin.name },
    process.env.JWT_SECRET!,
    {
      subject: admin.id,
      audience: 'admin',
      expiresIn: '7d',
    }
  );
}
