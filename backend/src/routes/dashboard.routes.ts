import { Router, Response } from 'express';
import { Prisma } from '@prisma/client';
import prisma from '../services/prisma.service';
import { roles } from '../middleware/role.middleware';
import { withCache } from '../middleware/response-cache.middleware';
import { AuthRequest, DateFilter } from '../types';
import { ok, serverError } from '../utils/response';
import { getDateRange } from '../utils/dates';

const router = Router();

/**
 * GET /api/dashboard/summary
 * Disponible para OWNER (global o por sucursal) y MANAGER (su sucursal).
 */
router.get('/summary', roles.ownerOrManager, withCache(15_000), async (req: AuthRequest, res: Response) => {
  try {
    const filter = (req.query.filter as DateFilter) || 'today';
    const branchId = req.branchId || undefined;
    const { from, to } = getDateRange(filter);
    const { from: todayFrom, to: todayTo } = getDateRange('today');
    const businessId = req.user.businessId;

    // Una sola tanda de queries paralelas, cada una con agregación SQL.
    const branchFilterSql = branchId
      ? Prisma.sql`AND s."branchId" = ${branchId}`
      : Prisma.sql`AND b."businessId" = ${businessId}`;
    const wasteBranchFilterSql = branchId
      ? Prisma.sql`AND w."branchId" = ${branchId}`
      : Prisma.sql`AND b."businessId" = ${businessId}`;
    const critBranchFilterSql = branchId
      ? Prisma.sql`AND i."branchId" = ${branchId}`
      : Prisma.sql`AND b."businessId" = ${businessId}`;

    const [kpisRows, topProductsRows, seriesRows, branchesRows] = await Promise.all([
      // 1) KPIs principales (total ventas, conteo, ticket promedio, merma, críticos)
      prisma.$queryRaw<Array<{
        total_sales: number;
        sales_count: number;
        waste_cost: number;
        critical_ingredients: number;
      }>>`
        SELECT
          COALESCE((
            SELECT SUM(s.total)::float8
            FROM sales s
            INNER JOIN branches b ON b.id = s."branchId"
            WHERE s."createdAt" BETWEEN ${from} AND ${to}
            ${branchFilterSql}
          ), 0) AS total_sales,
          COALESCE((
            SELECT COUNT(*)::int
            FROM sales s
            INNER JOIN branches b ON b.id = s."branchId"
            WHERE s."createdAt" BETWEEN ${from} AND ${to}
            ${branchFilterSql}
          ), 0) AS sales_count,
          COALESCE((
            SELECT SUM(w.cost)::float8
            FROM waste_logs w
            INNER JOIN branches b ON b.id = w."branchId"
            WHERE w."createdAt" BETWEEN ${from} AND ${to}
            ${wasteBranchFilterSql}
          ), 0) AS waste_cost,
          COALESCE((
            SELECT COUNT(*)::int
            FROM ingredients i
            INNER JOIN branches b ON b.id = i."branchId"
            WHERE i.stock <= i."minStock"
            ${critBranchFilterSql}
          ), 0) AS critical_ingredients
      `,
      // 2) Top 5 productos vendidos en el periodo
      prisma.$queryRaw<Array<{ recipe_id: string; name: string; quantity: number; revenue: number }>>`
        SELECT
          r.id AS recipe_id,
          r.name,
          SUM(si.quantity)::float8 AS quantity,
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
      // 3) Serie temporal. Granularidad: hora (today/yesterday), mes (year), día (resto).
      filter === 'today' || filter === 'yesterday'
        ? prisma.$queryRaw<Array<{ label: string; total: number }>>`
            SELECT
              LPAD(EXTRACT(HOUR FROM s."createdAt")::text, 2, '0') || ':00' AS label,
              SUM(s.total)::float8 AS total
            FROM sales s
            INNER JOIN branches b ON b.id = s."branchId"
            WHERE s."createdAt" BETWEEN ${from} AND ${to}
            ${branchFilterSql}
            GROUP BY 1
            ORDER BY 1 ASC
          `
        : filter === 'year'
        ? prisma.$queryRaw<Array<{ label: string; total: number }>>`
            SELECT
              TO_CHAR(s."createdAt", 'Mon') AS label,
              SUM(s.total)::float8 AS total,
              MIN(s."createdAt") AS sort_key
            FROM sales s
            INNER JOIN branches b ON b.id = s."branchId"
            WHERE s."createdAt" BETWEEN ${from} AND ${to}
            ${branchFilterSql}
            GROUP BY 1
            ORDER BY MIN(s."createdAt") ASC
          `
        : prisma.$queryRaw<Array<{ label: string; total: number }>>`
            SELECT
              TO_CHAR(s."createdAt", 'DD/MM') AS label,
              SUM(s.total)::float8 AS total
            FROM sales s
            INNER JOIN branches b ON b.id = s."branchId"
            WHERE s."createdAt" BETWEEN ${from} AND ${to}
            ${branchFilterSql}
            GROUP BY 1, DATE_TRUNC('day', s."createdAt")
            ORDER BY DATE_TRUNC('day', s."createdAt") ASC
          `,
      // 4) Sucursales con ventas de hoy (solo si está en vista global)
      branchId
        ? Promise.resolve([] as Array<{ id: string; name: string; today_sales: number }>)
        : prisma.$queryRaw<Array<{ id: string; name: string; today_sales: number }>>`
            SELECT
              b.id, b.name,
              COALESCE((
                SELECT SUM(s.total)::float8 FROM sales s
                WHERE s."branchId" = b.id AND s."createdAt" BETWEEN ${todayFrom} AND ${todayTo}
              ), 0) AS today_sales
            FROM branches b
            WHERE b."businessId" = ${businessId} AND b."isActive" = true
            ORDER BY b.name ASC
          `,
    ]);

    const k = kpisRows[0] ?? { total_sales: 0, sales_count: 0, waste_cost: 0, critical_ingredients: 0 };
    const averageTicket = k.sales_count > 0 ? k.total_sales / k.sales_count : 0;
    const wasteIndex = k.total_sales > 0 ? (k.waste_cost / k.total_sales) * 100 : 0;

    return ok(res, {
      kpis: {
        dailySales: Math.round(k.total_sales * 100) / 100,
        averageTicket: Math.round(averageTicket * 100) / 100,
        wasteIndex: Math.round(wasteIndex * 100) / 100,
        criticalIngredients: k.critical_ingredients,
      },
      topProducts: topProductsRows.map((t) => ({ name: t.name, quantity: t.quantity, revenue: t.revenue })),
      series: seriesRows.map((s) => ({ label: s.label, total: s.total })),
      branches: branchesRows.map((b) => ({
        id: b.id,
        name: b.name,
        todaySales: b.today_sales,
        isActive: true,
      })),
      period: { from, to, filter },
      salesCount: k.sales_count,
    });
  } catch (e) {
    console.error('[dashboard/summary]', e);
    return serverError(res);
  }
});

export default router;
