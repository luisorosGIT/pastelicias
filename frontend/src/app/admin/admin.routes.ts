import { Routes } from '@angular/router';
import { adminAuthGuard, adminGuestGuard } from './admin-auth.guard';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'login',
    canActivate: [adminGuestGuard],
    loadComponent: () =>
      import('./pages/admin-login.component').then((m) => m.AdminLoginComponent),
  },
  {
    path: '',
    canActivate: [adminAuthGuard],
    loadComponent: () =>
      import('./admin-layout.component').then((m) => m.AdminLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./pages/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'businesses',
        loadComponent: () =>
          import('./pages/admin-businesses.component').then((m) => m.AdminBusinessesComponent),
      },
      {
        path: 'businesses/:id',
        loadComponent: () =>
          import('./pages/admin-business-detail.component').then((m) => m.AdminBusinessDetailComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./pages/admin-users.component').then((m) => m.AdminUsersComponent),
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./pages/admin-support.component').then((m) => m.AdminSupportComponent),
      },
    ],
  },
];
