import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';

/**
 * Flujo de recuperación de contraseña con código de 6 dígitos.
 *
 * 3 pasos internos en un solo componente:
 *  1. Email → POST /auth/forgot-password (manda código por email)
 *  2. Código 6 dígitos → POST /auth/verify-reset-code (devuelve resetToken)
 *  3. Nueva contraseña → POST /auth/reset-password (cambia password)
 *
 * Si el usuario refresca queda en el paso 1 (no persistimos estado).
 */
@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="forgot">
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

          <!-- Step indicator -->
          <div class="steps">
            <div class="step" [class.active]="step() >= 1" [class.done]="step() > 1">1</div>
            <div class="step-line" [class.active]="step() > 1"></div>
            <div class="step" [class.active]="step() >= 2" [class.done]="step() > 2">2</div>
            <div class="step-line" [class.active]="step() > 2"></div>
            <div class="step" [class.active]="step() >= 3">3</div>
          </div>

          <!-- ─── Paso 1: email ─── -->
          @if (step() === 1) {
            <div class="step-content">
              <h2>Recupera tu contraseña</h2>
              <p class="step-sub">Ingresa tu correo y te enviaremos un código de 6 dígitos.</p>

              <form [formGroup]="emailForm" (ngSubmit)="submitEmail()" class="form" novalidate>
                <div class="field">
                  <label>Correo electrónico</label>
                  <div class="input-wrap">
                    <mat-icon class="input-icon">mail_outline</mat-icon>
                    <input type="email" formControlName="email"
                           placeholder="tu@email.com"
                           autocomplete="email" autofocus />
                  </div>
                  @if (emailForm.get('email')?.invalid && emailForm.get('email')?.touched) {
                    <span class="field-error">Email inválido</span>
                  }
                </div>

                @if (errorMessage()) {
                  <div class="error-alert">
                    <mat-icon>error_outline</mat-icon>
                    {{ errorMessage() }}
                  </div>
                }

                <button type="submit" class="submit-btn"
                        [disabled]="loading() || emailForm.invalid">
                  @if (loading()) {
                    <mat-spinner diameter="22" />
                  } @else {
                    <span>Enviar código</span>
                    <mat-icon>send</mat-icon>
                  }
                </button>
              </form>
            </div>
          }

          <!-- ─── Paso 2: código ─── -->
          @if (step() === 2) {
            <div class="step-content">
              <h2>Revisa tu correo</h2>
              <p class="step-sub">
                Si <strong>{{ emailValue() }}</strong> existe en nuestra base, ya te enviamos un código.
                Pega los 6 dígitos abajo.
              </p>

              <form [formGroup]="codeForm" (ngSubmit)="submitCode()" class="form" novalidate>
                <div class="field">
                  <label>Código de 6 dígitos</label>
                  <div class="input-wrap">
                    <mat-icon class="input-icon">pin</mat-icon>
                    <input type="text"
                           formControlName="code"
                           inputmode="numeric"
                           maxlength="6"
                           placeholder="123456"
                           autocomplete="one-time-code"
                           autofocus />
                  </div>
                  @if (codeForm.get('code')?.invalid && codeForm.get('code')?.touched) {
                    <span class="field-error">Debe ser 6 dígitos numéricos</span>
                  } @else {
                    <span class="field-hint">El código vence en 15 minutos.</span>
                  }
                </div>

                @if (errorMessage()) {
                  <div class="error-alert">
                    <mat-icon>error_outline</mat-icon>
                    {{ errorMessage() }}
                  </div>
                }

                <button type="submit" class="submit-btn"
                        [disabled]="loading() || codeForm.invalid">
                  @if (loading()) {
                    <mat-spinner diameter="22" />
                  } @else {
                    <span>Verificar código</span>
                    <mat-icon>arrow_forward</mat-icon>
                  }
                </button>

                <button type="button" class="link-btn" (click)="restart()">
                  ¿No recibiste el código? Empezar de nuevo
                </button>
              </form>
            </div>
          }

          <!-- ─── Paso 3: nueva password ─── -->
          @if (step() === 3) {
            <div class="step-content">
              <h2>Crea tu nueva contraseña</h2>
              <p class="step-sub">Mínimo 8 caracteres. Te recomendamos combinar letras, números y símbolos.</p>

              <form [formGroup]="passwordForm" (ngSubmit)="submitPassword()" class="form" novalidate>
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
                  @if (passwordForm.get('password')?.invalid && passwordForm.get('password')?.touched) {
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
                  @if (passwordForm.errors?.['mismatch'] && passwordForm.get('confirm')?.touched) {
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
                        [disabled]="loading() || passwordForm.invalid">
                  @if (loading()) {
                    <mat-spinner diameter="22" />
                  } @else {
                    <span>Cambiar contraseña</span>
                    <mat-icon>check</mat-icon>
                  }
                </button>
              </form>
            </div>
          }

          <p class="login-link">
            ¿Recordaste tu contraseña?
            <a routerLink="/auth/login">Iniciar sesión</a>
          </p>
        </div>
      </div>

      <aside class="visual-side fade-right">
        <div class="visual-pattern"></div>
        <div class="visual-content">
          <div class="visual-card">
            <div class="visual-image-wrap">
              <img
                src="https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=720&q=70"
                alt="Pasteles"
                loading="lazy"
              />
            </div>
            <h3>Estamos para ayudarte</h3>
            <p>
              Tus datos están seguros con nosotros. Si necesitas ayuda escríbenos
              a soporte&#64;genimatech.com.
            </p>
          </div>
        </div>
      </aside>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .forgot {
      min-height: 100vh;
      display: grid;
      grid-template-columns: 1fr 1fr;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      color: #0f172a;
    }
    @media (max-width: 1024px) {
      .forgot { grid-template-columns: 1fr; }
      .visual-side { display: none; }
    }

    @keyframes fadeLeft {
      from { opacity: 0; transform: translateX(-20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes fadeRight {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .fade-left { animation: fadeLeft 0.6s ease-out both; }
    .fade-right { animation: fadeRight 0.6s ease-out both; }

    .gradient-text {
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* Form side */
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
      margin-bottom: 24px;
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

    /* Steps */
    .steps {
      display: flex; align-items: center; justify-content: center;
      gap: 4px; margin: 8px 0 32px;
    }
    .step {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: #f1f5f9;
      color: #94a3b8;
      display: flex; align-items: center; justify-content: center;
      font-size: 14px; font-weight: 700;
      transition: all 0.2s ease;
    }
    .step.active {
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
    }
    .step.done {
      background: #10b981; color: #fff;
    }
    .step-line {
      flex: 0 0 28px;
      height: 2px;
      background: #f1f5f9;
      transition: background 0.2s ease;
    }
    .step-line.active { background: #10b981; }

    .step-content {
      animation: fadeIn 0.35s ease-out both;
    }
    .step-content h2 {
      font-size: 28px; font-weight: 800;
      letter-spacing: -0.025em; margin: 0 0 8px 0;
    }
    .step-sub {
      font-size: 15px; color: #475569; line-height: 1.55;
      margin: 0 0 24px 0;
    }
    .step-sub strong { color: #1f2937; }

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
    .input-wrap input[inputmode="numeric"] {
      letter-spacing: 0.3em;
      font-size: 18px;
      font-weight: 600;
      text-align: center;
      padding-left: 14px;
    }
    .input-wrap input[inputmode="numeric"] ~ .input-icon { display: none; }
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
    .field-hint { color: #6b7280; font-size: 13px; }

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

    .link-btn {
      width: 100%;
      background: transparent;
      border: none;
      color: #4f46e5;
      font-size: 13.5px; font-weight: 600;
      cursor: pointer;
      padding: 8px;
      font-family: inherit;
      transition: color 0.15s ease;
    }
    .link-btn:hover { color: #4338ca; text-decoration: underline; }

    .login-link {
      text-align: center; color: #475569;
      font-size: 14px; margin: 24px 0 0;
    }
    .login-link a {
      color: #4f46e5; font-weight: 600;
      text-decoration: none; margin-left: 4px;
    }
    .login-link a:hover { color: #4338ca; text-decoration: underline; }

    /* Visual side */
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
    .visual-content {
      position: relative; z-index: 1;
      max-width: 480px; width: 100%;
    }
    .visual-card {
      padding: 32px;
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(8px);
      border-radius: 20px;
      box-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.3);
    }
    .visual-image-wrap { margin-bottom: 24px; }
    .visual-image-wrap img {
      width: 100%; height: 240px;
      object-fit: cover;
      border-radius: 12px; display: block;
    }
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
export class ForgotPasswordComponent {
  step = signal<1 | 2 | 3>(1);
  loading = signal(false);
  showPassword = signal(false);
  errorMessage = signal('');
  emailValue = signal('');
  resetToken = signal<string | null>(null);

  emailForm: FormGroup;
  codeForm: FormGroup;
  passwordForm: FormGroup;

  private readonly authUrl = `${environment.apiUrl}/auth`;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private router: Router,
    private snack: MatSnackBar,
  ) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
    this.codeForm = this.fb.group({
      code: ['', [Validators.required, Validators.pattern(/^\d{6}$/)]],
    });
    this.passwordForm = this.fb.group(
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
  }

  async submitEmail(): Promise<void> {
    if (this.emailForm.invalid) return;
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const email = (this.emailForm.value.email as string).toLowerCase().trim();
      this.emailValue.set(email);
      await firstValueFrom(
        this.http.post(`${this.authUrl}/forgot-password`, { email })
      );
      this.step.set(2);
    } catch (err: unknown) {
      this.errorMessage.set(this.errorText(err));
    } finally {
      this.loading.set(false);
    }
  }

  async submitCode(): Promise<void> {
    if (this.codeForm.invalid) return;
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const code = this.codeForm.value.code as string;
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; data: { resetToken: string } }>(
          `${this.authUrl}/verify-reset-code`,
          { email: this.emailValue(), code }
        )
      );
      this.resetToken.set(res.data.resetToken);
      this.step.set(3);
    } catch (err: unknown) {
      this.errorMessage.set(this.errorText(err));
    } finally {
      this.loading.set(false);
    }
  }

  async submitPassword(): Promise<void> {
    if (this.passwordForm.invalid || !this.resetToken()) return;
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      await firstValueFrom(
        this.http.post(`${this.authUrl}/reset-password`, {
          resetToken: this.resetToken(),
          newPassword: this.passwordForm.value.password,
        })
      );
      this.snack.open('✓ Contraseña actualizada. Inicia sesión.', 'OK', { duration: 5000 });
      this.router.navigate(['/auth/login']);
    } catch (err: unknown) {
      this.errorMessage.set(this.errorText(err));
    } finally {
      this.loading.set(false);
    }
  }

  restart(): void {
    this.step.set(1);
    this.codeForm.reset();
    this.passwordForm.reset();
    this.errorMessage.set('');
    this.resetToken.set(null);
  }

  private errorText(err: unknown): string {
    if (typeof err === 'object' && err && 'error' in err) {
      const body = (err as { error?: { error?: string; message?: string } }).error;
      return body?.error ?? body?.message ?? 'Ocurrió un error. Intenta de nuevo.';
    }
    return err instanceof Error ? err.message : 'Ocurrió un error. Intenta de nuevo.';
  }
}
