import { Component, OnInit, computed, effect, signal } from '@angular/core';
import { Router, RouterOutlet, RouterLink, RouterLinkActive, NavigationEnd } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { AuthService } from '../../../core/services/auth.service';
import { BranchService } from '../../../core/services/branch.service';
import { SettingsService } from '../../../core/services/settings.service';
import { PlanService } from '../../../core/services/plan.service';
import { BranchSelectorComponent } from '../branch-selector/branch-selector.component';
import { Role } from '../../../core/models';

interface NavItem {
  label: string;
  icon: string;
  route: string;
  roles: Role[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',     icon: 'dashboard',        route: '/app/dashboard',     roles: ['OWNER', 'MANAGER'] },
  { label: 'Inventario',    icon: 'inventory_2',       route: '/app/inventory',     roles: ['OWNER', 'MANAGER', 'INVENTORY'] },
  { label: 'Productos',     icon: 'menu_book',         route: '/app/recipes',       roles: ['OWNER', 'MANAGER', 'SELLER'] },
  { label: 'POS',           icon: 'point_of_sale',     route: '/app/pos',           roles: ['OWNER', 'MANAGER', 'SELLER'] },
  { label: 'Reservaciones', icon: 'event_note',        route: '/app/reservations',  roles: ['OWNER', 'MANAGER', 'SELLER'] },
  { label: 'Producción',    icon: 'bakery_dining',     route: '/app/production',    roles: ['OWNER', 'MANAGER', 'INVENTORY'] },
  { label: 'Reportes',      icon: 'bar_chart',         route: '/app/reports',       roles: ['OWNER'] },
  { label: 'Configuración', icon: 'settings',          route: '/app/settings',      roles: ['OWNER'] },
];

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [
    RouterOutlet, RouterLink, RouterLinkActive,
    MatIconModule, MatButtonModule, MatTooltipModule, MatMenuModule,
    BranchSelectorComponent,
  ],
  template: `
    <div class="layout">
      <!-- ─── Sidebar ─────────────────────────────────────── -->
      <aside class="sidebar">
        <div class="sidebar-brand">
          <div class="brand-logo">
            @if (brandLogoUrl()) {
              <img [src]="brandLogoUrl()" [alt]="brandName()" (error)="onBrandLogoError()" />
            } @else {
              <img src="assets/branding/logo.png" alt="Pastelicias" class="brand-fallback-img" />
            }
          </div>
          <div class="brand-text">
            <span class="brand-name">{{ brandName() }}</span>
            <span class="brand-tag">{{ roleLabel() || 'Administración' }}</span>
          </div>
        </div>

        <nav class="sidebar-nav">
          @for (item of visibleNavItems(); track item.route) {
            <a [routerLink]="item.route" routerLinkActive="active" class="nav-item">
              <mat-icon>{{ item.icon }}</mat-icon>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        <div class="sidebar-footer">
          <button class="logout-btn" (click)="logout()">
            <mat-icon>logout</mat-icon>
            <span>Cerrar sesión</span>
          </button>
        </div>
      </aside>

      <!-- ─── Main ───────────────────────────────────────── -->
      <div class="main-wrapper">
        <!-- Header -->
        <header class="top-bar">
          <div class="top-bar-left">
            <h2 class="mobile-title">{{ brandName() }}</h2>
            <div class="breadcrumb-container">
              <span class="breadcrumb">General</span>
              <mat-icon class="breadcrumb-arrow">chevron_right</mat-icon>
              <span class="page-title">{{ currentPageTitle() }}</span>
            </div>
          </div>
          <div class="top-bar-right">
            @if (isOwner()) {
              <app-branch-selector />
            }
            <button mat-icon-button class="icon-btn" matTooltip="Notificaciones">
              <mat-icon>notifications</mat-icon>
            </button>
            <button mat-icon-button class="icon-btn help-btn" matTooltip="Ayuda">
              <mat-icon>help</mat-icon>
            </button>
            <button mat-icon-button [matMenuTriggerFor]="userMenu" class="avatar-btn">
              <div class="avatar">{{ userInitials() }}</div>
            </button>
            <mat-menu #userMenu="matMenu">
              <div class="user-menu-header">
                <strong>{{ user()?.fullName }}</strong>
                <small>{{ roleLabel() }}</small>
              </div>
              <button mat-menu-item (click)="logout()">
                <mat-icon>logout</mat-icon>
                Cerrar Sesión
              </button>
            </mat-menu>
          </div>
        </header>

        <!-- Banner del trial gratis: visible cuando quedan ≤7 días o expiró -->
        @if (plan.shouldShowTrialBanner()) {
          <div class="trial-banner" [class.expired]="plan.trialExpired()">
            <mat-icon>{{ plan.trialExpired() ? 'lock' : 'schedule' }}</mat-icon>
            <span class="trial-msg">
              @if (plan.trialExpired()) {
                <strong>Tu prueba gratuita terminó.</strong>
                Mejora tu plan para seguir usando Pastelicias.
              } @else {
                <strong>Tu prueba gratuita termina en {{ plan.trialDaysLeft() }} {{ plan.trialDaysLeft() === 1 ? 'día' : 'días' }}.</strong>
                Mejora tu plan antes que expire.
              }
            </span>
            <a [routerLink]="['/app/upgrade']" class="trial-cta">
              Ver planes <mat-icon>arrow_forward</mat-icon>
            </a>
          </div>
        }

        <!-- Content -->
        <main class="content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .layout {
      display: flex;
      height: 100vh;
      background: var(--color-bg);
      color: var(--color-on-background);
    }

    /* ─── Sidebar ─── */
    .sidebar {
      width: var(--sidebar-width);
      min-width: var(--sidebar-width);
      background: var(--color-surface);
      border: none;
      display: flex;
      flex-direction: column;
      padding: 0;
      box-shadow: var(--shadow-sm);
      z-index: 50;
    }

    .sidebar-brand {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 24px;
    }
    .brand-logo {
      width: 40px;
      height: 40px;
      border-radius: var(--radius-lg);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: transparent;
    }
    .brand-logo mat-icon {
      font-variation-settings: 'FILL' 1;
    }
    .brand-logo img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .brand-fallback-img {
      width: 100%; height: 100%;
      object-fit: cover;
    }
    .brand-text { display: flex; flex-direction: column; line-height: 1.2; }
    .brand-name {
      font-size: 20px;
      font-weight: 700;
      color: var(--color-primary);
      letter-spacing: -0.01em;
    }
    .brand-tag {
      font-size: 12px;
      font-weight: 500;
      color: var(--color-on-surface-variant);
    }

    .sidebar-nav {
      flex: 1;
      padding: 16px 0;
      display: flex;
      flex-direction: column;
      overflow-y: auto;
    }

    .nav-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      margin: 4px 8px;
      border-radius: var(--radius-lg);
      color: var(--color-on-surface-variant);
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      transition: all 0.2s ease;
    }
    .nav-item mat-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
      color: inherit;
      font-variation-settings: 'FILL' 0;
    }
    .nav-item:hover {
      background: var(--color-surface-container-high);
    }
    .nav-item.active {
      background: var(--color-primary-fixed);
      color: var(--color-on-primary-fixed);
      font-weight: 700;
    }
    .nav-item.active mat-icon {
      font-variation-settings: 'FILL' 1;
      color: var(--color-primary);
    }

    .sidebar-footer {
      padding: 16px;
      border-top: 1px solid var(--color-outline-variant);
    }
    .logout-btn {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      margin: 4px 0;
      border-radius: var(--radius-lg);
      background: transparent;
      border: none;
      color: var(--color-on-surface-variant);
      font-size: 14px;
      font-weight: 600;
      font-family: inherit;
      cursor: pointer;
      transition: all 0.2s;
    }
    .logout-btn:hover { 
      background: var(--color-surface-container-high); 
    }
    .logout-btn mat-icon { font-size: 24px; width: 24px; height: 24px; }

    /* ─── Main wrapper ─── */
    .main-wrapper {
      flex: 1;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      min-width: 0;
      background: var(--color-bg);
    }

    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 24px;
      height: var(--topbar-height);
      background: var(--color-surface);
      border: none;
      box-shadow: var(--shadow-sm);
      position: sticky;
      top: 0;
      z-index: 40;
    }

    .top-bar-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
    .mobile-title {
      display: none;
      font-size: 18px;
      font-weight: 600;
      color: var(--color-on-surface);
      margin: 0;
    }
    .breadcrumb-container {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .breadcrumb { color: var(--color-on-surface-variant); font-size: 12px; font-weight: 500; }
    .breadcrumb-arrow {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: var(--color-on-surface-variant);
    }
    .page-title {
      color: var(--color-primary);
      font-weight: 700;
      font-size: 12px;
    }

    .top-bar-right { display: flex; align-items: center; gap: 8px; }
    .icon-btn { 
      color: var(--color-on-surface-variant) !important; 
      border-radius: var(--radius-full) !important;
    }
    .icon-btn:hover {
      background: var(--color-surface-container-low) !important;
    }

    .avatar-btn { padding: 0; margin-left: 8px; }
    .avatar {
      width: 32px;
      height: 32px;
      border-radius: var(--radius-full);
      background: var(--color-secondary-container);
      color: var(--color-on-secondary-container);
      font-weight: 700;
      font-size: 11px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .user-menu-header {
      padding: 14px 18px;
      border-bottom: 1px solid var(--color-outline-variant);
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .user-menu-header strong { font-size: 14px; color: var(--color-on-surface); }
    .user-menu-header small { font-size: 12px; color: var(--color-on-surface-variant); }

    .content {
      flex: 1;
      overflow-x: hidden;
      overflow-y: auto;
      padding: var(--space-6) var(--space-8);
    }

    /* ─── Banner del trial ─── */
    .trial-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 24px;
      background: linear-gradient(90deg, #fef3c7 0%, #fde68a 100%);
      border-bottom: 1px solid #fcd34d;
      color: #78350f;
      font-size: 14px;
      line-height: 1.4;
      flex-wrap: wrap;
    }
    .trial-banner.expired {
      background: linear-gradient(90deg, #fee2e2 0%, #fecaca 100%);
      border-bottom-color: #fca5a5;
      color: #7f1d1d;
    }
    .trial-banner > mat-icon {
      flex-shrink: 0;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .trial-banner .trial-msg { flex: 1; min-width: 240px; }
    .trial-banner .trial-msg strong { font-weight: 700; margin-right: 4px; }
    .trial-banner .trial-cta {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 6px 14px;
      background: #fff;
      color: #4648d4;
      border-radius: 100px;
      font-weight: 700;
      font-size: 13px;
      text-decoration: none;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      white-space: nowrap;
    }
    .trial-banner.expired .trial-cta { color: #dc2626; }
    .trial-banner .trial-cta:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12);
    }
    .trial-banner .trial-cta mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
    }

    @media (max-width: 768px) {
      .sidebar { display: none; }
      .mobile-title { display: block; }
      .breadcrumb-container { display: none; }
      .help-btn { display: none; }
      .content { padding: var(--space-4); }
      .trial-banner { padding: 10px 16px; font-size: 13px; }
    }
  `],
})
export class SidebarComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private router: Router,
    public branchService: BranchService,
    private settings: SettingsService,
    public plan: PlanService
  ) {
    // Initial title
    const url = this.router.url;
    const item = NAV_ITEMS.find((i) => url.startsWith(i.route));
    this.currentPageTitle.set(item?.label ?? 'Pastelicias');

    // Update on navigation
    this.router.events.subscribe(event => {
      if (event instanceof NavigationEnd) {
        const url = event.urlAfterRedirects;
        const navItem = NAV_ITEMS.find((i) => url.startsWith(i.route));
        this.currentPageTitle.set(navItem?.label ?? 'Pastelicias');
      }
    });
  }

  async ngOnInit(): Promise<void> {
    // Asegurar que el nombre del negocio esté disponible para mostrarlo en el sidebar.
    // loadBusiness() es idempotente — si ya está cargado, no re-pide.
    if (this.authService.isAuthenticated()) {
      await Promise.all([
        this.settings.loadBusiness(),
        // Carga el plan para que el banner del trial se evalúe.
        this.plan.load(),
      ]);
    }
  }

  user = this.authService.user;
  isOwner = computed(() => this.authService.role() === 'OWNER');

  /** Nombre del negocio mostrado en el sidebar y mobile title. Si aún no se ha
   *  cargado (primer render), usa "Pastelicias" como fallback. */
  brandName = computed(() => this.settings.business()?.name ?? 'Pastelicias');

  /** True si la imagen del logo falló al cargar — vuelve al ícono default. */
  private brandLogoFailed = signal(false);

  /** URL del logo a usar en el sidebar. Si el negocio no tiene logoUrl o si
   *  falló al cargar, devuelve null para que se renderice el ícono <mat-icon>cake</mat-icon>. */
  brandLogoUrl = computed(() => {
    if (this.brandLogoFailed()) return null;
    return this.settings.business()?.logoUrl ?? null;
  });

  /** Si una nueva URL se carga (después de editar), resetear el flag de error. */
  private resetLogoErrorOnChange = effect(() => {
    // Lee el logoUrl para crear dependencia — cuando cambia se ejecuta este efecto.
    this.settings.business()?.logoUrl;
    this.brandLogoFailed.set(false);
  }, { allowSignalWrites: true });

  onBrandLogoError(): void {
    this.brandLogoFailed.set(true);
  }

  visibleNavItems = computed(() => {
    const role = this.authService.role();
    if (!role) return [];
    return NAV_ITEMS.filter((item) => item.roles.includes(role));
  });

  currentPageTitle = signal('Pastelicias');

  userInitials = computed(() => {
    const name = this.authService.user()?.fullName ?? '';
    return name
      .split(' ')
      .slice(0, 2)
      .map((n) => n[0])
      .join('')
      .toUpperCase();
  });

  roleLabel = computed(() => {
    const labels: Record<string, string> = {
      OWNER: 'Propietario', MANAGER: 'Gerente', SELLER: 'Vendedor', INVENTORY: 'Inventario',
    };
    return labels[this.authService.role() ?? ''] ?? '';
  });

  async logout(): Promise<void> {
    await this.authService.logout();
  }
}
