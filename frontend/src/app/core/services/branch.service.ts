import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '@env/environment';
import { ApiResponse, Branch } from '../models';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class BranchService {
  private _selectedBranchId = signal<string>('');
  private _branches = signal<Branch[]>([]);
  /** Promesa in-flight para deduplicar llamadas concurrentes a loadBranches. */
  private inflightLoad: Promise<void> | null = null;

  /** branchId activo — para OWNER puede cambiar; para otros siempre es el suyo */
  readonly selectedBranchId = this._selectedBranchId.asReadonly();
  readonly branches = this._branches.asReadonly();
  readonly isGlobalView = computed(() => this._selectedBranchId() === '');

  constructor(private http: HttpClient, private authService: AuthService) {
    // Inicializar con la sucursal del usuario (si no es OWNER)
    const branchId = this.authService.branchId();
    if (branchId) this._selectedBranchId.set(branchId);
  }

  selectBranch(branchId: string): void {
    this._selectedBranchId.set(branchId);
  }

  selectAllBranches(): void {
    this._selectedBranchId.set('');
  }

  /**
   * Carga las sucursales. Idempotente: si ya las tenemos, no re-pide al backend.
   * Si hay una carga en curso, varias llamadas concurrentes comparten la misma promesa.
   */
  async loadBranches(force = false): Promise<void> {
    if (!force && this._branches().length > 0) return;
    if (this.inflightLoad) return this.inflightLoad;

    this.inflightLoad = (async () => {
      try {
        const res = await this.http
          .get<ApiResponse<Branch[]>>(`${environment.apiUrl}/settings/branches`)
          .toPromise();
        if (res?.success && res.data) {
          this._branches.set(res.data);
        }
      } finally {
        this.inflightLoad = null;
      }
    })();
    return this.inflightLoad;
  }

  /** Añade branchId como query param si está seleccionado */
  getBranchQueryParam(): Record<string, string> {
    const id = this._selectedBranchId();
    return id ? { branchId: id } : {};
  }
}
