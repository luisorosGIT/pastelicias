import { Component, OnInit, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '../../core/models';

interface BusinessRow {
  id: string;
  name: string;
  plan: 'FREE' | 'PRO' | 'BUSINESS';
  onboardingCompleted: boolean;
  trialEndsAt: string | null;
  createdAt: string;
  _count: { branches: number; users: number };
}

@Component({
  selector: 'app-admin-businesses',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, DatePipe, MatIconModule, MatProgressSpinnerModule],
  template: `
    <header class="page-head">
      <h1>Negocios</h1>
      <p>Lista de todas las pastelerías registradas en Genimatech.</p>
    </header>

    <div class="filters">
      <div class="search">
        <mat-icon>search</mat-icon>
        <input type="text" [(ngModel)]="searchTerm" (input)="onSearch()"
               placeholder="Buscar por nombre…" />
      </div>
      <div class="plan-filter">
        <select [(ngModel)]="planFilter" (change)="reload()">
          <option value="">Todos los planes</option>
          <option value="FREE">Gratis</option>
          <option value="PRO">Pro</option>
          <option value="BUSINESS">Business</option>
        </select>
      </div>
    </div>

    @if (loading()) {
      <div class="loading"><mat-spinner diameter="36" /></div>
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Negocio</th>
              <th>Plan</th>
              <th>Sucursales</th>
              <th>Usuarios</th>
              <th>Onboarding</th>
              <th>Trial</th>
              <th>Creado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (b of businesses(); track b.id) {
              <tr>
                <td><strong>{{ b.name }}</strong></td>
                <td>
                  <span class="plan-tag" [class.pro]="b.plan === 'PRO'"
                        [class.business]="b.plan === 'BUSINESS'">
                    {{ planLabel(b.plan) }}
                  </span>
                </td>
                <td>{{ b._count.branches }}</td>
                <td>{{ b._count.users }}</td>
                <td>
                  @if (b.onboardingCompleted) {
                    <span class="badge ok"><mat-icon>check_circle</mat-icon> Completo</span>
                  } @else {
                    <span class="badge pending"><mat-icon>hourglass_empty</mat-icon> Pendiente</span>
                  }
                </td>
                <td>
                  @if (b.trialEndsAt) {
                    <span [class]="trialClass(b.trialEndsAt)">
                      {{ trialLabel(b.trialEndsAt) }}
                    </span>
                  } @else {
                    <span class="muted">—</span>
                  }
                </td>
                <td class="muted">{{ b.createdAt | date:'dd/MM/yy' }}</td>
                <td>
                  <a [routerLink]="['/admin/businesses', b.id]" class="row-link">
                    Ver <mat-icon>chevron_right</mat-icon>
                  </a>
                </td>
              </tr>
            }
            @if (businesses().length === 0) {
              <tr>
                <td colspan="8" class="empty">Sin negocios con esos filtros.</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    }
  `,
  styles: [`
    :host { display: block; }
    .page-head h1 { margin: 0 0 4px 0; font-size: 28px; font-weight: 800; letter-spacing: -0.025em; color: #0f172a; }
    .page-head p { margin: 0 0 24px; color: #64748b; font-size: 14.5px; }

    .filters {
      display: flex; gap: 12px; flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .search {
      flex: 1; min-width: 240px;
      position: relative;
      display: flex; align-items: center;
    }
    .search mat-icon {
      position: absolute; left: 12px;
      color: #94a3b8;
      pointer-events: none;
    }
    .search input {
      width: 100%; height: 42px;
      padding: 0 14px 0 40px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 14px; font-family: inherit;
      outline: none;
    }
    .search input:focus { border-color: #4f46e5; box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12); }
    .plan-filter select {
      height: 42px;
      padding: 0 14px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      font-size: 14px; font-family: inherit;
      outline: none;
      cursor: pointer;
    }

    .loading { display: flex; justify-content: center; padding: 48px; }
    .table-wrap {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
    }
    .table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .table th {
      text-align: left;
      padding: 12px 16px;
      background: #f8fafc;
      font-weight: 700;
      color: #475569;
      font-size: 12px;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      border-bottom: 1px solid #e2e8f0;
    }
    .table td {
      padding: 12px 16px;
      border-bottom: 1px solid #f1f5f9;
      color: #1f2937;
    }
    .table tr:hover td { background: #fafbff; }
    .table tr:last-child td { border-bottom: none; }
    .empty {
      text-align: center !important;
      color: #94a3b8;
      padding: 32px !important;
      font-style: italic;
    }
    .muted { color: #94a3b8; }

    .plan-tag {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      background: #f1f5f9;
      color: #475569;
    }
    .plan-tag.pro { background: #eef2ff; color: #4f46e5; }
    .plan-tag.business { background: #f3e8ff; color: #9333ea; }

    .badge {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 3px 10px;
      border-radius: 100px;
      font-size: 11.5px;
      font-weight: 600;
    }
    .badge mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .badge.ok { background: #dcfce7; color: #166534; }
    .badge.pending { background: #fef3c7; color: #92400e; }

    .row-link {
      display: inline-flex; align-items: center; gap: 2px;
      color: #4f46e5;
      font-weight: 600;
      text-decoration: none;
      font-size: 13px;
    }
    .row-link mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .row-link:hover { text-decoration: underline; }

    .trial-ok { color: #475569; font-size: 13px; }
    .trial-warning { color: #d97706; font-size: 13px; font-weight: 600; }
    .trial-expired { color: #dc2626; font-size: 13px; font-weight: 600; }
  `],
})
export class AdminBusinessesComponent implements OnInit {
  loading = signal(true);
  businesses = signal<BusinessRow[]>([]);
  searchTerm = '';
  planFilter = '';
  private searchTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(private http: HttpClient) {}

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  async reload(): Promise<void> {
    this.loading.set(true);
    try {
      let params = new HttpParams();
      if (this.searchTerm.trim()) params = params.set('q', this.searchTerm.trim());
      if (this.planFilter) params = params.set('plan', this.planFilter);

      const res = await firstValueFrom(
        this.http.get<ApiResponse<BusinessRow[]>>(`${environment.apiUrl}/admin/businesses`, { params })
      );
      if (res.success && res.data) this.businesses.set(res.data);
    } finally {
      this.loading.set(false);
    }
  }

  onSearch(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.reload(), 350);
  }

  planLabel(p: string): string {
    return p === 'FREE' ? 'Gratis' : p === 'PRO' ? 'Pro' : 'Business';
  }

  trialLabel(iso: string): string {
    const t = new Date(iso).getTime();
    const days = Math.ceil((t - Date.now()) / (24 * 60 * 60 * 1000));
    if (days < 0) return `Expiró hace ${-days} d`;
    if (days === 0) return 'Expira hoy';
    return `${days} día${days === 1 ? '' : 's'}`;
  }

  trialClass(iso: string): string {
    const days = Math.ceil((new Date(iso).getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    if (days < 0) return 'trial-expired';
    if (days <= 7) return 'trial-warning';
    return 'trial-ok';
  }
}
