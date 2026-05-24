import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma.service';
import { roles } from '../middleware/role.middleware';
import { withCache, invalidatePaths } from '../middleware/response-cache.middleware';
import { AuthRequest } from '../types';
import { ok, created, badRequest, notFound, serverError } from '../utils/response';

const router = Router();

// Schema: cantidad y costo se mandan en unidad base ya convertidos por el frontend.
const purchaseSchema = z.object({
  quantity: z.number().positive('La cantidad debe ser positiva'),
  unitCost: z.number().positive('El costo unitario debe ser positivo'),
  supplier: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

/**
 * POST /api/inventory/:id/purchase
 * Registra una compra y recalcula el Costo Promedio Ponderado (CPP) del insumo.
 *
 * CPP nuevo = (stockActual × CPPactual + cantidadCompra × costoCompra)
 *           / (stockActual + cantidadCompra)
 *
 * Stock nuevo = stockActual + cantidadCompra
 *
 * Si stockActual == 0, el nuevo CPP es directamente el costo de la compra.
 */
router.post('/:id/purchase', roles.noSeller, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const branchId = req.branchId;
    if (!branchId) {
      return badRequest(
        res,
        'Selecciona una sucursal específica para registrar una compra.'
      );
    }

    const ingredient = await prisma.ingredient.findFirst({
      where: { id, branchId },
    });
    if (!ingredient) return notFound(res, 'Insumo no encontrado en esta sucursal');

    const parsed = purchaseSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const { quantity, unitCost, supplier, notes } = parsed.data;

    // ─── Cálculo de CPP ──────────────────────────────────────────────────────
    const currentStock = ingredient.stock;
    const currentCpp = ingredient.unitCost;
    const newStock = currentStock + quantity;
    const newCpp =
      newStock > 0
        ? (currentStock * currentCpp + quantity * unitCost) / newStock
        : unitCost;

    // ─── Transacción: actualizar insumo + crear compra ───────────────────────
    const result = await prisma.$transaction(async (tx) => {
      const updatedIngredient = await tx.ingredient.update({
        where: { id },
        data: { stock: newStock, unitCost: newCpp },
      });

      const purchase = await tx.purchase.create({
        data: {
          branchId,
          ingredientId: id,
          quantity,
          unitCost,
          totalCost: Math.round(quantity * unitCost * 100) / 100,
          supplier: supplier ?? null,
          notes: notes ?? null,
        },
      });

      return { ingredient: updatedIngredient, purchase };
    });

    invalidatePaths('/api/inventory', '/api/recipes', '/api/dashboard');
    return created(
      res,
      {
        ...result,
        cpp: {
          previous: currentCpp,
          new: newCpp,
          delta: newCpp - currentCpp,
        },
      },
      `Compra registrada. CPP actualizado de S/ ${currentCpp.toFixed(4)} a S/ ${newCpp.toFixed(4)}.`
    );
  } catch (e) {
    console.error('[inventory/purchase]', e);
    return serverError(res);
  }
});

/**
 * GET /api/inventory/:id/purchases
 * Historial de compras (últimas 50).
 */
router.get('/:id/purchases', roles.noSeller, withCache(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const branchId = req.branchId;

    // Defensa: verificar acceso al insumo
    const ingredient = branchId
      ? await prisma.ingredient.findFirst({ where: { id, branchId } })
      : await prisma.ingredient.findFirst({
          where: { id, branch: { businessId: req.user.businessId } },
        });
    if (!ingredient) return notFound(res, 'Insumo no encontrado');

    const purchases = await prisma.purchase.findMany({
      where: { ingredientId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return ok(res, purchases);
  } catch (e) {
    console.error('[inventory/purchases-list]', e);
    return serverError(res);
  }
});

export default router;
