import { Injectable, signal, computed } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '@env/environment';
import { AuthSession, SignupPayload, User, ApiResponse } from '../models';
import { homePathForRole } from '../utils/home-path';
import { AdminAuthService, AdminUser } from '../../admin/admin-auth.service';

/** Forma de respuesta del backend cuando el email es de admin. */
interface AdminLoginResponse {
  isAdmin: true;
  adminToken: string;
  admin: AdminUser;
}

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

  /** Cliente Supabase para auth flow OAuth. No persiste sesión en localStorage
   *  (lo manejamos nosotros via TOKEN_KEY) — solo lo usamos para signInWithOAuth
   *  y setSession durante el callback. */
  private supabase: SupabaseClient = createClient(
    environment.supabaseUrl,
    environment.supabaseAnonKey,
    { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }
  );

  constructor(
    private http: HttpClient,
    private router: Router,
    private adminAuth: AdminAuthService,
  ) {}

  /** Inicia el flow OAuth con Google. Redirige a Google y, tras autorizar,
   *  vuelve a /auth/callback con los tokens en el hash. */
  async loginWithGoogle(): Promise<void> {
    const redirectTo = `${window.location.origin}/auth/callback`;
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });
    if (error) throw new Error(error.message);
    // Aquí no llegamos — el navegador ya está navegando a Google.
  }

  /** Llamado desde la página /auth/callback. Recibe los tokens del fragment
   *  de la URL, valida con Supabase y luego con nuestro backend para
   *  crear/recuperar el Business + Branch + User. */
  async completeOAuthCallback(accessToken: string, refreshToken: string): Promise<{ isNewUser: boolean }> {
    // 1. Establecer la sesión en el cliente Supabase para que getUser funcione.
    const { error: setError } = await this.supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (setError) throw new Error(setError.message);

    // 2. Llamar al backend con el accessToken como Bearer
    const headers = new HttpHeaders({ Authorization: `Bearer ${accessToken}` });
    const res = await firstValueFrom(
      this.http.post<ApiResponse<{
        user: User;
        business: { id: string; name: string; onboardingCompleted: boolean };
        branch: { id: string; name: string };
        isNewUser: boolean;
      }>>(`${environment.apiUrl}/auth/oauth-bootstrap`, {}, { headers })
    );
    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al iniciar sesión con Google');

    // 3. Guardar como sesión nuestra (igual que login/signup normal)
    const session: AuthSession = {
      accessToken,
      refreshToken,
      user: res.data.user,
      business: res.data.business,
    };
    this.saveSession(session);
    this._session.set(session);
    const onboardingDone = res.data.business.onboardingCompleted;
    this.setOnboardingCompleted(onboardingDone);

    return { isNewUser: res.data.isNewUser };
  }

  async login(email: string, password: string): Promise<void> {
    // El backend puede devolver dos formas:
    //  - Admin: { isAdmin: true, adminToken, admin } → guardamos en AdminAuthService
    //  - User normal: AuthSession con accessToken/user/business
    const res = await firstValueFrom(
      this.http.post<ApiResponse<AuthSession | AdminLoginResponse>>(
        `${environment.apiUrl}/auth/login`,
        { email, password }
      )
    );

    if (!res.success || !res.data) throw new Error(res.error ?? 'Error al iniciar sesión');

    // Caso 1: el email pertenece a un admin del SaaS
    if ('isAdmin' in res.data && res.data.isAdmin) {
      const adminRes = res.data;
      this.adminAuth.persistFromOutside(adminRes.adminToken, adminRes.admin);
      this.router.navigate(['/admin/dashboard']);
      return;
    }

    // Caso 2: user normal de business
    const session = res.data as AuthSession;
    this.saveSession(session);
    this._session.set(session);
    const onboardingDone = session.business?.onboardingCompleted ?? true;
    this.setOnboardingCompleted(onboardingDone);
    this.redirectAfterAuth(session.user, onboardingDone);
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
