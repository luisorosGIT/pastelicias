import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatCheckboxModule,
  ],
  template: `
    <div class="login-page">
      <!-- ─── Panel izquierdo: brand + testimonio ─── -->
      <aside class="brand-panel">
        <a routerLink="/" class="brand-link">
          <div class="brand-logo">P</div>
          <strong>Pastelicias</strong>
        </a>

        <div class="brand-content">
          <div class="quote-card">
            <mat-icon class="quote-mark">format_quote</mat-icon>
            <p class="quote-text">
              Pasé de no saber cuánto ganaba a entender qué torta me deja más
              margen. En 2 meses bajé 20% mis mermas solo de medirlas.
            </p>
            <div class="quote-author">
              <div class="quote-avatar">MQ</div>
              <div>
                <strong>María Quispe</strong>
                <span>Dulce Lima · Lima</span>
              </div>
            </div>
          </div>

          <ul class="brand-stats">
            <li><strong>120+</strong><span>Pastelerías activas</span></li>
            <li><strong>45k+</strong><span>Ventas registradas</span></li>
            <li><strong>4.8/5</strong><span>Satisfacción</span></li>
          </ul>
        </div>

        <p class="brand-footer">© {{ year }} Pastelicias · Hecho en Perú 🇵🇪</p>
      </aside>

      <!-- ─── Panel derecho: formulario ─── -->
      <main class="form-panel">
        <div class="form-wrapper">
          <!-- Logo mobile (visible solo en small) -->
          <a routerLink="/" class="brand-link mobile">
            <div class="brand-logo">P</div>
            <strong>Pastelicias</strong>
          </a>

          <header class="form-header">
            <h1>Bienvenido de vuelta</h1>
            <p>Inicia sesión para gestionar tu pastelería.</p>
          </header>

          <!-- Botón Google (decorativo) -->
          <button type="button" class="oauth-btn" (click)="comingSoon('Inicio de sesión con Google')">
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.71v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.61z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33z"/>
              <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58A9 9 0 0 0 9 0 9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"/>
            </svg>
            <span>Continuar con Google</span>
          </button>

          <div class="divider"><span>o con email</span></div>

          <!-- Form -->
          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Correo electrónico</mat-label>
              <input matInput type="email" formControlName="email"
                     placeholder="tu@email.com" autocomplete="email" />
              <mat-icon matPrefix>mail_outline</mat-icon>
              @if (form.get('email')?.invalid && form.get('email')?.touched) {
                <mat-error>Email inválido</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Contraseña</mat-label>
              <input matInput
                     [type]="showPassword() ? 'text' : 'password'"
                     formControlName="password"
                     autocomplete="current-password" />
              <mat-icon matPrefix>lock_outline</mat-icon>
              <button mat-icon-button matSuffix type="button"
                      (click)="showPassword.set(!showPassword())"
                      [attr.aria-label]="showPassword() ? 'Ocultar' : 'Mostrar'">
                <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (form.get('password')?.invalid && form.get('password')?.touched) {
                <mat-error>Contraseña requerida</mat-error>
              }
            </mat-form-field>

            <div class="form-row">
              <mat-checkbox color="primary">Mantenerme conectado</mat-checkbox>
              <a class="forgot-link" (click)="comingSoon('Recuperar contraseña')">
                ¿Olvidaste tu contraseña?
              </a>
            </div>

            @if (errorMessage()) {
              <div class="error-alert">
                <mat-icon>error_outline</mat-icon>
                {{ errorMessage() }}
              </div>
            }

            <button mat-flat-button color="primary"
                    class="full-width submit-btn" type="submit"
                    [disabled]="loading() || form.invalid">
              @if (loading()) {
                <mat-spinner diameter="22" />
              } @else {
                <span>Iniciar Sesión</span>
                <mat-icon class="arrow">arrow_forward</mat-icon>
              }
            </button>
          </form>

          <div class="signup-link">
            ¿No tienes cuenta?
            <a routerLink="/auth/signup">Crear una gratis</a>
          </div>

          <p class="terms-note">
            Al continuar aceptas nuestros
            <a (click)="comingSoon('Términos de servicio')">Términos</a> y
            <a (click)="comingSoon('Política de privacidad')">Política de privacidad</a>.
          </p>
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .login-page {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1.05fr 1fr;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    }
    @media (max-width: 900px) {
      .login-page { grid-template-columns: 1fr; }
      .brand-panel { display: none; }
    }

    /* ─── Panel izquierdo (brand) ─── */
    .brand-panel {
      position: relative;
      padding: 40px 48px;
      background:
        radial-gradient(at 20% 30%, rgba(100, 94, 251, 0.3) 0px, transparent 50%),
        radial-gradient(at 80% 70%, rgba(70, 72, 212, 0.25) 0px, transparent 50%),
        linear-gradient(135deg, #0b1c30 0%, #1a1d3f 60%, #2a1a52 100%);
      color: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }
    .brand-panel::before {
      content: '';
      position: absolute;
      inset: -50%;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
      background-size: 24px 24px;
      opacity: 0.5;
    }
    .brand-panel > * { position: relative; z-index: 1; }
    .brand-link {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 800;
      color: inherit;
      text-decoration: none;
    }
    .brand-link.mobile {
      display: none;
      color: #0b1c30;
      margin-bottom: 24px;
    }
    @media (max-width: 900px) {
      .brand-link.mobile { display: inline-flex; }
    }
    .brand-logo {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #4648d4 0%, #645efb 100%);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 18px;
    }

    .brand-content {
      max-width: 480px;
      margin: 0 auto;
      width: 100%;
    }

    /* Quote card */
    .quote-card {
      position: relative;
      padding: 36px 32px 28px;
      background: rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      margin-bottom: 32px;
    }
    .quote-mark {
      position: absolute;
      top: -8px; left: 24px;
      font-size: 48px;
      width: 48px;
      height: 48px;
      color: rgba(100, 94, 251, 0.6);
    }
    .quote-text {
      font-size: 18px;
      line-height: 1.55;
      font-weight: 500;
      letter-spacing: -0.005em;
      color: #fff;
      margin: 0 0 24px 0;
    }
    .quote-author {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .quote-avatar {
      width: 44px; height: 44px; border-radius: 50%;
      background: linear-gradient(135deg, #4648d4, #645efb);
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 15px;
    }
    .quote-author strong { display: block; font-size: 14px; }
    .quote-author span {
      display: block; font-size: 12.5px;
      color: rgba(255, 255, 255, 0.6);
      margin-top: 2px;
    }

    /* Stats */
    .brand-stats {
      list-style: none; padding: 0; margin: 0;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .brand-stats li {
      padding: 16px 12px;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 14px;
      text-align: center;
    }
    .brand-stats strong {
      display: block;
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 4px;
    }
    .brand-stats span {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.55);
      letter-spacing: 0.02em;
    }

    .brand-footer {
      font-size: 12.5px;
      color: rgba(255, 255, 255, 0.45);
      margin: 0;
    }

    /* ─── Panel derecho (form) ─── */
    .form-panel {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 40px 24px;
      background: #fff;
    }
    .form-wrapper {
      width: 100%;
      max-width: 400px;
    }

    .form-header {
      margin-bottom: 28px;
    }
    .form-header h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.025em;
      margin: 0 0 6px 0;
      color: #0b1c30;
    }
    .form-header p {
      font-size: 14.5px;
      color: #64748b;
      margin: 0;
    }

    /* OAuth button */
    .oauth-btn {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      height: 46px;
      background: #fff;
      border: 1.5px solid #e2e8f0;
      border-radius: 10px;
      font-size: 14.5px;
      font-weight: 600;
      color: #0b1c30;
      cursor: pointer;
      font-family: inherit;
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .oauth-btn:hover {
      border-color: #c7d2fe;
      background: #fafbff;
    }

    .divider {
      display: flex; align-items: center;
      margin: 20px 0 16px;
      color: #94a3b8;
      font-size: 12px;
      font-weight: 600;
    }
    .divider::before, .divider::after {
      content: ''; flex: 1; height: 1px; background: #e2e8f0;
    }
    .divider span { padding: 0 14px; }

    .form { display: flex; flex-direction: column; gap: 4px; }
    .full-width { width: 100%; }

    .form-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin: -4px 0 12px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .forgot-link {
      font-size: 13px;
      font-weight: 600;
      color: #4648d4;
      cursor: pointer;
      text-decoration: none;
    }
    .forgot-link:hover { text-decoration: underline; }

    .error-alert {
      display: flex; align-items: center; gap: 8px;
      background: #fee2e2; color: #dc2626;
      padding: 10px 14px;
      border-radius: 10px;
      font-size: 13px; font-weight: 500;
      margin: 4px 0 8px;
    }
    .error-alert mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .submit-btn {
      height: 50px !important;
      font-size: 15px !important;
      font-weight: 700 !important;
      margin-top: 4px;
      display: flex !important;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 8px 24px -6px rgba(70, 72, 212, 0.5) !important;
    }
    .submit-btn .arrow { font-size: 18px; width: 18px; height: 18px; }

    .signup-link {
      text-align: center;
      margin-top: 24px;
      font-size: 14px;
      color: #475569;
    }
    .signup-link a {
      color: #4648d4;
      font-weight: 700;
      text-decoration: none;
      margin-left: 4px;
    }
    .signup-link a:hover { text-decoration: underline; }

    .terms-note {
      text-align: center;
      margin: 16px 0 0 0;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
    }
    .terms-note a {
      color: #64748b;
      text-decoration: underline;
      cursor: pointer;
    }
    .terms-note a:hover { color: #4648d4; }
  `],
})
export class LoginComponent {
  form: FormGroup;
  loading = signal(false);
  showPassword = signal(false);
  errorMessage = signal('');
  year = new Date().getFullYear();

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private snack: MatSnackBar,
  ) {
    this.form = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', Validators.required],
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      await this.authService.login(this.form.value.email, this.form.value.password);
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error al iniciar sesión');
    } finally {
      this.loading.set(false);
    }
  }

  /** Botones decorativos que aún no funcionan — abren un snack. */
  comingSoon(featureName: string): void {
    this.snack.open(`${featureName} — disponible pronto.`, 'OK', { duration: 4000 });
  }
}
