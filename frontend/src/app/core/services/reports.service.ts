import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse, DateFilter, ReportKpis, Sale, WasteLog } from '../models';
import { BranchService } from './branch.service';
import { AuthService } from './auth.service';

export interface PeakHour {
  hour: number;
  sales: number;
  revenue: number;
}

export interface PeakDay {
  date: string;
  sales: number;
  revenue: number;
}

export interface TopProduct {
  recipeId: string;
  name: string;
  quantity: number;
  revenue: number;
}

export interface TopConsumedIngredient {
  ingredientId: string;
  name: string;
  unit: string;
  quantity: number;
  cost: number;
}

export interface CriticalIngredient {
  id: string;
  name: string;
  stock: number;
  minStock: number;
  unit: string;
  cost: number;
}

export interface DailySpend {
  date: string;
  total: number;
}

export interface PriceChange {
  ingredientId: string;
  name: string;
  unit: string;
  oldCpp: number;
  newCpp: number;
  deltaPercent: number;
}

export interface ReportSummary {
  kpis: ReportKpis;
  peakHour: PeakHour | null;
  peakDay: PeakDay | null;
  totalItemsSold: number;
  topProducts: TopProduct[];
  topConsumedIngredients: TopConsumedIngredient[];
  criticalIngredients: CriticalIngredient[];
  costTrend: { dailySpend: DailySpend[]; priceChanges: PriceChange[] };
  sales: Sale[];
  wasteLogs: WasteLog[];
  topBranches: { branchId: string; branchName: string; total: number }[];
  period: { from: string; to: string; filter: DateFilter };
}

@Injectable({ providedIn: 'root' })
export class ReportsService {
  private _summary = signal<ReportSummary | null>(null);
  private _loading = signal(false);

  readonly summary = this._summary.asReadonly();
  readonly loading = this._loading.asReadonly();

  private readonly baseUrl = `${environment.apiUrl}/reports`;

  constructor(
    private http: HttpClient,
    private branchService: BranchService,
    private authService: AuthService
  ) {}

  async load(filter: DateFilter): Promise<void> {
    this._loading.set(true);
    try {
      const params = this.buildParams(filter);
      const res = await firstValueFrom(
        this.http.get<ApiResponse<ReportSummary>>(`${this.baseUrl}/summary`, { params })
      );
      if (res.success && res.data) this._summary.set(res.data);
    } finally {
      this._loading.set(false);
    }
  }

  async exportCsv(filter: DateFilter): Promise<void> {
    const params = this.buildParams(filter);
    const token = this.authService.getToken();
    const url = `${this.baseUrl}/export?${params.toString()}`;
    // Usamos fetch porque HttpClient devuelve un body típado y queremos el blob crudo
    const resp = await fetch(url, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!resp.ok) throw new Error('Error al generar CSV');
    const blob = await resp.blob();

    const a = document.createElement('a');
    const objectUrl = URL.createObjectURL(blob);
    a.href = objectUrl;
    a.download = `reporte-ventas-${filter}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objectUrl);
  }

  private buildParams(filter: DateFilter): HttpParams {
    let params = new HttpParams().set('filter', filter);
    const branchId = this.branchService.selectedBranchId();
    if (branchId) params = params.set('branchId', branchId);
    return params;
  }
}
