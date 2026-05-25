import { Component, OnInit, signal } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '../../core/models';

interface DashboardData {
  businesses: {
    total: number; active: number; new30d: number; new7d: number;
    byPlan: { FREE: number; PRO: number; BUSINESS: number };
  };
  users: { total: number; branches: number };
  sales: {
    total: number;
    last30d: { count: number; revenue: number };
    last7d: { count: number; revenue: number };
  };
  support: { openConversations: number; unreadFromUsers: number };
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CurrencyPipe, RouterLink, MatIconModule, MatProgressSpinnerModule],
  template: `
    <header class="page-head">
      <h1>Dashboard</h1>
      <p>Métricas globales del SaaS Genimatech.</p>
    </header>

    @if (loading()) {
      <div class="loading"><mat-spinner diameter="40" /></div>
    }
    @if (!loading() && data(); as d) {
      <!-- KPIs principales -->
      <section class="grid">
        <article class="kpi">
          <div class="kpi-icon indigo"><mat-icon>storefront</mat-icon></div>
          <div>
            <span class="kpi-label">Negocios totales</span>
            <strong class="kpi-value">{{ d.businesses.total }}</strong>
            <span class="kpi-sub">{{ d.businesses.active }} activos · {{ d.businesses.new30d }} nuevos en 30d</span>
          </div>
        </article>

        <article class="kpi">
          <div class="kpi-icon purple"><mat-icon>people</mat-icon></div>
          <div>
            <span class="kpi-label">Usuarios totales</span>
            <strong class="kpi-value">{{ d.users.total }}</strong>
            <span class="kpi-sub">{{ d.users.branches }} sucursales activas</span>
          </div>
        </article>

        <article class="kpi">
          <div class="kpi-icon pink"><mat-icon>point_of_sale</mat-icon></div>
          <div>
            <span class="kpi-label">Ventas totales</span>
            <strong class="kpi-value">{{ d.sales.total }}</strong>
            <span class="kpi-sub">{{ d.sales.last7d.count }} en últimos 7 días</span>
          </div>
        </article>

        <article class="kpi">
          <div class="kpi-icon green"><mat-icon>payments</mat-icon></div>
          <div>
            <span class="kpi-label">Ingresos 30 días</span>
            <strong class="kpi-value">{{ d.sales.last30d.revenue | currency:'S/ ':'symbol':'1.2-2' }}</strong>
            <span class="kpi-sub">{{ d.sales.last7d.revenue | currency:'S/ ':'symbol':'1.2-2' }} en 7d</span>
          </div>
        </article>
      </section>

      <!-- Plan breakdown -->
      <section class="card">
        <header class="card-head">
          <h3>Distribución por plan</h3>
          <span class="hint">{{ d.businesses.total }} negocios totales</span>
        </header>
        <div class="plans">
          <div class="plan">
            <div class="plan-head">
              <mat-icon>auto_awesome</mat-icon>
              <span>Gratis</span>
            </div>
            <strong>{{ d.businesses.byPlan.FREE }}</strong>
            <span>{{ planPercent(d.businesses.byPlan.FREE, d.businesses.total) }}%</span>
          </div>
          <div class="plan pro">
            <div class="plan-head">
              <mat-icon>bolt</mat-icon>
              <span>Pro</span>
            </div>
            <strong>{{ d.businesses.byPlan.PRO }}</strong>
            <span>{{ planPercent(d.businesses.byPlan.PRO, d.businesses.total) }}%</span>
          </div>
          <div class="plan business">
            <div class="plan-head">
              <mat-icon>apartment</mat-icon>
              <span>Business</span>
            </div>
            <strong>{{ d.businesses.byPlan.BUSINESS }}</strong>
            <span>{{ planPercent(d.businesses.byPlan.BUSINESS, d.businesses.total) }}%</span>
          </div>
        </div>
      </section>

      <!-- Soporte -->
      <section class="card">
        <header class="card-head">
          <h3>Soporte</h3>
        </header>
        <div class="support-grid">
          <div class="support-stat">
            <strong>{{ d.support.openConversations }}</strong>
            <span>Conversaciones abiertas</span>
          </div>
          <div class="support-stat" [class.alert]="d.support.unreadFromUsers > 0">
            <strong>{{ d.support.unreadFromUsers }}</strong>
            <span>Mensajes sin leer</span>
          </div>
        </div>
        @if (data()?.support?.unreadFromUsers ?? 0; as unread) {
          @if (unread > 0) {
            <a routerLink="/admin/support" class="cta-link">
              Ver mensajes pendientes <mat-icon>arrow_forward</mat-icon>
            </a>
          }
        }
      </section>
    }
    @if (!loading() && !data() && error()) {
      <div class="error-state">
        <mat-icon>error_outline</mat-icon>
        <p>{{ error() }}</p>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .page-head { margin-bottom: 24px; }
    .page-head h1 { margin: 0 0 4px 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em; color: #0f172a; }
    .page-head p { margin: 0; color: #64748b; font-size: 14.5px; }

    .loading { display: flex; justify-content: center; padding: 64px; }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .kpi {
      display: flex; gap: 14px; align-items: flex-start;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 18px;
    }
    .kpi-icon {
      width: 44px; height: 44px;
      border-radius: 11px;
      display: flex; align-items: center; justify-content: center;
      color: #fff;
      flex-shrink: 0;
    }
    .kpi-icon.indigo { background: linear-gradient(135deg, #4f46e5, #6366f1); }
    .kpi-icon.purple { background: linear-gradient(135deg, #9333ea, #a855f7); }
    .kpi-icon.pink   { background: linear-gradient(135deg, #ec4899, #f43f5e); }
    .kpi-icon.green  { background: linear-gradient(135deg, #10b981, #059669); }
    .kpi-icon mat-icon { font-size: 22px; width: 22px; height: 22px; }
    .kpi-label { display: block; font-size: 12px; font-weight: 600; color: #64748b; text-transform: uppercase; letter-spacing: 0.04em; }
    .kpi-value { display: block; font-size: 28px; font-weight: 800; letter-spacing: -0.02em; color: #0f172a; margin: 4px 0 2px; }
    .kpi-sub { display: block; font-size: 12.5px; color: #94a3b8; }

    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      padding: 20px;
      margin-bottom: 16px;
    }
    .card-head {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 16px;
    }
    .card-head h3 { margin: 0; font-size: 16px; font-weight: 700; color: #0f172a; }
    .hint { font-size: 12.5px; color: #94a3b8; }

    .plans {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }
    .plan {
      padding: 16px;
      background: #f8fafc;
      border-radius: 10px;
      text-align: center;
    }
    .plan.pro { background: #eef2ff; }
    .plan.business { background: #f3e8ff; }
    .plan-head {
      display: inline-flex; align-items: center; gap: 6px;
      color: #475569;
      font-size: 13px; font-weight: 600;
      margin-bottom: 8px;
    }
    .plan-head mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .plan.pro .plan-head { color: #4f46e5; }
    .plan.business .plan-head { color: #9333ea; }
    .plan strong { display: block; font-size: 28px; font-weight: 800; letter-spacing: -0.02em; color: #0f172a; }
    .plan span { font-size: 12px; color: #94a3b8; }

    .support-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 12px;
    }
    .support-stat {
      padding: 16px;
      background: #f8fafc;
      border-radius: 10px;
      text-align: center;
    }
    .support-stat.alert { background: #fee2e2; }
    .support-stat strong { display: block; font-size: 28px; font-weight: 800; color: #0f172a; }
    .support-stat.alert strong { color: #b91c1c; }
    .support-stat span { font-size: 12.5px; color: #64748b; }
    .cta-link {
      display: inline-flex; align-items: center; gap: 4px;
      margin-top: 14px;
      color: #4f46e5;
      font-weight: 600; font-size: 14px;
      text-decoration: none;
    }
    .cta-link:hover { text-decoration: underline; }
    .cta-link mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .error-state {
      padding: 32px;
      text-align: center;
      color: #b91c1c;
      background: #fee2e2;
      border-radius: 12px;
    }
  `],
})
export class AdminDashboardComponent implements OnInit {
  loading = signal(true);
  data = signal<DashboardData | null>(null);
  error = signal('');

  constructor(private http: HttpClient) {}

  async ngOnInit(): Promise<void> {
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<DashboardData>>(`${environment.apiUrl}/admin/dashboard`)
      );
      if (res.success && res.data) this.data.set(res.data);
    } catch {
      this.error.set('No se pudo cargar el dashboard.');
    } finally {
      this.loading.set(false);
    }
  }

  planPercent(part: number, total: number): number {
    if (total === 0) return 0;
    return Math.round((part / total) * 100);
  }
}
