import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse, PlanCode, PlanState } from '../models';

/**
 * Servicio que expone el plan SaaS del negocio actual + uso de cada recurso
 * + comparativa de todos los planes (para la página de Upgrade).
 *
 * Cualquier mutación que afecte un recurso limitado debería invalidar este
 * cache llamando `reload()`.
 */
@Injectable({ providedIn: 'root' })
export class PlanService {
  private _state = signal<PlanState | null>(null);
  private _loading = signal(false);

  readonly state = this._state.asReadonly();
  readonly loading = this._loading.asReadonly();

  /** Computed: el plan actual del negocio (o null si aún no cargó). */
  readonly currentPlan = computed<PlanCode | null>(() => this._state()?.plan ?? null);

  private readonly baseUrl = `${environment.apiUrl}/settings`;
  private inflight: Promise<void> | null = null;

  constructor(private http: HttpClient) {}

  /** Carga (o re-carga si force=true) el estado del plan. */
  async load(force = false): Promise<void> {
    if (!force && this._state() !== null) return;
    if (this.inflight) return this.inflight;

    this._loading.set(true);
    this.inflight = (async () => {
      try {
        const res = await firstValueFrom(
          this.http.get<ApiResponse<PlanState>>(`${this.baseUrl}/plan`)
        );
        if (res.success && res.data) this._state.set(res.data);
      } finally {
        this._loading.set(false);
        this.inflight = null;
      }
    })();
    return this.inflight;
  }

  /** Cambia el plan del negocio (mock — sin pago aún). */
  async upgrade(plan: PlanCode): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse>(`${this.baseUrl}/upgrade`, { plan })
    );
    if (!res.success) throw new Error(res.error ?? 'Error al cambiar plan');
    // Refrescar estado tras el cambio
    await this.load(true);
  }
}
