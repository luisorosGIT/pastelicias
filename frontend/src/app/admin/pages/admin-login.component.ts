import { Component, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env/environment';
import { ApiResponse } from '../../core/models';
import { AdminAuthService } from '../admin-auth.service';
import { getErrorMessage } from '../../core/utils/error-message';

/**
 * Login del panel admin del SaaS.
 *
 * Si la DB no tiene ningún admin todavía, el componente muestra un wizard de
 * "setup inicial" donde se crea el primer admin con email + password + nombre.
 * Una vez creado, futuras visitas a /admin/login muestran solo el form normal.
 *
 * Para saber si hay admins, intentamos un POST /admin/auth/setup vacío (que
 * fallará con 400 si ya hay alguno, lo que nos dice que debemos usar login).
 * Más simple: hacemos un check inicial con un GET o agregamos un endpoint
 * /admin/auth/needs-setup. Por ahora dejamos un toggle manual en la UI.
 */
@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [ReactiveFormsModule, MatIconModule, MatProgressSpinnerModule],
  template: `
    <div class="login">
      <div class="card">
        <div class="brand">
          <img src="assets/branding/logo.png" alt="Genimatech" class="logo" />
          <div class="brand-text">
            <h1>Genimatech <span class="badge">ADMIN</span></h1>
            <p>Panel de administración del SaaS</p>
          </div>
        </div>

        @if (mode() === 'login') {
          <h2 class="title">Iniciar sesión</h2>
          <p class="subtitle">Solo accesible para administradores autorizados.</p>

          <form [formGroup]="loginForm" (ngSubmit)="login()" class="form" novalidate>
            <div class="field">
              <label>Email</label>
              <div class="input-wrap">
                <mat-icon class="input-icon">mail_outline</mat-icon>
                <input type="email" formControlName="email"
                       placeholder="admin@genimatech.com"
                       autocomplete="email" autofocus />
              </div>
            </div>

            <div class="field">
              <label>Contraseña</label>
              <div class="input-wrap">
                <mat-icon class="input-icon">lock_outline</mat-icon>
                <input
                  [type]="showPassword() ? 'text' : 'password'"
                  formControlName="password"
                  placeholder="••••••••"
                  autocomplete="current-password" />
                <button type="button" class="visibility-btn"
                        (click)="showPassword.set(!showPassword())">
                  <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
              </div>
            </div>

            @if (errorMessage()) {
              <div class="error">
                <mat-icon>error_outline</mat-icon>
                {{ errorMessage() }}
              </div>
            }

            <button type="submit" class="submit"
                    [disabled]="loading() || loginForm.invalid">
              @if (loading()) {
                <mat-spinner diameter="22" />
              } @else {
                <span>Entrar al panel</span>
                <mat-icon>arrow_forward</mat-icon>
              }
            </button>

            <button type="button" class="link-btn" (click)="mode.set('setup')">
              ¿Primera vez? Crear administrador inicial
            </button>
          </form>
        } @else {
          <h2 class="title">Crear admin inicial</h2>
          <p class="subtitle">
            Esta opción solo funciona si la DB no tiene admins todavía.
            Después de crear el primero, esta sección queda deshabilitada.
          </p>

          <form [formGroup]="setupForm" (ngSubmit)="setup()" class="form" novalidate>
            <div class="field">
              <label>Nombre completo</label>
              <div class="input-wrap">
                <mat-icon class="input-icon">person_outline</mat-icon>
                <input type="text" formControlName="name"
                       placeholder="Luis Oros" autofocus />
              </div>
            </div>

            <div class="field">
              <label>Email</label>
              <div class="input-wrap">
                <mat-icon class="input-icon">mail_outline</mat-icon>
                <input type="email" formControlName="email"
                       placeholder="admin@genimatech.com" autocomplete="email" />
              </div>
            </div>

            <div class="field">
              <label>Contraseña</label>
              <div class="input-wrap">
                <mat-icon class="input-icon">lock_outline</mat-icon>
                <input type="password" formControlName="password"
                       placeholder="Mínimo 8 caracteres"
                       autocomplete="new-password" />
              </div>
            </div>

            @if (errorMessage()) {
              <div class="error">
                <mat-icon>error_outline</mat-icon>
                {{ errorMessage() }}
              </div>
            }

            <button type="submit" class="submit"
                    [disabled]="loading() || setupForm.invalid">
              @if (loading()) {
                <mat-spinner diameter="22" />
              } @else {
                <span>Crear admin</span>
                <mat-icon>check</mat-icon>
              }
            </button>

            <button type="button" class="link-btn" (click)="mode.set('login')">
              Volver al login
            </button>
          </form>
        }
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; }
    .login {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 32px 24px;
      background:
        radial-gradient(at 20% 20%, rgba(79, 70, 229, 0.25) 0px, transparent 50%),
        radial-gradient(at 80% 80%, rgba(147, 51, 234, 0.2) 0px, transparent 50%),
        linear-gradient(135deg, #0f1729 0%, #1e1b4b 100%);
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    }
    .card {
      width: 100%;
      max-width: 440px;
      background: #fff;
      border-radius: 20px;
      padding: 40px 36px;
      box-shadow: 0 24px 64px -12px rgba(0, 0, 0, 0.4);
    }
    .brand {
      display: flex; align-items: center; gap: 12px;
      margin-bottom: 32px;
    }
    .logo {
      width: 56px; height: 56px;
      border-radius: 14px;
      object-fit: cover;
    }
    .brand-text h1 {
      font-size: 22px; font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 4px 0;
      color: #0f172a;
      display: inline-flex; align-items: center; gap: 8px;
    }
    .badge {
      font-size: 10px; font-weight: 800;
      letter-spacing: 0.1em;
      padding: 3px 8px;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
      border-radius: 6px;
    }
    .brand-text p {
      font-size: 13px;
      color: #64748b;
      margin: 0;
    }
    .title {
      font-size: 24px; font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 8px 0;
      color: #0f172a;
    }
    .subtitle {
      font-size: 14px;
      color: #64748b;
      line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .form { display: flex; flex-direction: column; gap: 16px; }
    .field { display: flex; flex-direction: column; gap: 6px; }
    .field label {
      font-size: 13.5px;
      font-weight: 600;
      color: #1f2937;
    }
    .input-wrap { position: relative; display: flex; align-items: center; }
    .input-icon {
      position: absolute; left: 14px;
      color: #9ca3af;
      font-size: 20px; width: 20px; height: 20px;
      pointer-events: none;
    }
    .input-wrap input {
      width: 100%; height: 46px;
      padding: 0 14px 0 44px;
      background: #fff;
      border: 1px solid #d1d5db;
      border-radius: 10px;
      font-size: 15px;
      font-family: inherit;
      outline: none;
      transition: border-color 0.15s, box-shadow 0.15s;
    }
    .input-wrap input:focus {
      border-color: #4f46e5;
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
    }
    .visibility-btn {
      position: absolute; right: 6px;
      width: 34px; height: 34px;
      background: transparent; border: none;
      border-radius: 8px;
      color: #9ca3af; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
    }
    .visibility-btn:hover { background: #f3f4f6; }
    .visibility-btn mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .error {
      display: flex; align-items: center; gap: 8px;
      padding: 10px 14px;
      background: #fee2e2;
      color: #dc2626;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 500;
    }
    .error mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .submit {
      display: inline-flex; align-items: center; justify-content: center;
      gap: 8px;
      width: 100%; height: 50px;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
      border: none; border-radius: 10px;
      font-size: 15px; font-weight: 700;
      font-family: inherit;
      cursor: pointer;
      box-shadow: 0 10px 24px -8px rgba(79, 70, 229, 0.45);
      transition: transform 0.15s, opacity 0.15s, box-shadow 0.15s;
      margin-top: 4px;
    }
    .submit:hover:not(:disabled) {
      transform: translateY(-1px);
      box-shadow: 0 14px 32px -8px rgba(79, 70, 229, 0.55);
    }
    .submit:disabled { opacity: 0.6; cursor: not-allowed; }
    .submit mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .link-btn {
      background: transparent;
      border: none;
      color: #4f46e5;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      padding: 8px;
      font-family: inherit;
    }
    .link-btn:hover { color: #4338ca; text-decoration: underline; }
  `],
})
export class AdminLoginComponent implements OnInit {
  mode = signal<'login' | 'setup'>('login');
  loading = signal(false);
  showPassword = signal(false);
  errorMessage = signal('');

  loginForm: FormGroup;
  setupForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private auth: AdminAuthService,
    private http: HttpClient,
  ) {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(1)]],
    });
    this.setupForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  async ngOnInit(): Promise<void> {
    // Check if there's no admin yet, in which case we should default to setup mode.
    // Lo hacemos via un intento dummy de setup con datos vacíos: si responde
    // "Ya hay un administrador" significa que NO necesitamos setup.
    // Truco simple sin agregar endpoint nuevo.
    try {
      const res = await firstValueFrom(
        this.http.post<{ success: boolean; error?: string }>(
          `${environment.apiUrl}/admin/auth/setup`,
          { email: '', password: '', name: '' }
        ).pipe()
      );
      // El backend rechazará por validación (400). El cuerpo nos dice el motivo.
      if (res?.error?.includes('administrador configurado')) {
        this.mode.set('login');
      }
    } catch (err) {
      const e = err as { error?: { error?: string }; status?: number };
      const msg = e?.error?.error ?? '';
      if (msg.includes('administrador configurado')) {
        this.mode.set('login');
      } else if (e?.status === 400) {
        // 400 por validación (email vacío, etc.) → significa que se PERMITE setup
        this.mode.set('setup');
      }
    }
  }

  async login(): Promise<void> {
    if (this.loginForm.invalid) return;
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      await this.auth.login(this.loginForm.value.email, this.loginForm.value.password);
    } catch (err: unknown) {
      this.errorMessage.set(getErrorMessage(err, 'Credenciales inválidas'));
    } finally {
      this.loading.set(false);
    }
  }

  async setup(): Promise<void> {
    if (this.setupForm.invalid) return;
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      await this.auth.setup(
        this.setupForm.value.email,
        this.setupForm.value.password,
        this.setupForm.value.name
      );
    } catch (err: unknown) {
      this.errorMessage.set(getErrorMessage(err, 'No se pudo crear el admin'));
    } finally {
      this.loading.set(false);
    }
  }
}
