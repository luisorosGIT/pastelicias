import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient, HttpParams } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '../../core/models';

interface UserRow {
  id: string;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  business: { id: string; name: string; plan: 'FREE' | 'PRO' | 'BUSINESS' };
  branch: { id: string; name: string } | null;
}

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatIconModule, MatProgressSpinnerModule],
  template: `
    <header class="page-head">
      <h1>Usuarios</h1>
      <p>Todos los usuarios registrados en el SaaS, agrupados por negocio.</p>
    </header>

    <div class="search">
      <mat-icon>search</mat-icon>
      <input type="text" [(ngModel)]="searchTerm" (input)="onSearch()"
             placeholder="Buscar por nombre o email…" />
    </div>

    @if (loading()) {
      <div class="loading"><mat-spinner diameter="36" /></div>
    } @else {
      <div class="table-wrap">
        <table class="table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Negocio</th>
              <th>Sucursal</th>
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            @for (u of users(); track u.id) {
              <tr>
                <td><strong>{{ u.fullName }}</strong></td>
                <td>{{ u.email }}</td>
                <td><span class="role-tag">{{ u.role }}</span></td>
                <td>
                  <a [routerLink]="['/admin/businesses', u.business.id]" class="biz-link">
                    {{ u.business.name }}
                    <span class="plan-mini" [class.pro]="u.business.plan === 'PRO'"
                          [class.business]="u.business.plan === 'BUSINESS'">
                      {{ u.business.plan }}
                    </span>
                  </a>
                </td>
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
            @if (users().length === 0) {
              <tr>
                <td colspan="6" class="empty">Sin usuarios con esos filtros.</td>
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

    .search {
      position: relative;
      display: flex; align-items: center;
      margin-bottom: 16px;
    }
    .search mat-icon { position: absolute; left: 12px; color: #94a3b8; pointer-events: none; }
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

    .loading { display: flex; justify-content: center; padding: 48px; }
    .table-wrap {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
    }
    .table { width: 100%; border-collapse: collapse; font-size: 14px; }
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
    .table td { padding: 12px 16px; border-bottom: 1px solid #f1f5f9; }
    .table tr:hover td { background: #fafbff; }
    .table tr:last-child td { border-bottom: none; }
    .empty { text-align: center !important; color: #94a3b8; padding: 32px !important; font-style: italic; }

    .role-tag {
      padding: 2px 8px;
      background: #eef2ff;
      color: #4f46e5;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
    }
    .biz-link {
      color: #4f46e5;
      font-weight: 600;
      text-decoration: none;
      display: inline-flex; align-items: center; gap: 6px;
    }
    .biz-link:hover { text-decoration: underline; }
    .plan-mini {
      padding: 1px 6px;
      background: #f1f5f9;
      color: #64748b;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }
    .plan-mini.pro { background: #eef2ff; color: #4f46e5; }
    .plan-mini.business { background: #f3e8ff; color: #9333ea; }
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
export class AdminUsersComponent implements OnInit {
  loading = signal(true);
  users = signal<UserRow[]>([]);
  searchTerm = '';
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
      const res = await firstValueFrom(
        this.http.get<ApiResponse<UserRow[]>>(`${environment.apiUrl}/admin/users`, { params })
      );
      if (res.success && res.data) this.users.set(res.data);
    } finally {
      this.loading.set(false);
    }
  }

  onSearch(): void {
    if (this.searchTimeout) clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => this.reload(), 350);
  }
}
