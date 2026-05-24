import { Injectable, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { AuthSession, SignupPayload, User, ApiResponse } from '../models';
import { homePathForRole } from '../utils/home-path';

const TOKEN_KEY = 'pastelicias_token';
const REFRESH_KEY = 'pastelicias_refresh';
const USER_KEY = 'pastelicias_user';
const ONBOARDING_KEY = 'pastelicias_onboarding';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _session = signal<AuthSession | null>(this.loadSession());
  /** Flag de onboarding del negocio actual — para guards de routing. */
  private _onboardingCompleted = signal<boolean>(this.loadOnboarding());

  readonly user = computed(() => this._session()?.user ?? null);
  readonly isAuthenticated = computed(() => this._session() !== null);
  readonly role = computed(() => this._session()?.user.role ?? null);
  readonly branchId = computed(() => this._session()?.user.branchId ?? null);
  readonly onboardingCompleted = this._onboardingCompleted.asReadonly();

  constructor(private http: HttpClient, private router: Router) {}

  async login(email: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<AuthSession>>(`${environment.apiUrl}/auth/login`, { email, password })
    );

    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al iniciar sesión');

    this.saveSession(res.data);
    this._session.set(res.data);
    const onboardingDone = res.data.business?.onboardingCompleted ?? true;
    this.setOnboardingCompleted(onboardingDone);
    this.redirectAfterAuth(res.data.user, onboardingDone);
  }

  /** Crea un nuevo tenant + usuario OWNER + primera sucursal en una sola llamada. */
  async signup(payload: SignupPayload): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<ApiResponse<AuthSession>>(`${environment.apiUrl}/auth/signup`, payload)
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al crear cuenta');

    this.saveSession(res.data);
    this._session.set(res.data);
    // Recién creado → onboarding pendiente
    this.setOnboardingCompleted(false);
    // Redirigir directo al wizard
    this.router.navigate(['/onboarding']);
  }

  /** Llamado al finalizar el wizard de onboarding desde el componente. */
  markOnboardingCompleted(): void {
    this.setOnboardingCompleted(true);
  }

  async logout(): Promise<void> {
    await firstValueFrom(
      this.http.post<ApiResponse>(`${environment.apiUrl}/auth/logout`, {})
    ).catch(() => {});
    this.clearSession();
    this.router.navigate(['/']);
  }

  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  }

  /**
   * Redirect post-login/signup:
   *  - Si el onboarding no se ha completado → /onboarding (solo OWNER lo ve)
   *  - Si está completo → al home según rol
   */
  private redirectAfterAuth(user: User, onboardingDone: boolean): void {
    if (!onboardingDone && user.role === 'OWNER') {
      this.router.navigate(['/onboarding']);
      return;
    }
    this.router.navigate([homePathForRole(user.role)]);
  }

  private setOnboardingCompleted(value: boolean): void {
    this._onboardingCompleted.set(value);
    localStorage.setItem(ONBOARDING_KEY, value ? '1' : '0');
  }

  private loadOnboarding(): boolean {
    return localStorage.getItem(ONBOARDING_KEY) !== '0';
  }

  private saveSession(session: AuthSession): void {
    localStorage.setItem(TOKEN_KEY, session.accessToken);
    localStorage.setItem(REFRESH_KEY, session.refreshToken);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  }

  private loadSession(): AuthSession | null {
    const token = localStorage.getItem(TOKEN_KEY);
    const userStr = localStorage.getItem(USER_KEY);
    if (!token || !userStr) return null;
    try {
      return {
        accessToken: token,
        refreshToken: localStorage.getItem(REFRESH_KEY) ?? '',
        user: JSON.parse(userStr) as User,
      };
    } catch {
      return null;
    }
  }

  private clearSession(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ONBOARDING_KEY);
    this._session.set(null);
  }

  /** Limpia la sesión sin llamar al backend. Lo usa el interceptor en 401. */
  forceLogout(): void {
    this.clearSession();
  }
}
