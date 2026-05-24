import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse, Ingredient } from '../models';
import { BranchService } from './branch.service';

export interface PurchasePayload {
  /** En unidad base — el frontend convierte desde presentaciones antes de enviar. */
  quantity: number;
  /** Costo por unidad base — el frontend convierte desde "costo por presentación". */
  unitCost: number;
  supplier?: string | null;
  notes?: string | null;
}

export interface Purchase {
  id: string;
  branchId: string;
  ingredientId: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  supplier: string | null;
  notes: string | null;
  createdAt: string;
}

export interface PurchaseResult {
  ingredient: Ingredient;
  purchase: Purchase;
  cpp: { previous: number; new: number; delta: number };
}

@Injectable({ providedIn: 'root' })
export class PurchasesService {
  private readonly baseUrl = `${environment.apiUrl}/inventory`;

  constructor(private http: HttpClient, private branchService: BranchService) {}

  async create(ingredientId: string, payload: PurchasePayload): Promise<PurchaseResult> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.post<ApiResponse<PurchaseResult>>(
        `${this.baseUrl}/${ingredientId}/purchase`,
        payload,
        { params }
      )
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al registrar compra');
    return res.data;
  }

  async list(ingredientId: string): Promise<Purchase[]> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.get<ApiResponse<Purchase[]>>(
        `${this.baseUrl}/${ingredientId}/purchases`,
        { params }
      )
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al cargar historial');
    return res.data;
  }

  private buildParams(): HttpParams {
    let params = new HttpParams();
    const branchId = this.branchService.selectedBranchId();
    if (branchId) params = params.set('branchId', branchId);
    return params;
  }
}
