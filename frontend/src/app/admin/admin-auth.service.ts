import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '../core/models';

const TOKEN_KEY = 'genimatech_admin_token';
const ADMIN_KEY = 'genimatech_admin_user';

export interface AdminUser {
  id: string;
  email: string;
  name: string;
}

interface AdminLoginResponse {
  token: string;
  admin: AdminUser;
}

/**
 * Auth del panel de administración del SaaS.
 *
 * Completamente independiente del AuthService normal (que es para owners de
 * negocios). Tiene su propio token en localStorage y su propio guard.
 *
 * Un admin puede simultáneamente ser owner de un business — son sesiones
 * separadas en distintas keys de localStorage.
 */
@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private _admin = signal<AdminUser | null>(this.loadAdmin());

  readonly admin = this._admin.asReadonly();
  readonly isAuthenticated = computed(() => this._admin() !== null);

  private readonly baseUrl = `${environment.apiUrl}/admin/auth`;

  constructor(private http: HttpClient, private router: Router) {}

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /** Crea el primer admin (solo funciona si no hay admins en la DB). */
  async setup(email: string, password: string, name: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<AdminLoginResponse>>(`${this.baseUrl}/setup`, {
        email, password, name,
      })
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'No se pudo crear el admin');
    this.persist(res.data.token, res.data.admin);
    this.router.navigate(['/admin/dashboard']);
  }

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<AdminLoginResponse>>(`${this.baseUrl}/login`, {
        email, password,
      })
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Credenciales inválidas');
    this.persist(res.data.token, res.data.admin);
    this.router.navigate(['/admin/dashboard']);
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    this._admin.set(null);
    // Logout admin → vuelve al login publico unificado
    this.router.navigate(['/auth/login']);
  }

  /** Limpia sin redirect — usado por el interceptor en 401. */
  forceLogout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(ADMIN_KEY);
    this._admin.set(null);
  }

  /** Persiste un admin (token + datos). Usado por persist() interno y por
   *  AuthService cuando el login unificado detecta que el email es admin. */
  persistFromOutside(token: string, admin: AdminUser): void {
    this.persist(token, admin);
  }

  private persist(token: string, admin: AdminUser): void {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(ADMIN_KEY, JSON.stringify(admin));
    this._admin.set(admin);
  }

  private loadAdmin(): AdminUser | null {
    const t = localStorage.getItem(TOKEN_KEY);
    const a = localStorage.getItem(ADMIN_KEY);
    if (!t || !a) return null;
    try {
      return JSON.parse(a) as AdminUser;
    } catch {
      return null;
    }
  }
}
