import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse, Sale, PaymentMethod, SaleType } from '../models';
import { BranchService } from './branch.service';

export interface SalePayload {
  type: SaleType;
  paymentMethod: PaymentMethod;
  items: { recipeId: string; quantity: number; unitPrice: number }[];
  amountReceived?: number;
}

@Injectable({ providedIn: 'root' })
export class SalesService {
  private readonly baseUrl = `${environment.apiUrl}/sales`;

  constructor(private http: HttpClient, private branchService: BranchService) {}

  async create(payload: SalePayload): Promise<Sale> {
    const params = this.buildParams();
    try {
      const res = await firstValueFrom(
        this.http.post<ApiResponse<Sale>>(this.baseUrl, payload, { params })
      );
      if (!res.success || !res.data) throw new Error(res.error ?? 'Error al registrar venta');
      return res.data;
    } catch (err: unknown) {
      // Si es HttpErrorResponse (400/500), extraer el mensaje del cuerpo.
      const e = err as { error?: { error?: string }; message?: string };
      const backendMsg = e?.error?.error;
      throw new Error(backendMsg ?? e?.message ?? 'Error al registrar venta');
    }
  }

  async getTicket(saleId: string): Promise<Sale> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.get<ApiResponse<Sale>>(`${this.baseUrl}/${saleId}/ticket`, { params })
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Ticket no encontrado');
    return res.data;
  }

  private buildParams(): HttpParams {
    let params = new HttpParams();
    const branchId = this.branchService.selectedBranchId();
    if (branchId) params = params.set('branchId', branchId);
    return params;
  }
}
