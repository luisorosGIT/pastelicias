import { Response } from 'express';
import { ApiResponse } from '../types';

export function ok<T>(res: Response, data: T, message?: string): Response {
  const body: ApiResponse<T> = { success: true, data };
  if (message) body.message = message;
  return res.status(200).json(body);
}

export function created<T>(res: Response, data: T, message?: string): Response {
  const body: ApiResponse<T> = { success: true, data };
  if (message) body.message = message;
  return res.status(201).json(body);
}

export function badRequest(res: Response, error: string): Response {
  return res.status(400).json({ success: false, error });
}

export function forbidden(res: Response, error = 'Acceso denegado'): Response {
  return res.status(403).json({ success: false, error });
}

export function notFound(res: Response, error = 'Recurso no encontrado'): Response {
  return res.status(404).json({ success: false, error });
}

/**
 * 402 Payment Required — usado cuando el tenant excede el límite de su plan.
 * Incluye payload extra (resource, plan, usage, limit) para que el frontend
 * pueda mostrar UI específica con link al upgrade.
 */
export function planLimitReached(
  res: Response,
  error: string,
  payload: { resource: string; plan: string; currentUsage: number; limit: number }
): Response {
  return res.status(402).json({
    success: false,
    error,
    code: 'PLAN_LIMIT_REACHED',
    ...payload,
  });
}

export function serverError(res: Response, error = 'Error interno del servidor'): Response {
  return res.status(500).json({ success: false, error });
}
