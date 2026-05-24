import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';
import { branchMiddleware } from '../middleware/branch.middleware';

import authRoutes from './auth.routes';
import inventoryRoutes from './inventory.routes';
import purchasesRoutes from './purchases.routes';
import inventoryCountsRoutes from './inventory-counts.routes';
import recipesRoutes from './recipes.routes';
import salesRoutes from './sales.routes';
import reservationsRoutes from './reservations.routes';
import productionRoutes from './production.routes';
import reportsRoutes from './reports.routes';
import settingsRoutes from './settings.routes';
import dashboardRoutes from './dashboard.routes';

const router = Router();

// Rutas públicas (no requieren JWT)
router.use('/auth', authRoutes);

// Rutas protegidas — todas pasan por authMiddleware + branchMiddleware
router.use(authMiddleware as any);
router.use(branchMiddleware as any);

// Compras se montan ANTES de inventory para que /inventory/:id/purchase no
// caiga en la ruta PUT /:id de inventory.
router.use('/inventory', purchasesRoutes);
router.use('/inventory', inventoryCountsRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/recipes', recipesRoutes);
router.use('/sales', salesRoutes);
router.use('/reservations', reservationsRoutes);
router.use('/production', productionRoutes);
router.use('/reports', reportsRoutes);
router.use('/settings', settingsRoutes);
router.use('/dashboard', dashboardRoutes);

export default router;
