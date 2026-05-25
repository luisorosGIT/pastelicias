import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';
import { homePathForRole } from '../../../core/utils/home-path';
import { getErrorMessage } from '../../../core/utils/error-message';

/**
 * Página de aterrizaje del callback de OAuth (Google).
 *
 * Flow:
 *  1) Google → Supabase Auth → Supabase redirige aquí con tokens en el hash
 *     URL: /auth/callback#access_token=...&refresh_token=...&token_type=bearer
 *  2) Leemos el hash, llamamos a AuthService.completeOAuthCallback que:
 *     - Setea la sesión local con esos tokens
 *     - Llama al backend /api/auth/oauth-bootstrap
 *     - Backend devuelve si es user nuevo o existente
 *  3) Si es nuevo → /onboarding (wizard)
 *     Si es existente → home del rol
 *
 * Estados:
 *  - Loading mientras procesa
 *  - Error si algo falla (con CTA para reintentar)
 */
@Component({
  selector: 'app-auth-callback',
  standalone: true,
  imports: [RouterLink, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="callback">
      @if (status() === 'loading') {
        <div class="state">
          <mat-spinner diameter="48" />
          <h2>Iniciando sesión…</h2>
          <p>Estamos preparando tu cuenta. Esto solo tarda un par de segundos.</p>
        </div>
      } @else if (status() === 'error') {
        <div class="state error">
          <div class="error-icon">
            <mat-icon>error_outline</mat-icon>
          </div>
          <h2>No pudimos iniciar sesión</h2>
          <p>{{ errorMessage() }}</p>
          <a routerLink="/auth/login" class="btn-primary">Volver al login</a>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; }
    .callback {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
    }
    .state {
      max-width: 420px;
      width: 100%;
      text-align: center;
      padding: 48px 32px;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.1);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
    }
    .state h2 {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0f172a;
      margin: 8px 0 0 0;
    }
    .state p {
      font-size: 14.5px;
      color: #475569;
      line-height: 1.55;
      margin: 0;
    }
    .error-icon {
      width: 64px; height: 64px;
      border-radius: 50%;
      background: #fee2e2;
      color: #dc2626;
      display: flex; align-items: center; justify-content: center;
    }
    .error-icon mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .btn-primary {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0 24px; height: 44px;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
      border-radius: 10px;
      font-size: 15px; font-weight: 600;
      text-decoration: none;
      margin-top: 12px;
      transition: opacity 0.2s ease;
    }
    .btn-primary:hover { opacity: 0.95; }
  `],
})
export class AuthCallbackComponent implements OnInit {
  status = signal<'loading' | 'error'>('loading');
  errorMessage = signal('');

  constructor(private authService: AuthService, private router: Router) {}

  async ngOnInit(): Promise<void> {
    // Supabase pone los tokens en el HASH (#access_token=...&refresh_token=...).
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.substring(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    // Si Google rechazó: ?error=access_denied
    const errParam = new URLSearchParams(window.location.search).get('error');

    if (errParam || !accessToken) {
      this.status.set('error');
      this.errorMessage.set(
        errParam === 'access_denied'
          ? 'Cancelaste el inicio de sesión con Google. Puedes intentarlo de nuevo.'
          : 'No recibimos los datos del proveedor. Vuelve a intentar.'
      );
      // Limpiar el hash para que un refresh no reintente automáticamente
      window.history.replaceState(null, '', window.location.pathname);
      return;
    }

    try {
      const { isNewUser } = await this.authService.completeOAuthCallback(
        accessToken,
        refreshToken ?? ''
      );

      // Limpiar el hash para que no quede expuesto en history
      window.history.replaceState(null, '', window.location.pathname);

      // Usuario nuevo → onboarding. Existente → home del rol.
      if (isNewUser) {
        this.router.navigate(['/onboarding']);
      } else {
        const user = this.authService.user();
        const role = user?.role ?? 'SELLER';
        const onboardingDone = this.authService.onboardingCompleted();
        if (!onboardingDone && role === 'OWNER') {
          this.router.navigate(['/onboarding']);
        } else {
          this.router.navigate([homePathForRole(role)]);
        }
      }
    } catch (err: unknown) {
      this.status.set('error');
      this.errorMessage.set(getErrorMessage(err, 'No pudimos completar el inicio de sesión.'));
      window.history.replaceState(null, '', window.location.pathname);
    }
  }
}
