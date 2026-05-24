import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { homePathForRole } from '../../core/utils/home-path';

/**
 * Página 404 amigable. Es la última ruta del router (path: '**'), captura
 * cualquier URL no reconocida. Ofrece volver al home apropiado según si el
 * usuario está autenticado o no.
 */
@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="page-404">
      <div class="card">
        <div class="illustration">
          <span class="big-4">4</span>
          <div class="donut">
            <div class="donut-hole"></div>
            <div class="sprinkle s1"></div>
            <div class="sprinkle s2"></div>
            <div class="sprinkle s3"></div>
            <div class="sprinkle s4"></div>
          </div>
          <span class="big-4">4</span>
        </div>

        <h1>Esta página se nos quemó en el horno 🔥</h1>
        <p class="sub">
          No encontramos lo que buscas. Quizás cambiaste de dirección o el link
          ya no existe.
        </p>

        <div class="actions">
          <button mat-flat-button color="primary" class="primary-cta" (click)="goHome()">
            <mat-icon>home</mat-icon>
            <span>{{ isAuth ? 'Volver al panel' : 'Ir al inicio' }}</span>
          </button>
          <button mat-stroked-button (click)="goBack()">
            <mat-icon>arrow_back</mat-icon>
            <span>Página anterior</span>
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; min-height: 100vh; }
    .page-404 {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background:
        radial-gradient(at 20% 30%, rgba(70, 72, 212, 0.10) 0px, transparent 50%),
        radial-gradient(at 80% 70%, rgba(100, 94, 251, 0.08) 0px, transparent 50%),
        #f8f9ff;
    }
    .card {
      max-width: 520px;
      padding: 48px 32px;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 24px 60px -16px rgba(70, 72, 212, 0.15);
      text-align: center;
    }
    @media (max-width: 540px) { .card { padding: 32px 20px; } }

    .illustration {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
      margin-bottom: 24px;
      font-family: 'Plus Jakarta Sans', sans-serif;
    }
    .big-4 {
      font-size: 96px;
      font-weight: 900;
      line-height: 1;
      letter-spacing: -0.04em;
      background: linear-gradient(135deg, #4648d4 0%, #645efb 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    @media (max-width: 540px) { .big-4 { font-size: 72px; } }

    /* Donut decorativo en el medio (reemplazando el 0) */
    .donut {
      position: relative;
      width: 96px;
      height: 96px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f59e0b 0%, #ec4899 50%, #4648d4 100%);
      animation: spin 8s linear infinite;
    }
    @media (max-width: 540px) { .donut { width: 72px; height: 72px; } }
    .donut-hole {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 38%;
      height: 38%;
      border-radius: 50%;
      background: #fff;
    }
    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    .sprinkle {
      position: absolute;
      width: 8px; height: 3px;
      border-radius: 2px;
      background: #fff;
    }
    .s1 { top: 12%; left: 50%; transform: rotate(15deg); }
    .s2 { top: 30%; right: 8%; transform: rotate(-25deg); background: #FCD34D; }
    .s3 { bottom: 14%; left: 18%; transform: rotate(35deg); background: #34D399; }
    .s4 { bottom: 20%; right: 22%; transform: rotate(-15deg); background: #F472B6; }

    h1 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.01em;
      color: #0b1c30;
      margin: 0 0 12px 0;
    }
    .sub {
      font-size: 14px;
      color: #64748b;
      line-height: 1.6;
      margin: 0 0 28px 0;
    }
    .actions {
      display: flex;
      justify-content: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .actions button {
      height: 44px;
      display: inline-flex !important;
      align-items: center;
      gap: 6px;
    }
    .primary-cta { font-weight: 700 !important; }
  `],
})
export class NotFoundComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  isAuth = this.authService.isAuthenticated();

  goHome(): void {
    if (this.authService.isAuthenticated()) {
      const role = this.authService.role();
      this.router.navigateByUrl(homePathForRole(role), { replaceUrl: true });
    } else {
      this.router.navigateByUrl('/', { replaceUrl: true });
    }
  }

  goBack(): void {
    if (window.history.length > 1) {
      window.history.back();
    } else {
      this.goHome();
    }
  }
}
