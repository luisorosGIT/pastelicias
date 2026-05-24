import { Routes } from '@angular/router';
import { authGuard, guestGuard, onboardingGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const APP_ROUTES: Routes = [
  // ─── Landing pública ───────────────────────────────────────────────────────
  {
    path: '',
    pathMatch: 'full',
    canActivate: [guestGuard],
    loadComponent: () =>
      import('./modules/landing/landing.component').then((m) => m.LandingComponent),
  },

  // ─── Pricing público ──────────────────────────────────────────────────────
  // Página /pricing visible sin auth. Marketing comparativo de los planes.
  // NO usa guestGuard porque también queremos que un usuario logueado pueda
  // ver los planes (ej. llegó por un link compartido) — si está logueado y
  // quiere cambiar de plan, el CTA lo llevará a /app/upgrade desde signup.
  {
    path: 'pricing',
    loadComponent: () =>
      import('./modules/pricing/pricing.component').then((m) => m.PricingComponent),
  },

  // ─── Rutas de auth (login, signup) ────────────────────────────────────────
  {
    path: 'auth',
    canActivate: [guestGuard],
    loadChildren: () =>
      import('./modules/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },

  // ─── Onboarding (solo OWNER post-signup) ──────────────────────────────────
  {
    path: 'onboarding',
    canActivate: [onboardingGuard],
    loadComponent: () =>
      import('./modules/onboarding/onboarding.component').then((m) => m.OnboardingComponent),
  },

  // ─── Rutas protegidas (app interna) ───────────────────────────────────────
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./shared/components/sidebar/sidebar.component').then(
        (m) => m.SidebarComponent
      ),
    children: [
      // Raíz del área autenticada: redirige al home del rol del usuario
      // (Dashboard / POS / Inventario según corresponda).
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () =>
          import('./core/components/role-home-redirect.component').then(
            (m) => m.RoleHomeRedirectComponent
          ),
      },

      {
        path: 'dashboard',
        canActivate: [roleGuard],
        data: { roles: ['OWNER', 'MANAGER'] },
        loadComponent: () =>
          import('./modules/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },

      {
        path: 'inventory',
        canActivate: [roleGuard],
        data: { roles: ['OWNER', 'MANAGER', 'INVENTORY'] },
        loadComponent: () =>
          import('./modules/inventory/inventory.component').then((m) => m.InventoryComponent),
      },

      {
        path: 'recipes',
        canActivate: [roleGuard],
        data: { roles: ['OWNER', 'MANAGER', 'SELLER'] },
        loadComponent: () =>
          import('./modules/recipes/recipes.component').then((m) => m.RecipesComponent),
      },

      {
        path: 'pos',
        canActivate: [roleGuard],
        data: { roles: ['OWNER', 'MANAGER', 'SELLER'] },
        loadComponent: () =>
          import('./modules/pos/pos.component').then((m) => m.PosComponent),
      },

      {
        path: 'reservations',
        canActivate: [roleGuard],
        data: { roles: ['OWNER', 'MANAGER', 'SELLER'] },
        loadComponent: () =>
          import('./modules/reservations/reservations.component').then(
            (m) => m.ReservationsComponent
          ),
      },

      {
        path: 'production',
        canActivate: [roleGuard],
        data: { roles: ['OWNER', 'MANAGER', 'INVENTORY'] },
        loadComponent: () =>
          import('./modules/production/production.component').then((m) => m.ProductionComponent),
      },

      {
        path: 'reports',
        canActivate: [roleGuard],
        data: { roles: ['OWNER'] },
        loadComponent: () =>
          import('./modules/reports/reports.component').then((m) => m.ReportsComponent),
      },

      {
        path: 'settings',
        canActivate: [roleGuard],
        data: { roles: ['OWNER'] },
        loadComponent: () =>
          import('./modules/settings/settings.component').then((m) => m.SettingsComponent),
      },

      {
        path: 'upgrade',
        canActivate: [roleGuard],
        data: { roles: ['OWNER'] },
        loadComponent: () =>
          import('./modules/upgrade/upgrade.component').then((m) => m.UpgradeComponent),
      },
    ],
  },

  // ─── Fallback: cualquier ruta no encontrada → página 404 ─────────────────
  {
    path: '**',
    loadComponent: () =>
      import('./modules/not-found/not-found.component').then((m) => m.NotFoundComponent),
  },
];
