import { Injectable, signal, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse, Branch, Business, Role, User } from '../models';
import { BranchService } from './branch.service';

export interface BranchPayload {
  name: string;
  address?: string | null;
  phone?: string | null;
  isActive?: boolean;
}

export interface BusinessPayload {
  name: string;
  ruc?: string | null;
  taxRate: number;
  hideIngredientCosts?: boolean;
  allowBulkInventoryEdit?: boolean;
  /** URL del logo. Pasar "" o null para limpiar. */
  logoUrl?: string | null;
}

export interface InviteUserPayload {
  email: string;
  fullName: string;
  password: string;
  role: Role;
  branchId?: string | null;
}

export interface UpdateUserPayload {
  fullName?: string;
  role?: Role;
  branchId?: string | null;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class SettingsService {
  private _branches = signal<Branch[]>([]);
  private _users = signal<(User & { branch?: { name: string } | null })[]>([]);
  private _business = signal<Business | null>(null);
  /** Promesa in-flight para deduplicar llamadas a loadBusiness. */
  private inflightBusiness: Promise<void> | null = null;

  readonly branches = this._branches.asReadonly();
  readonly users = this._users.asReadonly();
  readonly business = this._business.asReadonly();

  private readonly baseUrl = `${environment.apiUrl}/settings`;

  // BranchService es el "selector global" del topbar. Cualquier cambio en sucursales
  // (crear/editar/eliminar) debe reflejarse ahí también para que el dropdown se
  // mantenga sincronizado sin que el usuario tenga que recargar.
  private branchService = inject(BranchService);

  constructor(private http: HttpClient) {}

  // ─── Sucursales ────────────────────────────────────────────────────────────
  async loadBranches(): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<ApiResponse<Branch[]>>(`${this.baseUrl}/branches`)
    );
    if (res.success && res.data) this._branches.set(res.data);
  }

  async createBranch(payload: BranchPayload): Promise<Branch> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<Branch>>(`${this.baseUrl}/branches`, payload)
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al crear sucursal');
    // Refrescar AMBAS listas: la tabla de Settings y el selector global del topbar.
    await Promise.all([this.loadBranches(), this.branchService.loadBranches(true)]);
    return res.data;
  }

  async updateBranch(id: string, payload: Partial<BranchPayload>): Promise<Branch> {
    const res = await firstValueFrom(
      this.http.put<ApiResponse<Branch>>(`${this.baseUrl}/branches/${id}`, payload)
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al actualizar sucursal');
    await Promise.all([this.loadBranches(), this.branchService.loadBranches(true)]);
    return res.data;
  }

  async removeBranch(id: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.delete<ApiResponse>(`${this.baseUrl}/branches/${id}`)
    );
    if (!res.success) throw new Error(res.error ?? 'Error al eliminar sucursal');
    // Si el usuario tenía esa sucursal seleccionada en el topbar, volver a vista global.
    if (this.branchService.selectedBranchId() === id) {
      this.branchService.selectAllBranches();
    }
    await Promise.all([this.loadBranches(), this.branchService.loadBranches(true)]);
  }

  // ─── Empresa ──────────────────────────────────────────────────────────────
  /**
   * Carga la configuración del negocio. Idempotente: si ya está cargada, no re-pide.
   * Múltiples llamadas concurrentes comparten la misma promesa.
   */
  async loadBusiness(force = false): Promise<void> {
    if (!force && this._business() !== null) return;
    if (this.inflightBusiness) return this.inflightBusiness;

    this.inflightBusiness = (async () => {
      try {
        const res = await firstValueFrom(
          this.http.get<ApiResponse<Business>>(`${this.baseUrl}/business`)
        );
        if (res.success && res.data) this._business.set(res.data);
      } finally {
        this.inflightBusiness = null;
      }
    })();
    return this.inflightBusiness;
  }

  async updateBusiness(payload: BusinessPayload): Promise<Business> {
    const res = await firstValueFrom(
      this.http.put<ApiResponse<Business>>(`${this.baseUrl}/business`, payload)
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al actualizar empresa');
    this._business.set(res.data);
    return res.data;
  }

  // ─── Usuarios ─────────────────────────────────────────────────────────────
  async loadUsers(): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<ApiResponse<(User & { branch?: { name: string } | null })[]>>(
        `${this.baseUrl}/users`
      )
    );
    if (res.success && res.data) this._users.set(res.data);
  }

  /**
   * Carga branches + business + users en una sola request. Mucho más rápido que
   * llamar a los 3 endpoints por separado (1 ida a la red en lugar de 3).
   * Lo usa SettingsComponent al entrar a la página.
   */
  async loadBootstrap(): Promise<void> {
    const res = await firstValueFrom(
      this.http.get<ApiResponse<{
        branches: Branch[];
        business: Business;
        users: (User & { branch?: { name: string } | null })[];
      }>>(`${this.baseUrl}/bootstrap`)
    );
    if (res.success && res.data) {
      this._branches.set(res.data.branches);
      this._business.set(res.data.business);
      this._users.set(res.data.users);
    }
  }

  async inviteUser(payload: InviteUserPayload): Promise<User> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<User>>(`${this.baseUrl}/users/invite`, payload)
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al invitar usuario');
    await this.loadUsers();
    return res.data;
  }

  async updateUser(id: string, payload: UpdateUserPayload): Promise<User> {
    const res = await firstValueFrom(
      this.http.put<ApiResponse<User>>(`${this.baseUrl}/users/${id}`, payload)
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al actualizar usuario');
    await this.loadUsers();
    return res.data;
  }

  async deactivateUser(id: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.delete<ApiResponse>(`${this.baseUrl}/users/${id}`)
    );
    if (!res.success) throw new Error(res.error ?? 'Error al desactivar usuario');
    await this.loadUsers();
  }

  async reactivateUser(id: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse>(`${this.baseUrl}/users/${id}/reactivate`, {})
    );
    if (!res.success) throw new Error(res.error ?? 'Error al reactivar usuario');
    await this.loadUsers();
  }
}
