import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';

/**
 * SignUp adaptado al diseño Figma.
 * Split layout INVERTIDO respecto a login: panel visual a la izquierda con
 * título + benefits card + avatars, form a la derecha.
 *
 * Crea un nuevo tenant (Business + Sucursal + Owner) en una sola llamada al
 * backend. Tras crear, hace login automático y redirige a /onboarding.
 */
@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink,
    MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="signup">
      <!-- ─── Visual (izq) ─── -->
      <aside class="visual-side fade-left">
        <div class="visual-pattern"></div>
        <div class="visual-content">
          <div class="visual-header">
            <h2>Empieza gratis hoy</h2>
            <p>Únete a cientos de pastelerías que ya confían en Pastelicias.</p>
          </div>

          <div class="benefits-card">
            <div class="benefits-image-wrap">
              <img
                src="https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=720&q=70"
                alt="Manos preparando masa"
                loading="lazy"
              />
            </div>
            <div class="benefits-list">
              @for (b of benefits; track b) {
                <div class="benefit">
                  <div class="benefit-check">
                    <mat-icon>check</mat-icon>
                  </div>
                  <span>{{ b }}</span>
                </div>
              }
            </div>
          </div>

          <div class="social-proof">
            <div class="avatars">
              @for (a of avatars; track $index) {
                <div class="avatar"></div>
              }
            </div>
            <p><strong>500+ pastelerías</strong> ya están usando Pastelicias.</p>
          </div>
        </div>
      </aside>

      <!-- ─── Form (der) ─── -->
      <div class="form-side fade-right">
        <div class="form-wrapper">
          <a routerLink="/" class="back-link">
            <mat-icon>arrow_back</mat-icon>
            <span>Volver al inicio</span>
          </a>

          <div class="logo-block">
            <div class="logo"><mat-icon>cake</mat-icon></div>
            <h1 class="logo-name gradient-text">Pastelicias</h1>
          </div>

          <div class="form-header">
            <h2>Crea tu pastelería</h2>
            <p>Sin tarjeta. Configurada en 2 minutos.</p>
          </div>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form" novalidate>
            <div class="field">
              <label for="business">Nombre del negocio</label>
              <div class="input-wrap">
                <mat-icon class="input-icon">storefront</mat-icon>
                <input
                  id="business"
                  type="text"
                  formControlName="businessName"
                  placeholder="Mi Pastelería"
                  autocomplete="organization"
                />
              </div>
              @if (form.get('businessName')?.invalid && form.get('businessName')?.touched) {
                <span class="field-error">Mínimo 2 caracteres</span>
              }
            </div>

            <div class="field">
              <label for="name">Tu nombre completo</label>
              <div class="input-wrap">
                <mat-icon class="input-icon">person_outline</mat-icon>
                <input
                  id="name"
                  type="text"
                  formControlName="fullName"
                  placeholder="María García"
                  autocomplete="name"
                />
              </div>
            </div>

            <div class="field">
              <label for="email">Correo electrónico</label>
              <div class="input-wrap">
                <mat-icon class="input-icon">mail_outline</mat-icon>
                <input
                  id="email"
                  type="email"
                  formControlName="email"
                  placeholder="maria@mipasteleria.com"
                  autocomplete="email"
                />
              </div>
              @if (form.get('email')?.invalid && form.get('email')?.touched) {
                <span class="field-error">Email inválido</span>
              }
            </div>

            <div class="field">
              <label for="password">Contraseña</label>
              <div class="input-wrap">
                <mat-icon class="input-icon">lock_outline</mat-icon>
                <input
                  id="password"
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  placeholder="••••••••"
                  autocomplete="new-password"
                />
                <button type="button" class="visibility-btn"
                        (click)="showPassword.set(!showPassword())"
                        [attr.aria-label]="showPassword() ? 'Ocultar' : 'Mostrar'">
                  <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </div>
              @if (form.get('password')?.invalid && form.get('password')?.touched) {
                <span class="field-error">Mínimo 8 caracteres</span>
              } @else {
                <span class="field-hint">Mínimo 8 caracteres</span>
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
                <span>Crear cuenta gratis</span>
                <mat-icon class="arrow">arrow_forward</mat-icon>
              }
            </button>

            <p class="legal-note">
              Al crear cuenta aceptas nuestros
              <a (click)="comingSoon('Términos de servicio')">Términos de Servicio</a> y
              <a (click)="comingSoon('Política de privacidad')">Política de Privacidad</a>.
            </p>

            <p class="login-link">
              ¿Ya tienes cuenta?
              <a routerLink="/auth/login">Iniciar sesión</a>
            </p>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .signup {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1fr 1fr;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      color: #0f172a;
    }
    @media (max-width: 1024px) {
      .signup { grid-template-columns: 1fr; }
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

    /* ─── Visual side (izq) ─── */
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
    .visual-header {
      margin-bottom: 32px;
      color: #fff;
    }
    .visual-header h2 {
      font-size: clamp(36px, 4vw, 48px);
      font-weight: 800;
      letter-spacing: -0.025em;
      line-height: 1.1;
      margin: 0 0 16px 0;
    }
    .visual-header p {
      font-size: 20px;
      color: #e0e7ff;
      margin: 0;
    }
    .benefits-card {
      padding: 32px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      border-radius: 20px;
      box-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.3);
      margin-bottom: 32px;
    }
    .benefits-image-wrap {
      margin-bottom: 24px;
    }
    .benefits-image-wrap img {
      width: 100%;
      height: 256px;
      object-fit: cover;
      border-radius: 12px;
      display: block;
    }
    .benefits-list {
      display: flex; flex-direction: column;
      gap: 16px;
    }
    .benefit {
      display: flex; align-items: center; gap: 12px;
      color: #1f2937;
    }
    .benefit-check {
      flex-shrink: 0;
      width: 24px; height: 24px;
      border-radius: 50%;
      background: #dcfce7;
      color: #16a34a;
      display: flex; align-items: center; justify-content: center;
    }
    .benefit-check mat-icon {
      font-size: 16px; width: 16px; height: 16px;
    }
    .benefit span {
      font-size: 15px;
      font-weight: 500;
    }

    .social-proof {
      display: flex; align-items: center; gap: 16px;
      color: #fff;
    }
    .avatars { display: flex; }
    .avatar {
      width: 40px; height: 40px;
      border-radius: 50%;
      background: linear-gradient(135deg, #818cf8, #c084fc);
      border: 2px solid #fff;
      margin-left: -8px;
    }
    .avatar:first-child { margin-left: 0; }
    .social-proof p {
      font-size: 14px;
      margin: 0;
    }
    .social-proof strong { font-weight: 700; }

    /* ─── Form side (der) ─── */
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
    .logo {
      width: 48px; height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
    }
    .logo mat-icon { font-size: 26px; width: 26px; height: 26px; }
    .logo-name {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
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
    .field-hint {
      color: #6b7280;
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
    .submit-btn .arrow { font-size: 18px; width: 18px; height: 18px; }

    .legal-note {
      text-align: center;
      color: #6b7280;
      font-size: 12.5px;
      line-height: 1.5;
      margin: 4px 0 0;
    }
    .legal-note a {
      color: #4f46e5;
      cursor: pointer;
      text-decoration: none;
    }
    .legal-note a:hover { text-decoration: underline; }

    .login-link {
      text-align: center;
      color: #475569;
      font-size: 15px;
      margin: 12px 0 0 0;
    }
    .login-link a {
      color: #4f46e5;
      font-weight: 600;
      text-decoration: none;
      margin-left: 4px;
    }
    .login-link a:hover { color: #4338ca; text-decoration: underline; }
  `],
})
export class SignupComponent {
  form: FormGroup;
  loading = signal(false);
  showPassword = signal(false);
  errorMessage = signal('');

  benefits = [
    '30 días gratis, sin tarjeta',
    'Configuración en 2 minutos',
    'Soporte en español',
    'Cancela cuando quieras',
  ];

  avatars = [0, 1, 2, 3];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private snack: MatSnackBar,
  ) {
    this.form = this.fb.group({
      businessName: ['', [Validators.required, Validators.minLength(2)]],
      fullName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      await this.authService.signup(this.form.value);
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error al crear cuenta');
    } finally {
      this.loading.set(false);
    }
  }

  comingSoon(featureName: string): void {
    this.snack.open(`${featureName} — disponible pronto.`, 'OK', { duration: 4000 });
  }
}
