import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma.service';
import { roles } from '../middleware/role.middleware';
import { withCache, invalidatePaths } from '../middleware/response-cache.middleware';
import { AuthRequest } from '../types';
import { ok, created, badRequest, notFound, serverError } from '../utils/response';

const router = Router();

const countSchema = z.object({
  actualStock: z.number().min(0, 'El stock real no puede ser negativo'),
  notes: z.string().optional().nullable(),
});

/**
 * POST /api/inventory/:id/count
 * Registra un conteo físico. Calcula la varianza vs. el stock teórico (esperado)
 * y genera automáticamente:
 *   - una entrada en `inventory_counts` (auditoría)
 *   - una entrada en `waste_logs` si hay merma (varianza negativa)
 *   - actualización del stock del Ingredient para que refleje la realidad
 */
router.post('/:id/count', roles.noSeller, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const branchId = req.branchId;
    if (!branchId) {
      return badRequest(
        res,
        'Selecciona una sucursal específica para registrar un conteo.'
      );
    }

    const ingredient = await prisma.ingredient.findFirst({
      where: { id, branchId },
    });
    if (!ingredient) return notFound(res, 'Insumo no encontrado en esta sucursal');

    const parsed = countSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const { actualStock, notes } = parsed.data;

    const expectedStock = ingredient.stock;
    const varianceQty = actualStock - expectedStock; // negativo = falta = merma
    const varianceCost = varianceQty * ingredient.unitCost;

    // ─── Transacción: conteo + ajuste de stock + waste log si aplica ─────────
    const result = await prisma.$transaction(async (tx) => {
      const count = await tx.inventoryCount.create({
        data: {
          branchId,
          ingredientId: id,
          expectedStock,
          actualStock,
          varianceQty,
          varianceCost,
          notes: notes ?? null,
        },
      });

      // Si falta inventario (varianceQty < 0), generar merma automática.
      let autoWaste = null;
      if (varianceQty < 0) {
        autoWaste = await tx.wasteLog.create({
          data: {
            branchId,
            type: 'INGREDIENT',
            ingredientId: id,
            quantity: Math.abs(varianceQty),
            cost: Math.abs(varianceCost),
            reason: 'OTHER',
            notes: `Merma por diferencia en conteo físico (${notes ?? 'sin notas'})`,
          },
        });
      }

      // Ajustar stock a la realidad
      const updatedIngredient = await tx.ingredient.update({
        where: { id },
        data: { stock: actualStock },
      });

      return { count, autoWaste, ingredient: updatedIngredient };
    });

    const msg =
      varianceQty < 0
        ? `Conteo registrado. Merma de S/ ${Math.abs(varianceCost).toFixed(2)} generada automáticamente.`
        : varianceQty > 0
          ? `Conteo registrado. Stock ajustado al alza (¿compra no registrada?).`
          : `Conteo registrado. Stock cuadra perfectamente.`;

    invalidatePaths('/api/inventory', '/api/recipes', '/api/dashboard', '/api/production');
    return created(res, result, msg);
  } catch (e) {
    console.error('[inventory/count]', e);
    return serverError(res);
  }
});

/**
 * GET /api/inventory/:id/counts
 * Historial de conteos (últimos 50).
 */
router.get('/:id/counts', roles.noSeller, withCache(), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const branchId = req.branchId;

    const ingredient = branchId
      ? await prisma.ingredient.findFirst({ where: { id, branchId } })
      : await prisma.ingredient.findFirst({
          where: { id, branch: { businessId: req.user.businessId } },
        });
    if (!ingredient) return notFound(res, 'Insumo no encontrado');

    const counts = await prisma.inventoryCount.findMany({
      where: { ingredientId: id },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return ok(res, counts);
  } catch (e) {
    console.error('[inventory/counts-list]', e);
    return serverError(res);
  }
});

export default router;
