import { Injectable, signal } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse, Reservation, ReservationStatus } from '../models';
import { BranchService } from './branch.service';

export interface ReservationPayload {
  clientName: string;
  phone: string;
  deliveryDate: string; // ISO
  details?: string | null;
  recipeId?: string | null;
  customProduct?: string | null;
  totalPrice: number;
  advance: number;
}

interface ReservationListResponse {
  grouped: Record<ReservationStatus, Reservation[]>;
  all: Reservation[];
}

const EMPTY_GROUPED: Record<ReservationStatus, Reservation[]> = {
  PENDING: [], CONFIRMED: [], IN_PROCESS: [], READY: [], DELIVERED: [],
};

@Injectable({ providedIn: 'root' })
export class ReservationsService {
  private _grouped = signal<Record<ReservationStatus, Reservation[]>>(EMPTY_GROUPED);
  private _loading = signal(false);

  readonly grouped = this._grouped.asReadonly();
  readonly loading = this._loading.asReadonly();

  private readonly baseUrl = `${environment.apiUrl}/reservations`;

  constructor(private http: HttpClient, private branchService: BranchService) {}

  async load(): Promise<void> {
    this._loading.set(true);
    try {
      const params = this.buildParams();
      const res = await firstValueFrom(
        this.http.get<ApiResponse<ReservationListResponse>>(this.baseUrl, { params })
      );
      if (res.success && res.data) {
        this._grouped.set({ ...EMPTY_GROUPED, ...res.data.grouped });
      }
    } finally {
      this._loading.set(false);
    }
  }

  async create(payload: ReservationPayload): Promise<Reservation> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.post<ApiResponse<Reservation>>(this.baseUrl, payload, { params })
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al crear reservación');
    await this.load();
    return res.data;
  }

  async updateStatus(id: string, status: ReservationStatus): Promise<void> {
    const params = this.buildParams();
    const res = await firstValueFrom(
      this.http.patch<ApiResponse>(`${this.baseUrl}/${id}/status`, { status }, { params })
    );
    if (!res.success) throw new Error(res.error ?? 'Error al cambiar estado');

    // Actualización local instantánea: mover la reservación de columna en el
    // signal sin disparar un GET adicional. Conserva los datos del cliente.
    this._grouped.update((current) => {
      const next: Record<ReservationStatus, Reservation[]> = { ...current };
      let moved: Reservation | undefined;
      for (const key of Object.keys(next) as ReservationStatus[]) {
        const idx = next[key].findIndex((r) => r.id === id);
        if (idx >= 0) {
          moved = { ...next[key][idx], status };
          next[key] = next[key].filter((_, i) => i !== idx);
          break;
        }
      }
      if (moved) next[status] = [...next[status], moved];
      return next;
    });
  }

  private buildParams(): HttpParams {
    let params = new HttpParams();
    const branchId = this.branchService.selectedBranchId();
    if (branchId) params = params.set('branchId', branchId);
    return params;
  }
}
