import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse, Ingredient, InventoryKpis, MeasureUnit } from '../models';
import { BranchService } from './branch.service';

export interface IngredientPayload {
  name: string;
  unit: MeasureUnit;
  presentationSize: number;
  stock: number;
  minStock: number;
  unitCost: number;
}

interface InventoryListResponse {
  ingredients: Ingredient[];
  kpis: InventoryKpis;
}

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private _ingredients = signal<Ingredient[]>([]);
  private _kpis = signal<InventoryKpis>({ totalValue: 0, criticalCount: 0, total: 0 });
  private _loading = signal(false);

  readonly ingredients = this._ingredients.asReadonly();
  readonly kpis = this._kpis.asReadonly();
  readonly loading = this._loading.asReadonly();

  private readonly baseUrl = `${environment.apiUrl}/inventory`;

  constructor(private http: HttpClient, private branchService: BranchService) {}

  async load(): Promise<void> {
    this._loading.set(true);
    try {
      const params = this.buildParams();
      const res = await firstValueFrom(
        this.http.get<ApiResponse<InventoryListResponse>>(this.baseUrl, { params })
      );
      if (res.success && res.data) {
        this._ingredients.set(res.data.ingredients);
        this._kpis.set(res.data.kpis);
      }
    } finally {
      this._loading.set(false);
    }
  }

  async create(payload: IngredientPayload): Promise<Ingredient> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.post<ApiResponse<Ingredient>>(this.baseUrl, payload, { params })
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al crear insumo');
    await this.load();
    return res.data;
  }

  async update(id: string, payload: Partial<IngredientPayload>): Promise<Ingredient> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.put<ApiResponse<Ingredient>>(`${this.baseUrl}/${id}`, payload, { params })
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al actualizar insumo');
    await this.load();
    return res.data;
  }

  async remove(id: string): Promise<void> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.delete<ApiResponse>(`${this.baseUrl}/${id}`, { params })
    );
    if (!res.success) throw new Error(res.error ?? 'Error al eliminar insumo');
    await this.load();
  }

  /**
   * Aplica un delta a un insumo en la señal local — evita una llamada GET
   * después de operaciones que ya sabemos exactamente cuánto consumieron.
   *
   * `deltas` es un map { ingredientId → cambio (positivo o negativo) en unidad base }.
   * Negativo = consume stock. Positivo = añade stock (ej: compra).
   * Recalcula KPIs en una sola pasada.
   */
  applyStockDeltas(deltas: Map<string, number>): void {
    if (deltas.size === 0) return;
    const updated = this._ingredients().map((ing) => {
      const d = deltas.get(ing.id);
      if (d === undefined || d === 0) return ing;
      const newStock = Math.max(0, ing.stock + d);
      return {
        ...ing,
        stock: newStock,
        isCritical: newStock <= ing.minStock,
        totalValue: newStock * ing.unitCost,
      };
    });
    this._ingredients.set(updated);

    // Recalcular KPIs
    let totalValue = 0;
    let criticalCount = 0;
    for (const i of updated) {
      totalValue += i.totalValue ?? 0;
      if (i.isCritical) criticalCount++;
    }
    this._kpis.set({ totalValue, criticalCount, total: updated.length });
  }

  private buildParams(): HttpParams {
    let params = new HttpParams();
    const branchId = this.branchService.selectedBranchId();
    if (branchId) params = params.set('branchId', branchId);
    return params;
  }
}
