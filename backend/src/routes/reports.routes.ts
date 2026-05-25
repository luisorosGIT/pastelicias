import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma.service';
import { roles } from '../middleware/role.middleware';
import { withCache } from '../middleware/response-cache.middleware';
import { AuthRequest } from '../types';
import { ok, serverError } from '../utils/response';
import { getDateRange } from '../utils/dates';
import { DateFilter } from '../types';

const router = Router();

// ─── GET /api/reports/summary ─────────────────────────────────────────────────
// Solo Propietario
router.get('/summary', roles.ownerOnly, withCache(15_000), async (req: AuthRequest, res: Response) => {
  try {
    const filter = (req.query.filter as DateFilter) || 'month';
    const branchId = req.branchId || undefined;
    const businessId = req.user.businessId;
    const { from, to } = getDateRange(filter);

    // SEGURIDAD MULTI-TENANT: si el OWNER está en "Todas las sucursales"
    // (branchId vacío), tenemos que filtrar por businessId vía la relación
    // con branch — sino la query trae datos de TODOS los negocios del SaaS.
    const tenantFilter = branchId
      ? { branchId }
      : { branch: { businessId } };

    const saleWhere = {
      ...tenantFilter,
      createdAt: { gte: from, lte: to },
    };

    const wasteWhere = {
      ...tenantFilter,
      createdAt: { gte: from, lte: to },
    };

    const [sales, wasteLogs] = await Promise.all([
      prisma.sale.findMany({
        where: saleWhere,
        include: {
          items: { include: { recipe: { select: { name: true } } } },
          user: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.wasteLog.findMany({
        where: wasteWhere,
        include: {
          ingredient: { select: { name: true } },
          recipe: { select: { name: true } },
        },
      }),
    ]);

    const grossSales = sales.reduce((s, sale) => s + sale.total, 0);
    const wasteImpact = wasteLogs.reduce((s, w) => s + w.cost, 0);
    const netSales = grossSales - wasteImpact;
    const wastePercent = grossSales > 0 ? (wasteImpact / grossSales) * 100 : 0;

    // Top sucursales (solo vista global)
    let topBranches: { branchId: string; branchName: string; total: number }[] = [];
    if (!branchId) {
      // FIX SEGURIDAD: filtrar por businessId via la relación branch para que
      // no agrupe ventas de OTROS negocios cuando branchId está vacío.
      const grouped = await prisma.sale.groupBy({
        by: ['branchId'],
        _sum: { total: true },
        where: {
          createdAt: { gte: from, lte: to },
          branch: { businessId },
        },
        orderBy: { _sum: { total: 'desc' } },
        take: 5,
      });

      const branchIds = grouped.map((g) => g.branchId);
      const branches = await prisma.branch.findMany({
        // Defensa adicional: aseguramos que las branches devueltas también
        // sean del business del user (aunque después del groupBy ya lo serían).
        where: { id: { in: branchIds }, businessId },
        select: { id: true, name: true },
      });

      const branchMap = new Map(branches.map((b) => [b.id, b.name]));
      topBranches = grouped.map((g) => ({
        branchId: g.branchId,
        branchName: branchMap.get(g.branchId) ?? 'Desconocida',
        total: g._sum.total ?? 0,
      }));
    }

    // ── Métricas extra: hora pico, día pico, productos vendidos, top productos,
    //    top insumos consumidos, insumos críticos, tendencia de costos ──────
    const branchFilterSql = branchId
      ? Prisma.sql`AND s."branchId" = ${branchId}`
      : Prisma.sql`AND b."businessId" = ${businessId}`;
    const branchFilterIngSql = branchId
      ? Prisma.sql`AND i."branchId" = ${branchId}`
      : Prisma.sql`AND b."businessId" = ${businessId}`;
    const branchFilterPurchaseSql = branchId
      ? Prisma.sql`AND p."branchId" = ${branchId}`
      : Prisma.sql`AND b."businessId" = ${businessId}`;
    const branchFilterProductionSql = branchId
      ? Prisma.sql`AND pr."branchId" = ${branchId}`
      : Prisma.sql`AND b."businessId" = ${businessId}`;
    const branchFilterWasteSql = branchId
      ? Prisma.sql`AND w."branchId" = ${branchId}`
      : Prisma.sql`AND b."businessId" = ${businessId}`;

    const [
      peakHourRows,
      peakDayRows,
      itemsSoldRows,
      topProductsRows,
      topConsumedRows,
      criticalRows,
      dailySpendRows,
      priceChangesRows,
    ] = await Promise.all([
      // Hora pico: agrupar ventas por hora del día (0-23) y obtener la de mayor revenue
      prisma.$queryRaw<Array<{ hour: number; sales: number; revenue: number }>>`
        SELECT
          EXTRACT(HOUR FROM s."createdAt")::int AS hour,
          COUNT(*)::int AS sales,
          SUM(s.total)::float8 AS revenue
        FROM sales s
        INNER JOIN branches b ON b.id = s."branchId"
        WHERE s."createdAt" BETWEEN ${from} AND ${to}
        ${branchFilterSql}
        GROUP BY 1
        ORDER BY revenue DESC
        LIMIT 1
      `,
      // Día pico: agrupar por fecha
      prisma.$queryRaw<Array<{ date: Date; revenue: number; sales: number }>>`
        SELECT
          DATE_TRUNC('day', s."createdAt") AS date,
          COUNT(*)::int AS sales,
          SUM(s.total)::float8 AS revenue
        FROM sales s
        INNER JOIN branches b ON b.id = s."branchId"
        WHERE s."createdAt" BETWEEN ${from} AND ${to}
        ${branchFilterSql}
        GROUP BY 1
        ORDER BY revenue DESC
        LIMIT 1
      `,
      // Total de productos vendidos (unidades)
      prisma.$queryRaw<Array<{ total: number }>>`
        SELECT COALESCE(SUM(si.quantity), 0)::int AS total
        FROM sale_items si
        INNER JOIN sales s ON s.id = si."saleId"
        INNER JOIN branches b ON b.id = s."branchId"
        WHERE s."createdAt" BETWEEN ${from} AND ${to}
        ${branchFilterSql}
      `,
      // Top 5 productos por unidades vendidas
      prisma.$queryRaw<Array<{ recipe_id: string; name: string; quantity: number; revenue: number }>>`
        SELECT
          r.id AS recipe_id,
          r.name,
          SUM(si.quantity)::int AS quantity,
          SUM(si."unitPrice" * si.quantity)::float8 AS revenue
        FROM sale_items si
        INNER JOIN sales s ON s.id = si."saleId"
        INNER JOIN branches b ON b.id = s."branchId"
        INNER JOIN recipes r ON r.id = si."recipeId"
        WHERE s."createdAt" BETWEEN ${from} AND ${to}
        ${branchFilterSql}
        GROUP BY r.id, r.name
        ORDER BY quantity DESC
        LIMIT 5
      `,
      // Top 5 insumos consumidos = productions (BOM × qty) + ingredient wastes
      prisma.$queryRaw<Array<{ ingredient_id: string; name: string; unit: string; quantity: number; cost: number }>>`
        WITH consumption AS (
          -- Consumido por producciones (BOM × cantidad producida)
          SELECT
            ri."ingredientId" AS ingredient_id,
            (ri.quantity * pr.quantity)::float8 AS qty
          FROM productions pr
          INNER JOIN branches b ON b.id = pr."branchId"
          INNER JOIN recipe_items ri ON ri."recipeId" = pr."recipeId"
          WHERE pr."createdAt" BETWEEN ${from} AND ${to}
          ${branchFilterProductionSql}
          UNION ALL
          -- Consumido por mermas de insumo
          SELECT
            w."ingredientId" AS ingredient_id,
            w.quantity::float8 AS qty
          FROM waste_logs w
          INNER JOIN branches b ON b.id = w."branchId"
          WHERE w.type::text = 'INGREDIENT'
            AND w."ingredientId" IS NOT NULL
            AND w."createdAt" BETWEEN ${from} AND ${to}
          ${branchFilterWasteSql}
        )
        SELECT
          c.ingredient_id,
          i.name,
          i.unit::text AS unit,
          SUM(c.qty)::float8 AS quantity,
          (SUM(c.qty) * i."unitCost")::float8 AS cost
        FROM consumption c
        INNER JOIN ingredients i ON i.id = c.ingredient_id
        GROUP BY c.ingredient_id, i.name, i.unit, i."unitCost"
        ORDER BY quantity DESC
        LIMIT 5
      `,
      // Insumos críticos (stock <= minStock) — snapshot actual, no por periodo
      prisma.$queryRaw<Array<{ id: string; name: string; stock: number; min_stock: number; unit: string; cost: number }>>`
        SELECT
          i.id, i.name, i.stock::float8, i."minStock"::float8 AS min_stock,
          i.unit::text AS unit, i."unitCost"::float8 AS cost
        FROM ingredients i
        INNER JOIN branches b ON b.id = i."branchId"
        WHERE i.stock <= i."minStock"
        ${branchFilterIngSql}
        ORDER BY (i.stock / GREATEST(i."minStock", 0.0001)) ASC
        LIMIT 20
      `,
      // Gasto en compras por día (tendencia)
      prisma.$queryRaw<Array<{ date: Date; total: number }>>`
        SELECT
          DATE_TRUNC('day', p."createdAt") AS date,
          SUM(p."totalCost")::float8 AS total
        FROM purchases p
        INNER JOIN branches b ON b.id = p."branchId"
        WHERE p."createdAt" BETWEEN ${from} AND ${to}
        ${branchFilterPurchaseSql}
        GROUP BY 1
        ORDER BY 1 ASC
      `,
      // Insumos cuyo CPP cambió en el periodo: comparar la primera compra
      // del periodo vs la última. Si cambió significativamente → mostrar.
      prisma.$queryRaw<Array<{ ingredient_id: string; name: string; unit: string; old_cost: number; new_cost: number; delta_percent: number }>>`
        WITH ranked AS (
          SELECT
            p."ingredientId",
            p."unitCost",
            p."createdAt",
            ROW_NUMBER() OVER (PARTITION BY p."ingredientId" ORDER BY p."createdAt" ASC) AS first_rn,
            ROW_NUMBER() OVER (PARTITION BY p."ingredientId" ORDER BY p."createdAt" DESC) AS last_rn
          FROM purchases p
          INNER JOIN branches b ON b.id = p."branchId"
          WHERE p."createdAt" BETWEEN ${from} AND ${to}
          ${branchFilterPurchaseSql}
        ),
        firsts AS (SELECT "ingredientId", "unitCost" AS old_cost FROM ranked WHERE first_rn = 1),
        lasts  AS (SELECT "ingredientId", "unitCost" AS new_cost FROM ranked WHERE last_rn = 1)
        SELECT
          f."ingredientId" AS ingredient_id,
          i.name,
          i.unit::text AS unit,
          f.old_cost::float8,
          l.new_cost::float8,
          CASE WHEN f.old_cost = 0 THEN 0
               ELSE ((l.new_cost - f.old_cost) / f.old_cost * 100)::float8
          END AS delta_percent
        FROM firsts f
        INNER JOIN lasts l ON l."ingredientId" = f."ingredientId"
        INNER JOIN ingredients i ON i.id = f."ingredientId"
        WHERE ABS(l.new_cost - f.old_cost) > 0.001
        ORDER BY ABS(((l.new_cost - f.old_cost) / NULLIF(f.old_cost, 0)) * 100) DESC NULLS LAST
        LIMIT 10
      `,
    ]);

    const peakHourRaw = peakHourRows[0];
    const peakDayRaw = peakDayRows[0];

    return ok(res, {
      kpis: {
        grossSales: Math.round(grossSales * 100) / 100,
        netSales: Math.round(netSales * 100) / 100,
        wasteImpact: Math.round(wasteImpact * 100) / 100,
        wastePercent: Math.round(wastePercent * 100) / 100,
      },
      peakHour: peakHourRaw
        ? {
            hour: peakHourRaw.hour,
            sales: peakHourRaw.sales,
            revenue: Math.round(peakHourRaw.revenue * 100) / 100,
          }
        : null,
      peakDay: peakDayRaw
        ? {
            date: peakDayRaw.date,
            sales: peakDayRaw.sales,
            revenue: Math.round(peakDayRaw.revenue * 100) / 100,
          }
        : null,
      totalItemsSold: itemsSoldRows[0]?.total ?? 0,
      topProducts: topProductsRows.map((r) => ({
        recipeId: r.recipe_id,
        name: r.name,
        quantity: r.quantity,
        revenue: Math.round(r.revenue * 100) / 100,
      })),
      topConsumedIngredients: topConsumedRows.map((r) => ({
        ingredientId: r.ingredient_id,
        name: r.name,
        unit: r.unit,
        quantity: Math.round(r.quantity * 1000) / 1000,
        cost: Math.round(r.cost * 100) / 100,
      })),
      criticalIngredients: criticalRows.map((r) => ({
        id: r.id,
        name: r.name,
        stock: r.stock,
        minStock: r.min_stock,
        unit: r.unit,
        cost: r.cost,
      })),
      costTrend: {
        dailySpend: dailySpendRows.map((r) => ({
          date: r.date,
          total: Math.round(r.total * 100) / 100,
        })),
        priceChanges: priceChangesRows.map((r) => ({
          ingredientId: r.ingredient_id,
          name: r.name,
          unit: r.unit,
          oldCpp: Math.round(r.old_cost * 10000) / 10000,
          newCpp: Math.round(r.new_cost * 10000) / 10000,
          deltaPercent: Math.round(r.delta_percent * 100) / 100,
        })),
      },
      sales,
      wasteLogs,
      topBranches,
      period: { from, to, filter },
    });
  } catch (e) {
    console.error('[reports/summary]', e);
    return serverError(res);
  }
});

// ─── GET /api/reports/export ──────────────────────────────────────────────────
router.get('/export', roles.ownerOnly, async (req: AuthRequest, res: Response) => {
  try {
    const filter = (req.query.filter as DateFilter) || 'month';
    const branchId = req.branchId || undefined;
    const businessId = req.user.businessId;
    const { from, to } = getDateRange(filter);

    // SEGURIDAD MULTI-TENANT: ver comentario en /summary. Sin este filtro el
    // CSV exportaría ventas de OTROS negocios cuando branchId está vacío.
    const tenantFilter = branchId
      ? { branchId }
      : { branch: { businessId } };

    const sales = await prisma.sale.findMany({
      where: { ...tenantFilter, createdAt: { gte: from, lte: to } },
      include: {
        items: { include: { recipe: { select: { name: true } } } },
        branch: { select: { name: true } },
        user: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Generar CSV
    const rows = ['Sucursal,Vendedor,Ticket,Fecha,Método Pago,Subtotal,IGV,Total'];
    sales.forEach((s) => {
      rows.push(
        [
          s.branch.name,
          s.user?.fullName ?? '—',
          s.ticketCode,
          s.createdAt.toISOString(),
          s.paymentMethod,
          s.subtotal,
          s.taxAmount,
          s.total,
        ].join(',')
      );
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="reporte-ventas-${filter}.csv"`
    );
    res.send(rows.join('\n'));
  } catch {
    return serverError(res);
  }
});

export default router;
