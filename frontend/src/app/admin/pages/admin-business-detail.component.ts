import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '../../core/models';
import { getErrorMessage } from '../../core/utils/error-message';

interface BusinessDetail {
  id: string;
  name: string;
  plan: 'FREE' | 'PRO' | 'BUSINESS';
  taxRate: number;
  ruc: string | null;
  onboardingCompleted: boolean;
  trialEndsAt: string | null;
  createdAt: string;
  branches: { id: string; name: string; isActive: boolean }[];
  users: {
    id: string; email: string; fullName: string; role: string;
    isActive: boolean; branchId: string | null; branch: { name: string } | null;
  }[];
  kpis: { totalSales: number; revenue: number; ingredients: number; recipes: number };
}

@Component({
  selector: 'app-admin-business-detail',
  standalone: true,
  imports: [CommonModule, RouterLink, CurrencyPipe, DatePipe, MatIconModule, MatProgressSpinnerModule],
  template: `
    <a routerLink="/admin/businesses" class="back">
      <mat-icon>arrow_back</mat-icon> Volver al listado
    </a>

    @if (loading()) {
      <div class="loading"><mat-spinner diameter="36" /></div>
    }
    @if (!loading() && data(); as d) {
      <header class="head">
        <div>
          <h1>{{ d.name }}</h1>
          <p class="muted">
            Creado el {{ d.createdAt | date:'dd/MM/yyyy HH:mm' }}
            @if (d.ruc) { · RUC: {{ d.ruc }} }
          </p>
        </div>
        <span class="plan-tag" [class.pro]="d.plan === 'PRO'" [class.business]="d.plan === 'BUSINESS'">
          {{ planLabel(d.plan) }}
        </span>
      </header>

      <!-- Acciones rápidas: cambiar plan -->
      <section class="actions">
        <strong>Cambiar plan:</strong>
        <button (click)="changePlan('FREE')" [disabled]="saving() || d.plan === 'FREE'">Gratis</button>
        <button (click)="changePlan('PRO')" [disabled]="saving() || d.plan === 'PRO'">Pro</button>
        <button (click)="changePlan('BUSINESS')" [disabled]="saving() || d.plan === 'BUSINESS'">Business</button>
        @if (saving()) { <mat-spinner diameter="18" /> }
      </section>

      <!-- KPIs -->
      <section class="kpi-grid">
        <div class="kpi">
          <span>Ventas totales</span>
          <strong>{{ d.kpis.totalSales }}</strong>
        </div>
        <div class="kpi">
          <span>Ingresos totales</span>
          <strong>{{ d.kpis.revenue | currency:'S/ ':'symbol':'1.2-2' }}</strong>
        </div>
        <div class="kpi">
          <span>Insumos</span>
          <strong>{{ d.kpis.ingredients }}</strong>
        </div>
        <div class="kpi">
          <span>Recetas activas</span>
          <strong>{{ d.kpis.recipes }}</strong>
        </div>
      </section>

      <!-- Sucursales -->
      <section class="card">
        <h3>Sucursales ({{ d.branches.length }})</h3>
        <ul class="list">
          @for (b of d.branches; track b.id) {
            <li>
              <mat-icon>store</mat-icon>
              <span>{{ b.name }}</span>
              @if (!b.isActive) { <span class="tag-inactive">Inactiva</span> }
            </li>
          }
        </ul>
      </section>

      <!-- Usuarios -->
      <section class="card">
        <h3>Usuarios ({{ d.users.length }})</h3>
        <div class="table-wrap">
          <table class="table">
            <thead>
              <tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Sucursal</th><th>Estado</th></tr>
            </thead>
            <tbody>
              @for (u of d.users; track u.id) {
                <tr>
                  <td><strong>{{ u.fullName }}</strong></td>
                  <td>{{ u.email }}</td>
                  <td><span class="role-tag">{{ u.role }}</span></td>
                  <td>{{ u.branch?.name ?? '(global)' }}</td>
                  <td>
                    @if (u.isActive) {
                      <span class="badge ok">Activo</span>
                    } @else {
                      <span class="badge off">Inactivo</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
    }
    @if (!loading() && !data()) {
      <div class="error">No se encontró el negocio.</div>
    }
  `,
  styles: [`
    :host { display: block; }
    .back {
      display: inline-flex; align-items: center; gap: 6px;
      color: #475569; font-size: 14px;
      text-decoration: none;
      margin-bottom: 16px;
    }
    .back:hover { color: #4f46e5; }
    .back mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .loading { display: flex; justify-content: center; padding: 48px; }
    .error { padding: 32px; text-align: center; color: #b91c1c; background: #fee2e2; border-radius: 12px; }

    .head {
      display: flex; align-items: flex-start; justify-content: space-between;
      margin-bottom: 24px;
      gap: 16px;
    }
    .head h1 { margin: 0 0 6px 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em; color: #0f172a; }
    .muted { color: #94a3b8; font-size: 13.5px; margin: 0; }

    .plan-tag {
      padding: 6px 14px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.04em;
      background: #f1f5f9;
      color: #475569;
    }
    .plan-tag.pro { background: #eef2ff; color: #4f46e5; }
    .plan-tag.business { background: #f3e8ff; color: #9333ea; }

    .actions {
      display: flex; align-items: center; gap: 8px;
      padding: 14px 18px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      margin-bottom: 20px;
      flex-wrap: wrap;
    }
    .actions strong { font-size: 13.5px; color: #475569; margin-right: 4px; }
    .actions button {
      padding: 6px 14px;
      background: #fff;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      cursor: pointer;
      font-family: inherit;
      font-size: 13px;
      font-weight: 600;
      transition: background 0.15s, border-color 0.15s;
    }
    .actions button:hover:not(:disabled) {
      background: #f9fafb;
      border-color: #4f46e5;
      color: #4f46e5;
    }
    .actions button:disabled { opacity: 0.5; cursor: not-allowed; }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .kpi {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 16px;
    }
    .kpi span { font-size: 12px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.04em; font-weight: 600; }
    .kpi strong { display: block; font-size: 22px; font-weight: 800; color: #0f172a; margin-top: 4px; }

    .card {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 16px;
    }
    .card h3 { margin: 0 0 12px 0; font-size: 15px; font-weight: 700; color: #0f172a; }
    .list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 4px; }
    .list li {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 0;
      font-size: 14px; color: #1f2937;
    }
    .list mat-icon { color: #94a3b8; font-size: 18px; width: 18px; height: 18px; }
    .tag-inactive {
      margin-left: 8px;
      padding: 2px 8px;
      background: #fee2e2;
      color: #b91c1c;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 600;
    }

    .table-wrap {
      overflow-x: auto;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
    }
    .table { width: 100%; border-collapse: collapse; font-size: 13.5px; }
    .table th {
      text-align: left;
      padding: 10px 12px;
      background: #f8fafc;
      font-weight: 700;
      color: #475569;
      font-size: 11.5px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .table td { padding: 10px 12px; border-top: 1px solid #f1f5f9; }
    .role-tag {
      padding: 2px 8px;
      background: #eef2ff;
      color: #4f46e5;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
    }
    .badge {
      padding: 2px 8px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge.ok { background: #dcfce7; color: #166534; }
    .badge.off { background: #f1f5f9; color: #64748b; }
  `],
})
export class AdminBusinessDetailComponent implements OnInit {
  loading = signal(true);
  saving = signal(false);
  data = signal<BusinessDetail | null>(null);

  constructor(
    private route: ActivatedRoute,
    private http: HttpClient,
    private snack: MatSnackBar,
  ) {}

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    await this.load(id);
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponse<BusinessDetail>>(`${environment.apiUrl}/admin/businesses/${id}`)
      );
      if (res.success && res.data) this.data.set(res.data);
    } finally {
      this.loading.set(false);
    }
  }

  async changePlan(plan: 'FREE' | 'PRO' | 'BUSINESS'): Promise<void> {
    const d = this.data();
    if (!d) return;
    if (!confirm(`¿Cambiar plan de "${d.name}" a ${plan}?`)) return;
    this.saving.set(true);
    try {
      await firstValueFrom(
        this.http.patch<ApiResponse>(`${environment.apiUrl}/admin/businesses/${d.id}`, { plan })
      );
      this.snack.open(`Plan cambiado a ${plan}`, 'OK', { duration: 3000 });
      await this.load(d.id);
    } catch (err: unknown) {
      this.snack.open(getErrorMessage(err, 'No se pudo cambiar el plan'), 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  planLabel(p: string): string {
    return p === 'FREE' ? 'Gratis' : p === 'PRO' ? 'Pro' : 'Business';
  }
}
