import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse, Recipe, RecipeCategory } from '../models';
import { BranchService } from './branch.service';

export interface RecipeItemPayload {
  ingredientId: string;
  quantity: number;
}

export interface RecipePayload {
  name: string;
  category: RecipeCategory;
  salePrice: number;
  imageUrl?: string | null;
  description?: string | null;
  items: RecipeItemPayload[];
  /** Producto de reventa (sin BOM). Si true, items debe ir vacío. */
  isResale?: boolean;
  /** Costo unitario de compra. Obligatorio si isResale=true. */
  purchaseCost?: number;
  /** Stock inicial al crear un producto de reventa (no aplica al editar). */
  initialStock?: number;
}

export interface ResalePurchasePayload {
  recipeId: string;
  quantity: number;
  unitCost: number;
  notes?: string | null;
}

@Injectable({ providedIn: 'root' })
export class RecipesService {
  private _recipes = signal<Recipe[]>([]);
  private _loading = signal(false);

  readonly recipes = this._recipes.asReadonly();
  readonly loading = this._loading.asReadonly();

  private readonly baseUrl = `${environment.apiUrl}/recipes`;

  constructor(private http: HttpClient, private branchService: BranchService) {}

  async load(): Promise<void> {
    this._loading.set(true);
    try {
      const params = this.buildParams();
      const res = await firstValueFrom(
        this.http.get<ApiResponse<Recipe[]>>(this.baseUrl, { params })
      );
      if (res.success && res.data) this._recipes.set(res.data);
    } finally {
      this._loading.set(false);
    }
  }

  async create(payload: RecipePayload): Promise<Recipe> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.post<ApiResponse<Recipe>>(this.baseUrl, payload, { params })
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al crear producto');
    await this.load();
    return res.data;
  }

  async update(id: string, payload: Partial<RecipePayload>): Promise<Recipe> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.put<ApiResponse<Recipe>>(`${this.baseUrl}/${id}`, payload, { params })
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al actualizar producto');
    await this.load();
    return res.data;
  }

  async remove(id: string): Promise<void> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.delete<ApiResponse>(`${this.baseUrl}/${id}`, { params })
    );
    if (!res.success) throw new Error(res.error ?? 'Error al eliminar producto');
    await this.load();
  }

  private buildParams(): HttpParams {
    let params = new HttpParams();
    const branchId = this.branchService.selectedBranchId();
    if (branchId) params = params.set('branchId', branchId);
    return params;
  }
}
