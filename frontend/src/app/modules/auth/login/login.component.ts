import { Component, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
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
  ],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="brand">
          <div class="brand-logo">P</div>
          <h1>Pastelicias</h1>
          <p class="brand-subtitle">Sistema de Gestión</p>
        </div>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Correo electrónico</mat-label>
            <input matInput type="email" formControlName="email" placeholder="usuario@pastelicias.com" autocomplete="email" />
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
              autocomplete="current-password"
            />
            <mat-icon matPrefix>lock_outline</mat-icon>
            <button
              mat-icon-button
              matSuffix
              type="button"
              (click)="showPassword.set(!showPassword())"
              [attr.aria-label]="showPassword() ? 'Ocultar' : 'Mostrar'"
            >
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            @if (form.get('password')?.invalid && form.get('password')?.touched) {
              <mat-error>Contraseña requerida</mat-error>
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
              <span>Iniciar Sesión</span>
              <mat-icon class="arrow">arrow_forward</mat-icon>
            }
          </button>
        </form>

        <div class="signup-link">
          ¿No tienes cuenta?
          <a routerLink="/auth/signup">Crear una gratis</a>
        </div>

        <p class="footer-note">USO EXCLUSIVO PERSONAL AUTORIZADO</p>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
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

    .login-card {
      width: 100%;
      max-width: 420px;
      padding: 40px 32px;
      background: #ffffff;
      border-radius: 20px;
      box-shadow: 0 24px 60px -16px rgba(0, 0, 0, 0.4),
                  0 0 0 1px rgba(255, 255, 255, 0.05);
    }

    .brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      gap: 4px;
      margin-bottom: 28px;
    }
    .brand-logo {
      width: 56px;
      height: 56px;
      border-radius: 14px;
      background: linear-gradient(135deg, #4648d4 0%, #645efb 100%);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 26px;
      letter-spacing: -0.02em;
      box-shadow: 0 8px 24px -6px rgba(70, 72, 212, 0.5);
      margin-bottom: 12px;
    }
    .brand h1 {
      margin: 0;
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0b1c30;
    }
    .brand-subtitle {
      margin: 0;
      font-size: 13px;
      color: #767586;
      font-weight: 500;
    }

    .form {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .full-width { width: 100%; }

    .error-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fee2e2;
      color: #dc2626;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 13px;
      font-weight: 500;
      margin: 4px 0 8px 0;
    }
    .error-alert mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .submit-btn {
      height: 48px !important;
      font-size: 15px !important;
      font-weight: 600 !important;
      margin-top: 8px;
      display: flex !important;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .submit-btn .arrow { font-size: 18px; width: 18px; height: 18px; }

    .signup-link {
      text-align: center;
      margin-top: 18px;
      font-size: 13px;
      color: #767586;
    }
    .signup-link a {
      color: #4648d4;
      font-weight: 700;
      text-decoration: none;
      margin-left: 4px;
    }
    .signup-link a:hover { text-decoration: underline; }

    .footer-note {
      margin: 24px 0 0 0;
      text-align: center;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.12em;
      color: #767586;
    }
  `],
})
export class LoginComponent {
  form: FormGroup;
  loading = signal(false);
  showPassword = signal(false);
  errorMessage = signal('');

  constructor(private fb: FormBuilder, private authService: AuthService) {
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
}
