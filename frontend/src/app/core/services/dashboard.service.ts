import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse, DashboardKpis, DateFilter } from '../models';
import { BranchService } from './branch.service';

export interface SeriesPoint { label: string; total: number }
export interface TopProduct { name: string; quantity: number; revenue: number }
export interface DashboardSummary {
  kpis: DashboardKpis;
  topProducts: TopProduct[];
  series: SeriesPoint[];
  branches: { id: string; name: string; todaySales: number; isActive: boolean }[];
  period: { from: string; to: string; filter: DateFilter };
  salesCount: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private _summary = signal<DashboardSummary | null>(null);
  private _loading = signal(false);

  readonly summary = this._summary.asReadonly();
  readonly loading = this._loading.asReadonly();

  private readonly baseUrl = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient, private branchService: BranchService) {}

  async load(filter: DateFilter): Promise<void> {
    this._loading.set(true);
    try {
      const params = this.buildParams(filter);
      const res = await firstValueFrom(
        this.http.get<ApiResponse<DashboardSummary>>(`${this.baseUrl}/summary`, { params })
      );
      if (res.success && res.data) this._summary.set(res.data);
    } finally {
      this._loading.set(false);
    }
  }

  private buildParams(filter: DateFilter): HttpParams {
    let params = new HttpParams().set('filter', filter);
    const branchId = this.branchService.selectedBranchId();
    if (branchId) params = params.set('branchId', branchId);
    return params;
  }
}
