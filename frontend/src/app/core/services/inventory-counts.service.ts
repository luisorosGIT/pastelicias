import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse, Ingredient, WasteLog } from '../models';
import { BranchService } from './branch.service';

export interface InventoryCount {
  id: string;
  branchId: string;
  ingredientId: string;
  expectedStock: number;
  actualStock: number;
  varianceQty: number;
  varianceCost: number;
  notes: string | null;
  createdAt: string;
}

export interface CountPayload {
  /** En unidad base. */
  actualStock: number;
  notes?: string | null;
}

export interface CountResult {
  count: InventoryCount;
  autoWaste: WasteLog | null;
  ingredient: Ingredient;
}

@Injectable({ providedIn: 'root' })
export class InventoryCountsService {
  private readonly baseUrl = `${environment.apiUrl}/inventory`;

  constructor(private http: HttpClient, private branchService: BranchService) {}

  async create(ingredientId: string, payload: CountPayload): Promise<CountResult> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.post<ApiResponse<CountResult>>(
        `${this.baseUrl}/${ingredientId}/count`,
        payload,
        { params }
      )
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al registrar conteo');
    return res.data;
  }

  async list(ingredientId: string): Promise<InventoryCount[]> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.get<ApiResponse<InventoryCount[]>>(
        `${this.baseUrl}/${ingredientId}/counts`,
        { params }
      )
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al cargar conteos');
    return res.data;
  }

  private buildParams(): HttpParams {
    let params = new HttpParams();
    const branchId = this.branchService.selectedBranchId();
    if (branchId) params = params.set('branchId', branchId);
    return params;
  }
}
