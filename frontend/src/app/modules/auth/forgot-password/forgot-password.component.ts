import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';

/**
 * Flujo de recuperación de contraseña — versión Supabase Auth.
 *
 * Un solo paso: el user ingresa su email → backend llama a
 * supabase.auth.resetPasswordForEmail() → Supabase manda un email con link
 * de recovery → al clickear, el user aterriza en /auth/reset-password donde
 * pone su nueva contraseña.
 *
 * Ventaja: Supabase envía los emails desde su propio SMTP, sin restricciones
 * de destinatario (a diferencia de Resend en modo testing).
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

          @if (!sent()) {
            <div class="step-content">
              <h2>Recupera tu contraseña</h2>
              <p class="step-sub">
                Ingresa el correo de tu cuenta. Te enviaremos un enlace para
                crear una contraseña nueva.
              </p>

              <form [formGroup]="emailForm" (ngSubmit)="submit()" class="form" novalidate>
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
                    <span>Enviar enlace</span>
                    <mat-icon>send</mat-icon>
                  }
                </button>
              </form>
            </div>
          } @else {
            <div class="step-content success">
              <div class="success-icon">
                <mat-icon>mark_email_read</mat-icon>
              </div>
              <h2>Revisa tu correo</h2>
              <p class="step-sub">
                Si <strong>{{ emailValue() }}</strong> está registrado, te enviamos
                un enlace a tu bandeja. Ábrelo y crea tu nueva contraseña.
              </p>
              <div class="info-box">
                <mat-icon>tips_and_updates</mat-icon>
                <span>
                  ¿No lo ves? Revisa la carpeta de SPAM o Promociones. Si en
                  5 minutos no llegó, vuelve a intentar.
                </span>
              </div>
              <button type="button" class="link-btn" (click)="reset()">
                Enviar a otro correo
              </button>
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
    .step-sub strong { color: #1f2937; }

    .success { text-align: center; }
    .success .step-sub { text-align: center; }
    .success-icon {
      width: 72px; height: 72px;
      border-radius: 50%;
      background: linear-gradient(135deg, #d1fae5, #6ee7b7);
      color: #065f46;
      display: flex; align-items: center; justify-content: center;
      margin: 0 auto 20px;
    }
    .success-icon mat-icon { font-size: 36px; width: 36px; height: 36px; }
    .info-box {
      display: flex; align-items: flex-start; gap: 10px;
      padding: 14px 16px;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-radius: 12px;
      color: #1f2937;
      font-size: 13.5px;
      line-height: 1.5;
      text-align: left;
      margin-bottom: 16px;
    }
    .info-box mat-icon {
      color: #4f46e5; flex-shrink: 0;
      font-size: 20px; width: 20px; height: 20px;
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
  loading = signal(false);
  sent = signal(false);
  errorMessage = signal('');
  emailValue = signal('');

  emailForm: FormGroup;
  private readonly authUrl = `${environment.apiUrl}/auth`;

  constructor(private fb: FormBuilder, private http: HttpClient) {
    this.emailForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
    });
  }

  async submit(): Promise<void> {
    if (this.emailForm.invalid) return;
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const email = (this.emailForm.value.email as string).toLowerCase().trim();
      this.emailValue.set(email);
      await firstValueFrom(
        this.http.post(`${this.authUrl}/forgot-password`, { email })
      );
      this.sent.set(true);
    } catch (err: unknown) {
      this.errorMessage.set(this.errorText(err));
    } finally {
      this.loading.set(false);
    }
  }

  reset(): void {
    this.sent.set(false);
    this.emailForm.reset();
    this.errorMessage.set('');
  }

  private errorText(err: unknown): string {
    if (typeof err === 'object' && err && 'error' in err) {
      const body = (err as { error?: { error?: string; message?: string } }).error;
      return body?.error ?? body?.message ?? 'No pudimos enviar el enlace. Intenta de nuevo.';
    }
    return err instanceof Error ? err.message : 'No pudimos enviar el enlace. Intenta de nuevo.';
  }
}
