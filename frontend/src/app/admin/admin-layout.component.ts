import { Component } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AdminAuthService } from './admin-auth.service';

interface NavItem {
  label: string;
  icon: string;
  route: string;
}

const NAV: NavItem[] = [
  { label: 'Dashboard',  icon: 'dashboard',  route: '/admin/dashboard' },
  { label: 'Negocios',   icon: 'storefront', route: '/admin/businesses' },
  { label: 'Usuarios',   icon: 'people',     route: '/admin/users' },
  { label: 'Soporte',    icon: 'support_agent', route: '/admin/support' },
];

/**
 * Layout del panel admin (sidebar oscuro + topbar minimal + outlet).
 * Distinto del SidebarComponent que es para el business owner.
 */
@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatIconModule, MatButtonModule, MatMenuModule, MatTooltipModule,
  ],
  template: `
    <div class="admin-shell">
      <aside class="sidebar">
        <div class="brand">
          <img src="assets/branding/logo.png" alt="" class="logo" />
          <div>
            <strong>Genimatech</strong>
            <span class="badge">ADMIN</span>
          </div>
        </div>

        <nav class="nav">
          @for (n of nav; track n.route) {
            <a [routerLink]="n.route" routerLinkActive="active" class="nav-item">
              <mat-icon>{{ n.icon }}</mat-icon>
              <span>{{ n.label }}</span>
            </a>
          }
        </nav>

        <div class="bottom">
          <button mat-flat-button [matMenuTriggerFor]="adminMenu" class="admin-btn">
            <div class="avatar">{{ initials() }}</div>
            <div class="admin-info">
              <strong>{{ auth.admin()?.name }}</strong>
              <span>{{ auth.admin()?.email }}</span>
            </div>
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #adminMenu="matMenu">
            <button mat-menu-item (click)="auth.logout()">
              <mat-icon>logout</mat-icon> Cerrar sesión
            </button>
          </mat-menu>
        </div>
      </aside>

      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .admin-shell {
      display: grid;
      grid-template-columns: 260px 1fr;
      min-height: 100vh;
      background: #0f172a;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    }

    /* ─── Sidebar ─── */
    .sidebar {
      background: #0f172a;
      color: #e2e8f0;
      display: flex; flex-direction: column;
      padding: 24px 16px;
      border-right: 1px solid rgba(255, 255, 255, 0.08);
    }
    .brand {
      display: flex; align-items: center; gap: 12px;
      padding: 4px 8px 24px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.08);
      margin-bottom: 16px;
    }
    .logo { width: 40px; height: 40px; border-radius: 10px; object-fit: cover; }
    .brand strong {
      display: block;
      font-size: 16px; font-weight: 700;
      color: #fff;
      letter-spacing: -0.01em;
    }
    .badge {
      display: inline-block;
      margin-top: 4px;
      padding: 2px 8px;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
      border-radius: 6px;
      font-size: 10px;
      font-weight: 800;
      letter-spacing: 0.08em;
    }

    .nav {
      display: flex; flex-direction: column;
      gap: 4px;
      flex: 1;
    }
    .nav-item {
      display: flex; align-items: center; gap: 12px;
      padding: 10px 12px;
      color: #cbd5e1;
      text-decoration: none;
      border-radius: 8px;
      font-size: 14.5px;
      font-weight: 500;
      transition: background 0.15s, color 0.15s;
    }
    .nav-item:hover { background: rgba(255, 255, 255, 0.05); color: #fff; }
    .nav-item.active {
      background: linear-gradient(135deg, rgba(79, 70, 229, 0.3), rgba(147, 51, 234, 0.2));
      color: #fff;
      font-weight: 600;
    }
    .nav-item mat-icon { font-size: 20px; width: 20px; height: 20px; }

    .bottom {
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
    }
    .admin-btn {
      width: 100%;
      display: flex !important;
      align-items: center !important;
      justify-content: flex-start !important;
      gap: 10px;
      padding: 8px 8px !important;
      background: transparent !important;
      color: #e2e8f0 !important;
      border-radius: 10px !important;
      text-align: left;
      min-height: 56px;
    }
    .admin-btn:hover { background: rgba(255, 255, 255, 0.05) !important; }
    .avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 13px;
      flex-shrink: 0;
    }
    .admin-info { flex: 1; min-width: 0; line-height: 1.2; }
    .admin-info strong {
      display: block;
      font-size: 13px; font-weight: 600;
      color: #fff;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .admin-info span {
      display: block;
      font-size: 11.5px;
      color: #94a3b8;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }

    /* ─── Content area ─── */
    .content {
      background: #f8fafc;
      overflow-y: auto;
      padding: 32px;
    }
    @media (max-width: 1024px) {
      .admin-shell { grid-template-columns: 1fr; }
      .sidebar { display: none; }
      .content { padding: 16px; }
    }
  `],
})
export class AdminLayoutComponent {
  nav = NAV;

  constructor(public auth: AdminAuthService) {}

  initials(): string {
    const name = this.auth.admin()?.name || 'A';
    return name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  }
}
