import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { environment } from '@env/environment';
import { getErrorMessage } from '../../../core/utils/error-message';

/**
 * Página de aterrizaje del link de recovery de Supabase.
 *
 * Flow:
 *  1) Supabase envía email con un link tipo:
 *     https://genimatech.vercel.app/auth/reset-password#access_token=...&type=recovery
 *  2) Al cargar este componente, leemos el hash de URL, extraemos
 *     access_token + refresh_token, y los pasamos a supabase.auth.setSession().
 *     Eso establece una sesión temporal con permisos para cambiar la password.
 *  3) El user ingresa nueva contraseña → llamamos supabase.auth.updateUser({ password }).
 *  4) Cerramos sesión y redirigimos al login para que entre con la nueva.
 *
 * Edge cases:
 *  - Sin tokens en URL → estado "linkInvalid" con CTA a /forgot-password
 *  - Token expirado → Supabase rechaza setSession con error 401
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="reset">
      <div class="form-side fade-left">
        <div class="form-wrapper">
          <a routerLink="/auth/login" class="back-link">
            <mat-icon>arrow_back</mat-icon>
            <span>Volver al inicio de sesión</span>
          </a>

          <div class="logo-block">
            <img src="assets/branding/logo.png" alt="Genimatech" class="logo-img" />
            <div>
              <h1 class="logo-name gradient-text">Genimatech</h1>
              <p class="logo-tagline">Sistema de Gestión</p>
            </div>
          </div>

          @if (verifying()) {
            <div class="loading-state">
              <mat-spinner diameter="36" />
              <p>Validando enlace…</p>
            </div>
          } @else if (linkInvalid()) {
            <div class="step-content error-state">
              <div class="error-icon">
                <mat-icon>link_off</mat-icon>
              </div>
              <h2>Enlace inválido o vencido</h2>
              <p class="step-sub">
                El enlace ya no es válido. Esto puede pasar si ya lo usaste o si
                pasaron más de 60 minutos desde que lo solicitaste.
              </p>
              <a routerLink="/auth/forgot-password" class="submit-btn-link">
                Pedir un nuevo enlace
              </a>
            </div>
          } @else {
            <div class="step-content">
              <h2>Crea tu nueva contraseña</h2>
              <p class="step-sub">
                Mínimo 8 caracteres. Combina letras, números y símbolos para más seguridad.
              </p>

              <form [formGroup]="form" (ngSubmit)="submit()" class="form" novalidate>
                <div class="field">
                  <label>Nueva contraseña</label>
                  <div class="input-wrap">
                    <mat-icon class="input-icon">lock_outline</mat-icon>
                    <input
                      [type]="showPassword() ? 'text' : 'password'"
                      formControlName="password"
                      placeholder="••••••••"
                      autocomplete="new-password"
                      autofocus
                    />
                    <button type="button" class="visibility-btn"
                            (click)="showPassword.set(!showPassword())">
                      <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                    </button>
                  </div>
                  @if (form.get('password')?.invalid && form.get('password')?.touched) {
                    <span class="field-error">Mínimo 8 caracteres</span>
                  }
                </div>

                <div class="field">
                  <label>Confirmar contraseña</label>
                  <div class="input-wrap">
                    <mat-icon class="input-icon">lock_outline</mat-icon>
                    <input
                      [type]="showPassword() ? 'text' : 'password'"
                      formControlName="confirm"
                      placeholder="••••••••"
                      autocomplete="new-password"
                    />
                  </div>
                  @if (form.errors?.['mismatch'] && form.get('confirm')?.touched) {
                    <span class="field-error">Las contraseñas no coinciden</span>
                  }
                </div>

                @if (errorMessage()) {
                  <div class="error-alert">
                    <mat-icon>error_outline</mat-icon>
                    {{ errorMessage() }}
                  </div>
                }

                <button type="submit" class="submit-btn"
                        [disabled]="saving() || form.invalid">
                  @if (saving()) {
                    <mat-spinner diameter="22" />
                  } @else {
                    <span>Cambiar contraseña</span>
                    <mat-icon>check</mat-icon>
                  }
                </button>
              </form>
            </div>
          }
        </div>
      </div>

      <aside class="visual-side fade-right">
        <div class="visual-pattern"></div>
        <div class="visual-content">
          <div class="visual-card">
            <div class="success-icon">
              <mat-icon>shield_lock</mat-icon>
            </div>
            <h3>Casi listo</h3>
            <p>
              Define tu nueva contraseña y vuelve a tu pastelería. Te recomendamos
              usar una contraseña distinta a la anterior.
            </p>
          </div>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .reset {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1fr 1fr;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      color: #0f172a;
    }
    @media (max-width: 1024px) {
      .reset { grid-template-columns: 1fr; }
      .visual-side { display: none; }
    }

    @keyframes fadeLeft { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes fadeRight { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
    .fade-left { animation: fadeLeft 0.6s ease-out both; }
    .fade-right { animation: fadeRight 0.6s ease-out both; }

    .gradient-text {
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    .form-side {
      display: flex; align-items: center; justify-content: center;
      padding: 32px; background: #fff;
    }
    .form-wrapper { width: 100%; max-width: 440px; }
    .back-link {
      display: inline-flex; align-items: center; gap: 8px;
      color: #475569; font-size: 14px;
      text-decoration: none; margin-bottom: 32px;
      transition: color 0.15s ease;
    }
    .back-link:hover { color: #4f46e5; }
    .back-link mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .logo-block {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 32px;
    }
    .logo-img {
      width: 48px; height: 48px; border-radius: 12px;
      display: block; object-fit: cover;
    }
    .logo-name {
      font-size: 24px; font-weight: 800;
      letter-spacing: -0.02em; margin: 0;
    }
    .logo-tagline { font-size: 13px; color: #6b7280; margin: 0; }

    .step-content { animation: fadeIn 0.35s ease-out both; }
    .step-content h2 {
      font-size: 28px; font-weight: 800;
      letter-spacing: -0.025em; margin: 0 0 8px 0;
    }
    .step-sub {
      font-size: 15px; color: #475569; line-height: 1.55;
      margin: 0 0 24px 0;
    }

    .loading-state {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 60px 0;
      gap: 16px;
    }
    .loading-state p { color: #64748b; font-size: 14px; margin: 0; }

    .error-state { text-align: center; }
    .error-state .step-sub { text-align: center; }
    .error-icon {
      width: 72px; height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #fee2e2, #fca5a5);
      color: #b91c1c;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px;
    }
    .error-icon mat-icon { font-size: 36px; width: 36px; height: 36px; }
    .submit-btn-link {
      display: inline-flex; align-items: center; justify-content: center;
      gap: 8px;
      width: 100%; height: 52px;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
      border-radius: 10px;
      font-size: 16px; font-weight: 600;
      text-decoration: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .submit-btn-link:hover {
      opacity: 0.95;
      transform: translateY(-2px);
    }

    .form { display: flex; flex-direction: column; gap: 20px; }
    .field { display: flex; flex-direction: column; gap: 8px; }
    .field label { font-size: 14.5px; font-weight: 600; color: #1f2937; }

    .input-wrap { position: relative; display: flex; align-items: center; }
    .input-icon {
      position: absolute; left: 14px;
      color: #9ca3af;
      font-size: 20px; width: 20px; height: 20px;
      pointer-events: none;
    }
    .input-wrap input {
      width: 100%; height: 48px;
      padding: 0 14px 0 44px;
      background: #fff;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      font-size: 15.5px; color: #0f172a;
      font-family: inherit;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      outline: none;
    }
    .input-wrap input:focus {
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
    }
    .visibility-btn {
      position: absolute; right: 8px;
      width: 36px; height: 36px;
      background: transparent; border: none;
      border-radius: 8px;
      color: #9ca3af; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: color 0.15s ease, background 0.15s ease;
    }
    .visibility-btn:hover { color: #4b5563; background: #f3f4f6; }
    .visibility-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .field-error { color: #dc2626; font-size: 13px; }

    .error-alert {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 16px;
      background: #fee2e2; color: #dc2626;
      border-radius: 10px;
      font-size: 14px; font-weight: 500;
    }
    .error-alert mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .submit-btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: 8px;
      width: 100%; height: 52px;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
      border: none; border-radius: 10px;
      font-size: 17px; font-weight: 600;
      cursor: pointer;
      font-family: inherit;
      box-shadow: 0 12px 24px -8px rgba(79, 70, 229, 0.4);
      transition: opacity 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease;
    }
    .submit-btn:hover:not(:disabled) {
      opacity: 0.95;
      transform: translateY(-2px);
      box-shadow: 0 16px 32px -8px rgba(79, 70, 229, 0.5);
    }
    .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .submit-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .visual-side {
      position: relative;
      padding: 48px;
      background: linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #ec4899 100%);
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    .visual-pattern {
      position: absolute; inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
      background-size: 60px 60px;
      opacity: 0.4;
    }
    .visual-content { position: relative; z-index: 1; max-width: 480px; width: 100%; }
    .visual-card {
      padding: 40px 32px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      border-radius: 20px;
      box-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.3);
      text-align: center;
    }
    .success-icon {
      width: 72px; height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ede9fe, #c4b5fd);
      color: #6d28d9;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px;
    }
    .success-icon mat-icon { font-size: 36px; width: 36px; height: 36px; }
    .visual-card h3 {
      font-size: 22px; font-weight: 800;
      letter-spacing: -0.02em; margin: 0 0 12px 0;
    }
    .visual-card p {
      font-size: 15px; color: #475569;
      line-height: 1.6; margin: 0;
    }
  `],
})
export class ResetPasswordComponent implements OnInit {
  verifying = signal(true);
  linkInvalid = signal(false);
  showPassword = signal(false);
  saving = signal(false);
  errorMessage = signal('');

  form: FormGroup;
  private supabase: SupabaseClient;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private snack: MatSnackBar,
  ) {
    this.form = this.fb.group(
      {
        password: ['', [Validators.required, Validators.minLength(8)]],
        confirm: ['', [Validators.required]],
      },
      {
        validators: (g) => {
          const pwd = g.get('password')?.value;
          const conf = g.get('confirm')?.value;
          return pwd && conf && pwd !== conf ? { mismatch: true } : null;
        },
      }
    );

    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  async ngOnInit(): Promise<void> {
    // Supabase manda los tokens en el HASH de la URL:
    // #access_token=...&refresh_token=...&type=recovery&expires_in=...
    const hash = window.location.hash.startsWith('#')
      ? window.location.hash.substring(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const type = params.get('type');

    if (!accessToken || type !== 'recovery') {
      this.linkInvalid.set(true);
      this.verifying.set(false);
      return;
    }

    // Establecer sesión temporal con los tokens del recovery.
    const { error } = await this.supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken ?? '',
    });
    if (error) {
      console.error('[reset-password] setSession error:', error);
      this.linkInvalid.set(true);
    }

    // Limpiar el hash de la URL para no exponer el token en el history.
    window.history.replaceState(null, '', window.location.pathname);
    this.verifying.set(false);
  }

  async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.errorMessage.set('');
    try {
      const { error } = await this.supabase.auth.updateUser({
        password: this.form.value.password,
      });
      if (error) throw error;

      // Cerrar la sesión temporal de recovery.
      await this.supabase.auth.signOut();

      this.snack.open('✓ Contraseña actualizada. Inicia sesión.', 'OK', { duration: 5000 });
      this.router.navigate(['/auth/login']);
    } catch (err: unknown) {
      const msg = getErrorMessage(err, 'No pudimos actualizar la contraseña.');
      this.errorMessage.set(msg);
    } finally {
      this.saving.set(false);
    }
  }
}
