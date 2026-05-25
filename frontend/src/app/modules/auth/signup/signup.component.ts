import { Component, computed, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Signup público: crea un nuevo tenant (Business + Sucursal + Owner) en una sola
 * llamada al backend. Tras crear, hace login automático y redirige a /onboarding.
 *
 * Layout split: izquierda con beneficios visuales (lo que se llevan al
 * crear cuenta), derecha con el form.
 */
@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [
    ReactiveFormsModule, RouterLink,
    MatFormFieldModule, MatInputModule, MatButtonModule,
    MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="signup-page">
      <!-- ─── Panel izquierdo: beneficios ─── -->
      <aside class="benefits-panel">
        <a routerLink="/" class="brand-link">
          <div class="brand-logo">P</div>
          <strong>Pastelicias</strong>
        </a>

        <div class="benefits-content">
          <span class="benefits-tag">CREA TU CUENTA</span>
          <h2>Empieza a vender, organizar y crecer hoy mismo.</h2>
          <p class="benefits-sub">
            En menos de 2 minutos tendrás tu pastelería online, con POS,
            inventario y reportes funcionando.
          </p>

          <ul class="benefits-list">
            <li>
              <div class="benefit-icon"><mat-icon>schedule</mat-icon></div>
              <div>
                <strong>30 días gratis</strong>
                <span>Sin tarjeta. Sin cobros. Sin trampa.</span>
              </div>
            </li>
            <li>
              <div class="benefit-icon"><mat-icon>flash_on</mat-icon></div>
              <div>
                <strong>Setup en 2 minutos</strong>
                <span>Wizard de 3 pasos. Empieza vendiendo el mismo día.</span>
              </div>
            </li>
            <li>
              <div class="benefit-icon"><mat-icon>support_agent</mat-icon></div>
              <div>
                <strong>Te acompañamos</strong>
                <span>Email y chat con humanos peruanos. Sin esperas.</span>
              </div>
            </li>
            <li>
              <div class="benefit-icon"><mat-icon>cancel</mat-icon></div>
              <div>
                <strong>Cancela cuando quieras</strong>
                <span>Sin contratos. Si no te sirve, no sigues.</span>
              </div>
            </li>
          </ul>

          <div class="benefits-trust">
            <div class="trust-avatars">
              <div class="trust-avatar" style="background: linear-gradient(135deg, #4648d4, #645efb)">MQ</div>
              <div class="trust-avatar" style="background: linear-gradient(135deg, #f59e0b, #ef4444)">CM</div>
              <div class="trust-avatar" style="background: linear-gradient(135deg, #10b981, #059669)">LV</div>
              <div class="trust-avatar more">+120</div>
            </div>
            <p>Únete a las pastelerías que ya cambiaron Excel por Pastelicias.</p>
          </div>
        </div>

        <p class="benefits-footer">© {{ year }} Pastelicias · Hecho en Perú 🇵🇪</p>
      </aside>

      <!-- ─── Panel derecho: form ─── -->
      <main class="form-panel">
        <div class="form-wrapper">
          <!-- Logo mobile -->
          <a routerLink="/" class="brand-link mobile">
            <div class="brand-logo">P</div>
            <strong>Pastelicias</strong>
          </a>

          <header class="form-header">
            <h1>Crea tu pastelería</h1>
            <p>Cuenta gratis con 30 días de prueba. Sin tarjeta.</p>
          </header>

          <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Nombre del negocio</mat-label>
              <input matInput formControlName="businessName"
                     placeholder="Pastelería Doña Rosa"
                     autocomplete="organization" />
              <mat-icon matPrefix>storefront</mat-icon>
              @if (form.get('businessName')?.invalid && form.get('businessName')?.touched) {
                <mat-error>Mínimo 2 caracteres</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Tu nombre completo</mat-label>
              <input matInput formControlName="fullName"
                     placeholder="María García"
                     autocomplete="name" />
              <mat-icon matPrefix>person_outline</mat-icon>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Correo electrónico</mat-label>
              <input matInput type="email" formControlName="email"
                     placeholder="tucorreo@gmail.com"
                     autocomplete="email" />
              <mat-icon matPrefix>mail_outline</mat-icon>
              @if (form.get('email')?.invalid && form.get('email')?.touched) {
                <mat-error>Email inválido</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width password-field">
              <mat-label>Contraseña</mat-label>
              <input matInput
                     [type]="showPassword() ? 'text' : 'password'"
                     formControlName="password"
                     (input)="onPasswordChange()"
                     autocomplete="new-password" />
              <mat-icon matPrefix>lock_outline</mat-icon>
              <button mat-icon-button matSuffix type="button"
                      (click)="showPassword.set(!showPassword())">
                <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (form.get('password')?.invalid && form.get('password')?.touched) {
                <mat-error>Mínimo 8 caracteres</mat-error>
              }
            </mat-form-field>

            <!-- Password strength indicator -->
            @if (passwordValue().length > 0) {
              <div class="pwd-strength">
                <div class="pwd-bars">
                  <div class="pwd-bar" [class.active]="passwordStrength() >= 1" [attr.data-level]="passwordStrength()"></div>
                  <div class="pwd-bar" [class.active]="passwordStrength() >= 2" [attr.data-level]="passwordStrength()"></div>
                  <div class="pwd-bar" [class.active]="passwordStrength() >= 3" [attr.data-level]="passwordStrength()"></div>
                  <div class="pwd-bar" [class.active]="passwordStrength() >= 4" [attr.data-level]="passwordStrength()"></div>
                </div>
                <span class="pwd-label" [attr.data-level]="passwordStrength()">
                  {{ strengthLabel() }}
                </span>
              </div>
            }

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
                <span>Crear cuenta gratis</span>
                <mat-icon class="arrow">arrow_forward</mat-icon>
              }
            </button>

            <p class="legal-note">
              Al crear cuenta aceptas nuestros
              <a (click)="comingSoon('Términos de servicio')">Términos</a> y
              <a (click)="comingSoon('Política de privacidad')">Política de privacidad</a>.
            </p>
          </form>

          <div class="login-link">
            ¿Ya tienes cuenta?
            <a routerLink="/auth/login">Iniciar sesión</a>
          </div>
        </div>
      </main>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .signup-page {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1fr 1.05fr;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    }
    @media (max-width: 900px) {
      .signup-page { grid-template-columns: 1fr; }
      .benefits-panel { display: none; }
    }

    /* ─── Panel izquierdo (benefits) ─── */
    .benefits-panel {
      position: relative;
      padding: 40px 48px;
      background:
        radial-gradient(at 20% 20%, rgba(100, 94, 251, 0.3) 0px, transparent 50%),
        radial-gradient(at 80% 80%, rgba(70, 72, 212, 0.25) 0px, transparent 50%),
        linear-gradient(135deg, #0b1c30 0%, #1a1d3f 60%, #2a1a52 100%);
      color: #fff;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      overflow: hidden;
    }
    .benefits-panel::before {
      content: '';
      position: absolute;
      inset: -50%;
      background: radial-gradient(circle, rgba(255, 255, 255, 0.04) 1px, transparent 1px);
      background-size: 24px 24px;
      opacity: 0.5;
    }
    .benefits-panel > * { position: relative; z-index: 1; }
    .brand-link {
      display: inline-flex; align-items: center; gap: 10px;
      font-size: 18px; font-weight: 800;
      color: inherit; text-decoration: none;
    }
    .brand-link.mobile { display: none; color: #0b1c30; margin-bottom: 24px; }
    @media (max-width: 900px) {
      .brand-link.mobile { display: inline-flex; }
    }
    .brand-logo {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #4648d4, #645efb);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 18px;
    }

    .benefits-content {
      max-width: 480px;
      margin: 0 auto;
      width: 100%;
    }
    .benefits-tag {
      display: inline-block;
      padding: 5px 12px;
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.15);
      color: rgba(255, 255, 255, 0.9);
      border-radius: 100px;
      font-size: 11px; font-weight: 800;
      letter-spacing: 0.08em;
      margin-bottom: 20px;
    }
    .benefits-content h2 {
      font-size: clamp(26px, 3vw, 34px);
      font-weight: 800;
      letter-spacing: -0.025em;
      line-height: 1.15;
      margin: 0 0 14px 0;
    }
    .benefits-sub {
      font-size: 15.5px;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.55;
      margin: 0 0 36px 0;
    }
    .benefits-list {
      list-style: none; padding: 0; margin: 0 0 36px 0;
      display: flex; flex-direction: column; gap: 18px;
    }
    .benefits-list li {
      display: flex; gap: 14px; align-items: flex-start;
    }
    .benefit-icon {
      flex-shrink: 0;
      width: 40px; height: 40px;
      border-radius: 10px;
      background: rgba(100, 94, 251, 0.2);
      color: #c7d2fe;
      display: flex; align-items: center; justify-content: center;
    }
    .benefit-icon mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .benefits-list strong {
      display: block;
      font-size: 15px;
      font-weight: 700;
      margin-bottom: 2px;
    }
    .benefits-list span {
      font-size: 13.5px;
      color: rgba(255, 255, 255, 0.6);
      line-height: 1.5;
    }

    .benefits-trust {
      padding: 20px 22px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.08);
      border-radius: 16px;
      display: flex; align-items: center; gap: 16px;
    }
    .trust-avatars {
      display: flex; align-items: center;
      flex-shrink: 0;
    }
    .trust-avatar {
      width: 36px; height: 36px;
      border-radius: 50%;
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 800;
      border: 2px solid #1a1d3f;
      margin-left: -10px;
    }
    .trust-avatar:first-child { margin-left: 0; }
    .trust-avatar.more {
      background: rgba(255, 255, 255, 0.1);
      color: rgba(255, 255, 255, 0.85);
      font-size: 11px;
    }
    .benefits-trust p {
      font-size: 13px;
      color: rgba(255, 255, 255, 0.7);
      line-height: 1.5;
      margin: 0;
    }

    .benefits-footer {
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
      max-width: 420px;
    }
    .form-header { margin-bottom: 24px; }
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

    .form { display: flex; flex-direction: column; gap: 4px; }
    .full-width { width: 100%; }

    /* Password strength */
    .pwd-strength {
      display: flex; align-items: center; gap: 10px;
      margin: -10px 0 8px;
      padding: 0 4px;
    }
    .pwd-bars {
      flex: 1;
      display: flex; gap: 4px;
    }
    .pwd-bar {
      flex: 1;
      height: 4px;
      background: #e2e8f0;
      border-radius: 2px;
      transition: background 0.2s ease;
    }
    .pwd-bar.active[data-level="1"] { background: #ef4444; }
    .pwd-bar.active[data-level="2"] { background: #f59e0b; }
    .pwd-bar.active[data-level="3"] { background: #84cc16; }
    .pwd-bar.active[data-level="4"] { background: #10b981; }
    .pwd-label {
      font-size: 11.5px;
      font-weight: 700;
      letter-spacing: 0.04em;
      min-width: 60px;
      text-align: right;
    }
    .pwd-label[data-level="1"] { color: #ef4444; }
    .pwd-label[data-level="2"] { color: #d97706; }
    .pwd-label[data-level="3"] { color: #65a30d; }
    .pwd-label[data-level="4"] { color: #059669; }

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
      margin-top: 8px;
      display: flex !important;
      align-items: center;
      justify-content: center;
      gap: 8px;
      box-shadow: 0 8px 24px -6px rgba(70, 72, 212, 0.5) !important;
    }
    .submit-btn .arrow { font-size: 18px; width: 18px; height: 18px; }

    .legal-note {
      margin: 12px 0 0 0;
      text-align: center;
      font-size: 12px;
      color: #94a3b8;
      line-height: 1.5;
    }
    .legal-note a {
      color: #64748b;
      text-decoration: underline;
      cursor: pointer;
    }
    .legal-note a:hover { color: #4648d4; }

    .login-link {
      text-align: center;
      margin-top: 24px;
      font-size: 14px;
      color: #475569;
    }
    .login-link a {
      color: #4648d4;
      font-weight: 700;
      text-decoration: none;
      margin-left: 4px;
    }
    .login-link a:hover { text-decoration: underline; }
  `],
})
export class SignupComponent {
  form: FormGroup;
  loading = signal(false);
  showPassword = signal(false);
  errorMessage = signal('');
  passwordValue = signal('');
  year = new Date().getFullYear();

  /** Score 0-4 según longitud y variedad de chars. */
  passwordStrength = computed<number>(() => {
    const p = this.passwordValue();
    if (p.length < 8) return p.length === 0 ? 0 : 1;
    let score = 1;
    if (p.length >= 12) score++;
    if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
    if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) score++;
    return Math.min(score, 4);
  });

  strengthLabel = computed<string>(() => {
    switch (this.passwordStrength()) {
      case 1: return 'Débil';
      case 2: return 'Aceptable';
      case 3: return 'Buena';
      case 4: return 'Excelente';
      default: return '';
    }
  });

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

  onPasswordChange(): void {
    this.passwordValue.set(this.form.get('password')?.value ?? '');
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      await this.authService.signup(this.form.value);
      // AuthService ya redirige a /onboarding
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
