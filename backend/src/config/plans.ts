import { Plan } from '@prisma/client';
import prisma from '../services/prisma.service';

/**
 * Recursos cuyo uso está limitado por plan. La clave debe ser estable porque
 * la usamos para mensajes de error y para que el frontend identifique qué
 * límite se alcanzó.
 */
export type LimitedResource = 'branches' | 'ingredients' | 'recipes' | 'users';

/**
 * Tope de cada recurso por plan. `Infinity` significa ilimitado.
 *
 * Estos números pueden ajustarse sin migrar la DB — son código.
 *
 * Lógica de pricing (Perú, mercado pequeño/mediano):
 *  - FREE: una pastelería pequeña con 1 dueño puede operar dignamente.
 *  - PRO: multi-usuario, catálogo mediano, hasta 3 sucursales.
 *  - BUSINESS: cadenas con muchas sucursales y catálogos grandes.
 */
export const PLAN_LIMITS: Record<Plan, Record<LimitedResource, number>> = {
  FREE: {
    branches:    1,
    ingredients: 30,
    recipes:     30,
    users:       1,
  },
  PRO: {
    branches:    3,
    ingredients: 200,
    recipes:     200,
    users:       5,
  },
  BUSINESS: {
    branches:    Infinity,
    ingredients: Infinity,
    recipes:     Infinity,
    users:       Infinity,
  },
};

/** Label legible para mostrar al usuario. */
export const PLAN_LABEL: Record<Plan, string> = {
  FREE: 'Gratis',
  PRO: 'Pro',
  BUSINESS: 'Business',
};

/** Precio mensual referencial en soles peruanos. */
export const PLAN_PRICE_PEN: Record<Plan, number> = {
  FREE: 0,
  PRO: 49,
  BUSINESS: 149,
};

/** Label legible para un recurso. */
const RESOURCE_LABEL: Record<LimitedResource, string> = {
  branches: 'sucursales',
  ingredients: 'insumos',
  recipes: 'productos',
  users: 'usuarios',
};

/**
 * Cuenta cuántos registros del recurso existen para el business.
 * Usado tanto por el helper de validación como por el endpoint /settings/plan.
 */
export async function countResource(
  businessId: string,
  resource: LimitedResource
): Promise<number> {
  switch (resource) {
    case 'branches':
      return prisma.branch.count({ where: { businessId, isActive: true } });
    case 'ingredients':
      return prisma.ingredient.count({
        where: { branch: { businessId, isActive: true } },
      });
    case 'recipes':
      return prisma.recipe.count({
        where: { branch: { businessId, isActive: true }, isActive: true },
      });
    case 'users':
      return prisma.user.count({ where: { businessId, isActive: true } });
  }
}

/** Error tipado que las rutas pueden capturar para devolver 402 + payload útil. */
export class PlanLimitError extends Error {
  constructor(
    public readonly resource: LimitedResource,
    public readonly plan: Plan,
    public readonly currentUsage: number,
    public readonly limit: number
  ) {
    const resLabel = RESOURCE_LABEL[resource];
    super(
      `Has alcanzado el límite de tu plan ${PLAN_LABEL[plan]}: ` +
      `${currentUsage} de ${limit} ${resLabel}. Mejora tu plan para crear más.`
    );
    this.name = 'PlanLimitError';
  }
}

/** Error tipado: la prueba gratuita de 30 días expiró y el plan sigue siendo FREE. */
export class TrialExpiredError extends Error {
  constructor(public readonly trialEndsAt: Date) {
    super(
      `Tu prueba gratuita de 30 días terminó el ${trialEndsAt.toLocaleDateString('es-PE')}. ` +
      `Mejora tu plan para seguir usando Pastelicias.`
    );
    this.name = 'TrialExpiredError';
  }
}

// ─── Helpers de estado del trial ──────────────────────────────────────────────

/** True si el plan es FREE y la fecha de trial ya pasó. */
export function isTrialExpired(business: { plan: Plan; trialEndsAt: Date | null }): boolean {
  if (business.plan !== 'FREE') return false;
  if (!business.trialEndsAt) return false;
  return business.trialEndsAt.getTime() <= Date.now();
}

/** Días enteros que faltan para que termine el trial. 0 si ya expiró o no aplica. */
export function trialDaysRemaining(business: { plan: Plan; trialEndsAt: Date | null }): number {
  if (business.plan !== 'FREE' || !business.trialEndsAt) return 0;
  const msLeft = business.trialEndsAt.getTime() - Date.now();
  if (msLeft <= 0) return 0;
  return Math.ceil(msLeft / (24 * 60 * 60 * 1000));
}

/**
 * Valida que el business pueda hacer un POST (= crear cosas nuevas).
 * Bloquea si el trial FREE ya expiró. Llamar ANTES de assertWithinLimit.
 */
export async function assertTrialActive(businessId: string): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { plan: true, trialEndsAt: true },
  });
  if (!business) throw new Error('Business no encontrado');
  if (isTrialExpired(business)) {
    throw new TrialExpiredError(business.trialEndsAt as Date);
  }
}

/**
 * Verifica que el business pueda crear UN registro más del recurso especificado.
 * Lanza PlanLimitError si está en el tope.
 *
 * Llamar ANTES de prisma.create() en cada endpoint POST.
 */
export async function assertWithinLimit(
  businessId: string,
  resource: LimitedResource
): Promise<void> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { plan: true },
  });
  if (!business) throw new Error('Business no encontrado');

  const limit = PLAN_LIMITS[business.plan][resource];
  if (limit === Infinity) return; // Plan ilimitado

  const used = await countResource(businessId, resource);
  if (used >= limit) {
    throw new PlanLimitError(resource, business.plan, used, limit);
  }
}
