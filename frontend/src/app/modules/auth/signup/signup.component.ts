import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';

/**
 * Signup público: crea un nuevo tenant (Business + Sucursal + Owner) en una sola
 * llamada al backend. Tras crear, hace login automático y redirige a /onboarding.
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
      <div class="signup-card">
        <div class="brand">
          <div class="brand-logo">P</div>
          <h1>Crea tu pastelería</h1>
          <p class="brand-subtitle">Sin tarjeta. Configurada en 2 minutos.</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Nombre del negocio</mat-label>
            <input matInput formControlName="businessName" placeholder="Pastelería Doña Rosa" autocomplete="organization" />
            <mat-icon matPrefix>storefront</mat-icon>
            @if (form.get('businessName')?.invalid && form.get('businessName')?.touched) {
              <mat-error>Mínimo 2 caracteres</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Tu nombre completo</mat-label>
            <input matInput formControlName="fullName" placeholder="María García" autocomplete="name" />
            <mat-icon matPrefix>person_outline</mat-icon>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Correo electrónico</mat-label>
            <input matInput type="email" formControlName="email" placeholder="tucorreo@gmail.com" autocomplete="email" />
            <mat-icon matPrefix>mail_outline</mat-icon>
            @if (form.get('email')?.invalid && form.get('email')?.touched) {
              <mat-error>Email inválido</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Contraseña</mat-label>
            <input
              matInput
              [type]="showPassword() ? 'text' : 'password'"
              formControlName="password"
              autocomplete="new-password"
            />
            <mat-icon matPrefix>lock_outline</mat-icon>
            <button
              mat-icon-button
              matSuffix
              type="button"
              (click)="showPassword.set(!showPassword())"
            >
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            <mat-hint>Mínimo 8 caracteres</mat-hint>
            @if (form.get('password')?.invalid && form.get('password')?.touched) {
              <mat-error>Mínimo 8 caracteres</mat-error>
            }
          </mat-form-field>

          @if (errorMessage()) {
            <div class="error-alert">
              <mat-icon>error_outline</mat-icon>
              {{ errorMessage() }}
            </div>
          }

          <button
            mat-flat-button
            color="primary"
            class="full-width submit-btn"
            type="submit"
            [disabled]="loading() || form.invalid"
          >
            @if (loading()) {
              <mat-spinner diameter="20" />
            } @else {
              <span>Crear cuenta gratis</span>
              <mat-icon class="arrow">arrow_forward</mat-icon>
            }
          </button>

          <p class="legal-note">
            Al crear cuenta aceptas nuestros Términos de Servicio y Política de Privacidad.
          </p>
        </form>

        <div class="login-link">
          ¿Ya tienes cuenta?
          <a routerLink="/auth/login">Iniciar sesión</a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .signup-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background:
        radial-gradient(at 20% 30%, rgba(70, 72, 212, 0.18) 0px, transparent 50%),
        radial-gradient(at 80% 70%, rgba(100, 94, 251, 0.15) 0px, transparent 50%),
        linear-gradient(135deg, #0b1c30 0%, #1a1d3f 60%, #2a1a52 100%);
    }
    .signup-card {
      width: 100%;
      max-width: 460px;
      padding: 40px 32px;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 24px 60px -16px rgba(0, 0, 0, 0.4),
                  0 0 0 1px rgba(255, 255, 255, 0.05);
    }
    .brand {
      display: flex; flex-direction: column; align-items: center;
      text-align: center; gap: 4px; margin-bottom: 28px;
    }
    .brand-logo {
      width: 56px; height: 56px;
      border-radius: 14px;
      background: linear-gradient(135deg, #4648d4 0%, #645efb 100%);
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 26px; letter-spacing: -0.02em;
      box-shadow: 0 8px 24px -6px rgba(70, 72, 212, 0.5);
      margin-bottom: 12px;
    }
    .brand h1 { margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.02em; color: #0b1c30; }
    .brand-subtitle { margin: 0; font-size: 13px; color: #767586; font-weight: 500; }

    .form { display: flex; flex-direction: column; gap: 6px; }
    .full-width { width: 100%; }

    .error-alert {
      display: flex; align-items: center; gap: 8px;
      background: #fee2e2; color: #dc2626;
      padding: 10px 14px; border-radius: 8px;
      font-size: 13px; font-weight: 500;
      margin: 4px 0 8px 0;
    }
    .error-alert mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .submit-btn {
      height: 48px !important;
      font-size: 15px !important;
      font-weight: 600 !important;
      margin-top: 8px;
      display: flex !important;
      align-items: center; justify-content: center; gap: 6px;
    }
    .submit-btn .arrow { font-size: 18px; width: 18px; height: 18px; }

    .legal-note {
      margin: 12px 0 0 0;
      text-align: center;
      font-size: 11px;
      color: #94a3b8;
      line-height: 1.4;
    }
    .login-link {
      text-align: center; margin-top: 18px;
      font-size: 13px; color: #767586;
    }
    .login-link a {
      color: #4648d4; font-weight: 700; text-decoration: none; margin-left: 4px;
    }
    .login-link a:hover { text-decoration: underline; }
  `],
})
export class SignupComponent {
  form: FormGroup;
  loading = signal(false);
  showPassword = signal(false);
  errorMessage = signal('');

  constructor(private fb: FormBuilder, private authService: AuthService) {
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
      // AuthService ya redirige a /onboarding
    } catch (err: unknown) {
      this.errorMessage.set(err instanceof Error ? err.message : 'Error al crear cuenta');
    } finally {
      this.loading.set(false);
    }
  }
}
