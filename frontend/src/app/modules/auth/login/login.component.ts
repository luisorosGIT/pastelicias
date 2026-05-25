import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Login adaptado al diseño Figma.
 * Split layout: form a la izquierda, panel visual con quote card +
 * 3 stats cards a la derecha (oculto en mobile).
 */
@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink,
    MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="login">
      <!-- ─── Form (izq) ─── -->
      <div class="form-side fade-left">
        <div class="form-wrapper">
          <a routerLink="/" class="back-link">
            <mat-icon>arrow_back</mat-icon>
            <span>Volver al inicio</span>
          </a>

          <div class="logo-block">
            <img src="assets/branding/logo.png" alt="Genimatech" class="logo-img" />
            <div>
              <h1 class="logo-name gradient-text">Genimatech</h1>
              <p class="logo-tagline">Sistema de Gestión</p>
            </div>
          </div>

          <div class="form-header">
            <h2>Iniciar Sesión</h2>
            <p>Accede a tu panel de control</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form" novalidate>
            <div class="field">
              <label for="email">Correo electrónico</label>
              <div class="input-wrap">
                <mat-icon class="input-icon">mail_outline</mat-icon>
                <input
                  id="email"
                  type="email"
                  formControlName="email"
                  placeholder="tu@email.com"
                  autocomplete="email"
                />
              </div>
              @if (form.get('email')?.invalid && form.get('email')?.touched) {
                <span class="field-error">Email inválido</span>
              }
            </div>

            <div class="field">
              <div class="field-row">
                <label for="password">Contraseña</label>
                <a class="forgot" (click)="comingSoon('Recuperar contraseña')">
                  ¿Olvidaste tu contraseña?
                </a>
              </div>
              <div class="input-wrap">
                <mat-icon class="input-icon">lock_outline</mat-icon>
                <input
                  id="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  placeholder="••••••••"
                  autocomplete="current-password"
                />
                <button type="button" class="visibility-btn"
                        (click)="showPassword.set(!showPassword())"
                        [attr.aria-label]="showPassword() ? 'Ocultar' : 'Mostrar'">
                  <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </div>
              @if (form.get('password')?.invalid && form.get('password')?.touched) {
                <span class="field-error">Contraseña requerida</span>
              }
            </div>

            @if (errorMessage()) {
              <div class="error-alert">
                <mat-icon>error_outline</mat-icon>
                {{ errorMessage() }}
              </div>
            }

            <button type="submit" class="submit-btn"
                    [disabled]="loading() || form.invalid">
              @if (loading()) {
                <mat-spinner diameter="22" />
              } @else {
                <span>Iniciar Sesión</span>
              }
            </button>

            <p class="signup-link">
              ¿No tienes cuenta?
              <a routerLink="/auth/signup">Crea una gratis</a>
            </p>
          </form>

          <div class="info-card">
            <strong>USO EXCLUSIVO PERSONAL AUTORIZADO</strong>
          </div>
        </div>
      </div>

      <!-- ─── Visual (der) ─── -->
      <aside class="visual-side fade-right">
        <div class="visual-pattern"></div>
        <div class="visual-content">
          <div class="visual-card">
            <div class="visual-image-wrap">
              <img
                src="https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=720&q=70"
                alt="Interior de panadería moderna"
                loading="lazy"
              />
            </div>
            <h3>Gestiona tu pastelería desde cualquier lugar</h3>
            <p>
              Control total de inventario, ventas, recetas y reportes en tiempo
              real. Todo en una sola plataforma.
            </p>
          </div>

          <div class="stats-cards">
            <div class="stat-card">
              <strong class="stat-indigo">500+</strong>
              <span>Pastelerías</span>
            </div>
            <div class="stat-card">
              <strong class="stat-purple">98%</strong>
              <span>Satisfacción</span>
            </div>
            <div class="stat-card">
              <strong class="stat-pink">24/7</strong>
              <span>Soporte</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .login {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1fr 1fr;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      color: #0f172a;
    }
    @media (max-width: 1024px) {
      .login { grid-template-columns: 1fr; }
      .visual-side { display: none; }
    }

    /* ─── Animations ─── */
    @keyframes fadeLeft {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes fadeRight {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    .fade-left { animation: fadeLeft 0.6s ease-out both; }
    .fade-right { animation: fadeRight 0.6s ease-out both; }

    .gradient-text {
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* ─── Form side ─── */
    .form-side {
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px;
      background: #fff;
    }
    .form-wrapper {
      width: 100%;
      max-width: 440px;
    }
    .back-link {
      display: inline-flex; align-items: center; gap: 8px;
      color: #475569;
      font-size: 14px;
      text-decoration: none;
      margin-bottom: 32px;
      transition: color 0.15s ease;
    }
    .back-link:hover { color: #4f46e5; }
    .back-link mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .logo-block {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 32px;
    }
    .logo-img {
      width: 48px; height: 48px;
      border-radius: 12px;
      display: block;
      object-fit: cover;
    }
    .logo-name {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0;
    }
    .logo-tagline {
      font-size: 13.5px;
      color: #6b7280;
      margin: 0;
    }

    .form-header { margin-bottom: 28px; }
    .form-header h2 {
      font-size: 32px;
      font-weight: 800;
      letter-spacing: -0.025em;
      margin: 0 0 6px 0;
    }
    .form-header p {
      color: #475569;
      font-size: 16px;
      margin: 0;
    }

    .form { display: flex; flex-direction: column; gap: 20px; }
    .field { display: flex; flex-direction: column; gap: 8px; }
    .field label {
      font-size: 14.5px;
      font-weight: 600;
      color: #1f2937;
    }
    .field-row { display: flex; justify-content: space-between; align-items: center; }
    .forgot {
      font-size: 13.5px;
      color: #4f46e5;
      text-decoration: none;
      cursor: pointer;
      font-weight: 500;
    }
    .forgot:hover { color: #4338ca; text-decoration: underline; }
    .input-wrap {
      position: relative;
      display: flex;
      align-items: center;
    }
    .input-icon {
      position: absolute;
      left: 14px;
      color: #9ca3af;
      font-size: 20px;
      width: 20px; height: 20px;
      pointer-events: none;
    }
    .input-wrap input {
      width: 100%;
      height: 48px;
      padding: 0 14px 0 44px;
      background: #fff;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      font-size: 15.5px;
      color: #0f172a;
      font-family: inherit;
      transition: border-color 0.15s ease, box-shadow 0.15s ease;
      outline: none;
    }
    .input-wrap input:focus {
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
    }
    .input-wrap input::placeholder { color: #9ca3af; }
    .visibility-btn {
      position: absolute;
      right: 8px;
      width: 36px; height: 36px;
      background: transparent;
      border: none;
      border-radius: 8px;
      color: #9ca3af;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: color 0.15s ease, background 0.15s ease;
    }
    .visibility-btn:hover { color: #4b5563; background: #f3f4f6; }
    .visibility-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .field-error {
      color: #dc2626;
      font-size: 13px;
    }

    .error-alert {
      display: flex; align-items: center; gap: 8px;
      padding: 12px 16px;
      background: #fee2e2;
      color: #dc2626;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 500;
    }
    .error-alert mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .submit-btn {
      display: inline-flex; align-items: center; justify-content: center;
      gap: 8px;
      width: 100%;
      height: 52px;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
      border: none;
      border-radius: 10px;
      font-size: 17px;
      font-weight: 600;
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
    .submit-btn:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }

    .signup-link {
      text-align: center;
      color: #475569;
      font-size: 15px;
      margin: 16px 0 0 0;
    }
    .signup-link a {
      color: #4f46e5;
      font-weight: 600;
      text-decoration: none;
      margin-left: 4px;
    }
    .signup-link a:hover { color: #4338ca; text-decoration: underline; }

    .info-card {
      margin-top: 32px;
      padding: 16px;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-radius: 12px;
      text-align: center;
      font-size: 13.5px;
      color: #1f2937;
      letter-spacing: 0.05em;
    }

    /* ─── Visual side ─── */
    .visual-side {
      position: relative;
      padding: 48px;
      background: linear-gradient(135deg, #4f46e5 0%, #9333ea 50%, #ec4899 100%);
      display: flex; align-items: center; justify-content: center;
      overflow: hidden;
    }
    .visual-pattern {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px);
      background-size: 60px 60px;
      opacity: 0.4;
    }
    .visual-content {
      position: relative;
      z-index: 1;
      max-width: 540px;
      width: 100%;
    }
    .visual-card {
      padding: 32px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      border-radius: 20px;
      box-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.3);
      margin-bottom: 32px;
    }
    .visual-image-wrap {
      margin-bottom: 24px;
    }
    .visual-image-wrap img {
      width: 100%;
      height: 256px;
      object-fit: cover;
      border-radius: 12px;
      display: block;
    }
    .visual-card h3 {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 12px 0;
    }
    .visual-card p {
      font-size: 15px;
      color: #475569;
      line-height: 1.6;
      margin: 0;
    }
    .stats-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .stat-card {
      padding: 18px 16px;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(8px);
      border-radius: 14px;
      text-align: left;
    }
    .stat-card strong {
      display: block;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 4px;
    }
    .stat-indigo { color: #4f46e5; }
    .stat-purple { color: #9333ea; }
    .stat-pink { color: #ec4899; }
    .stat-card span {
      font-size: 13.5px;
      color: #475569;
    }
  `],
})
export class LoginComponent {
  form: FormGroup;
  loading = signal(false);
  showPassword = signal(false);
  errorMessage = signal('');

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

  comingSoon(featureName: string): void {
    this.snack.open(`${featureName} — disponible pronto.`, 'OK', { duration: 4000 });
  }
}
