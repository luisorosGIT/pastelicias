import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse, Production, WasteLog, WasteType, WasteReason } from '../models';
import { BranchService } from './branch.service';

export interface ProductionPayload {
  recipeId: string;
  quantity: number;
  notes?: string | null;
}

export interface WastePayload {
  type: WasteType;
  ingredientId?: string | null;
  recipeId?: string | null;
  quantity: number;
  reason: WasteReason;
  notes?: string | null;
}

export interface ResalePurchasePayload {
  recipeId: string;
  quantity: number;
  unitCost: number;
  notes?: string | null;
}

export interface TopWasteIngredient {
  name: string;
  quantity: number;
  cost: number;
  mainReason: string;
}

export interface WasteKpis {
  invisibleLoss: number;
  wastePercent: number;
  totalWasteCost: number;
  ingredientWasteCost: number;
  productWasteCost: number;
  totalSales: number;
  countsRegistered: number;
}

export interface WasteKpisResponse {
  kpis: WasteKpis;
  topIngredients: TopWasteIngredient[];
  period: { from: string; to: string; filter: string };
}

@Injectable({ providedIn: 'root' })
export class ProductionService {
  private _productions = signal<Production[]>([]);
  private _wastes = signal<WasteLog[]>([]);
  private _totalWasteCost = signal(0);
  private _loading = signal(false);
  private _wasteKpis = signal<WasteKpisResponse | null>(null);

  readonly productions = this._productions.asReadonly();
  readonly wastes = this._wastes.asReadonly();
  readonly totalWasteCost = this._totalWasteCost.asReadonly();
  readonly loading = this._loading.asReadonly();
  readonly wasteKpis = this._wasteKpis.asReadonly();

  private readonly baseUrl = `${environment.apiUrl}/production`;

  constructor(private http: HttpClient, private branchService: BranchService) {}

  async loadProductions(): Promise<void> {
    this._loading.set(true);
    try {
      const params = this.buildParams();
      const res = await firstValueFrom(
        this.http.get<ApiResponse<Production[]>>(this.baseUrl, { params })
      );
      if (res.success && res.data) this._productions.set(res.data);
    } finally {
      this._loading.set(false);
    }
  }

  async loadWastes(): Promise<void> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.get<ApiResponse<{ wastes: WasteLog[]; totalWasteCost: number }>>(
        `${this.baseUrl}/waste`,
        { params }
      )
    );
    if (res.success && res.data) {
      this._wastes.set(res.data.wastes);
      this._totalWasteCost.set(res.data.totalWasteCost);
    }
  }

  async loadWasteKpis(filter: 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' = 'month'): Promise<void> {
    const params = this.buildParams().set('filter', filter);
    const res = await firstValueFrom(
      this.http.get<ApiResponse<WasteKpisResponse>>(
        `${this.baseUrl}/waste-kpis`,
        { params }
      )
    );
    if (res.success && res.data) this._wasteKpis.set(res.data);
  }

  async createProduction(payload: ProductionPayload): Promise<Production> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.post<ApiResponse<Production>>(this.baseUrl, payload, { params })
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al registrar producción');
    // Actualización local instantánea: evita un GET /api/production de ~1.7s en frío.
    // El backend devolvió la nueva producción; la agregamos al inicio de la lista.
    this._productions.update((list) => [res.data!, ...list].slice(0, 50));
    return res.data;
  }

  async createResalePurchase(payload: ResalePurchasePayload): Promise<{
    recipe: { id: string; name: string; stock: number; purchaseCost: number };
    cpp: { previous: number; new: number };
  }> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.post<ApiResponse<{
        recipe: { id: string; name: string; stock: number; purchaseCost: number };
        cpp: { previous: number; new: number };
      }>>(`${this.baseUrl}/resale-purchase`, payload, { params })
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al registrar compra');
    return res.data;
  }

  async createWaste(payload: WastePayload): Promise<WasteLog> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.post<ApiResponse<WasteLog>>(`${this.baseUrl}/waste`, payload, { params })
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al registrar merma');
    // Actualización local instantánea: la nueva merma va al inicio del historial.
    this._wastes.update((list) => [res.data!, ...list].slice(0, 100));
    this._totalWasteCost.update((curr) => curr + res.data!.cost);
    return res.data;
  }

  private buildParams(): HttpParams {
    let params = new HttpParams();
    const branchId = this.branchService.selectedBranchId();
    if (branchId) params = params.set('branchId', branchId);
    return params;
  }
}
