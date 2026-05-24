import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../services/prisma.service';
import { roles } from '../middleware/role.middleware';
import { withCache, invalidatePaths } from '../middleware/response-cache.middleware';
import { AuthRequest } from '../types';
import { ok, created, badRequest, serverError } from '../utils/response';

const router = Router();

const cartItemSchema = z.object({
  recipeId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
});

const createSaleSchema = z.object({
  type: z.enum(['SIMPLE', 'ADVANCED']),
  paymentMethod: z.enum(['CASH', 'CARD', 'YAPE_PLIN']),
  items: z.array(cartItemSchema).min(1, 'La venta debe tener al menos un ítem'),
  amountReceived: z.number().positive().optional(),
});

// ─── POST /api/sales ──────────────────────────────────────────────────────────
router.post('/', roles.noInventory, async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branchId;
    if (!branchId) {
      return badRequest(
        res,
        'Selecciona una sucursal específica para registrar una venta.'
      );
    }

    const parsed = createSaleSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const { type, paymentMethod, items, amountReceived } = parsed.data;

    // Obtener tasaIGV del negocio
    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      include: { business: { select: { taxRate: true } } },
    });
    if (!branch) return badRequest(res, 'Sucursal no encontrada');

    const taxRate = branch.business.taxRate / 100;

    // ─── Validación PREVIA: stock suficiente para cada producto vendido ───────
    // (Las ventas decrementan SOLO Recipe.stock — los insumos ya se descontaron
    //  en producción; descontarlos aquí también sería doble contabilidad).
    const recipeIds = items.map((i) => i.recipeId);
    const recipes = await prisma.recipe.findMany({
      where: { id: { in: recipeIds }, branchId },
      select: { id: true, name: true, stock: true },
    });
    const recipeMap = new Map(recipes.map((r) => [r.id, r]));

    for (const item of items) {
      const recipe = recipeMap.get(item.recipeId);
      if (!recipe) {
        return badRequest(res, `Producto no encontrado en esta sucursal.`);
      }
      if (recipe.stock < item.quantity) {
        return badRequest(
          res,
          `Stock insuficiente de "${recipe.name}": tienes ${recipe.stock} unidades disponibles y quieres vender ${item.quantity}. Registra una producción antes de vender.`
        );
      }
    }

    // Calcular totales
    const subtotalBeforeTax = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
    // El precio ya incluye IGV, extraemos el neto:
    const subtotal = subtotalBeforeTax / (1 + taxRate);
    const taxAmount = subtotalBeforeTax - subtotal;
    const total = subtotalBeforeTax;

    const change = amountReceived ? amountReceived - total : null;

    // Transacción: crear venta + decrementar Recipe.stock
    const sale = await prisma.$transaction(async (tx) => {
      // 1. Crear venta
      const newSale = await tx.sale.create({
        data: {
          branchId,
          userId: req.user.id,
          type,
          paymentMethod,
          subtotal: Math.round(subtotal * 100) / 100,
          taxAmount: Math.round(taxAmount * 100) / 100,
          total: Math.round(total * 100) / 100,
          amountReceived,
          change,
          items: { create: items },
        },
        include: { items: true },
      });

      // 2. Decrementar stock de producto terminado
      for (const item of items) {
        await tx.recipe.update({
          where: { id: item.recipeId },
          data: { stock: { decrement: item.quantity } },
        });
      }

      return newSale;
    });

    invalidatePaths('/api/sales', '/api/recipes', '/api/dashboard', '/api/reports');
    return created(res, sale, 'Venta registrada exitosamente');
  } catch (error) {
    console.error('[sales/create]', error);
    return serverError(res);
  }
});

// ─── GET /api/sales ───────────────────────────────────────────────────────────
router.get('/', roles.ownerOrManager, withCache(), async (req: AuthRequest, res: Response) => {
  try {
    const branchId = req.branchId;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const where = branchId ? { branchId } : {};

    const [sales, total] = await prisma.$transaction([
      prisma.sale.findMany({
        where,
        include: { items: { include: { recipe: { select: { name: true } } } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.sale.count({ where }),
    ]);

    return ok(res, { items: sales, total, page, totalPages: Math.ceil(total / limit) });
  } catch {
    return serverError(res);
  }
});

// ─── GET /api/sales/:id/ticket ────────────────────────────────────────────────
router.get('/:id/ticket', roles.noInventory, async (req: AuthRequest, res: Response) => {
  try {
    const sale = await prisma.sale.findFirst({
      where: { id: req.params.id, branchId: req.branchId || undefined },
      include: {
        items: { include: { recipe: { select: { name: true } } } },
        branch: { include: { business: { select: { name: true, ruc: true } } } },
      },
    });

    if (!sale) return badRequest(res, 'Venta no encontrada');
    return ok(res, sale);
  } catch {
    return serverError(res);
  }
});

export default router;
