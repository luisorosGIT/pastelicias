import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AuthService } from '../../core/services/auth.service';
import { homePathForRole } from '../../core/utils/home-path';

/**
 * Página pública /. Marketing para pastelerías que aún no se registraron.
 * Si el usuario ya está autenticado, redirige automáticamente a su home.
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="landing">
      <!-- Nav -->
      <nav class="nav">
        <div class="nav-brand">
          <div class="nav-logo">P</div>
          <span>Pastelicias</span>
        </div>
        <div class="nav-actions">
          <a routerLink="/pricing" class="nav-link">Planes</a>
          <a routerLink="/auth/login" class="nav-link">Iniciar sesión</a>
          <a routerLink="/auth/signup" mat-flat-button color="primary" class="nav-cta">
            Crear cuenta gratis
          </a>
        </div>
      </nav>

      <!-- Hero -->
      <section class="hero">
        <div class="hero-content">
          <span class="hero-tag">SaaS para pastelerías y panaderías</span>
          <h1>El POS que entiende cómo<br/><span class="hero-accent">trabaja tu pastelería</span></h1>
          <p class="hero-sub">
            Inventario por insumo, recetas con BOM, control de mermas,
            ventas en POS y reportes claros. Todo en una sola app, sin instalar nada.
          </p>
          <div class="hero-actions">
            <a routerLink="/auth/signup" mat-flat-button color="primary" class="hero-cta">
              <mat-icon>rocket_launch</mat-icon>
              <span>Crear cuenta gratis</span>
            </a>
            <a routerLink="/auth/login" mat-stroked-button class="hero-secondary">
              Ya tengo cuenta
            </a>
          </div>
          <p class="hero-note">
            <mat-icon>check_circle</mat-icon> Sin tarjeta de crédito ·
            <mat-icon>check_circle</mat-icon> Empieza en 2 minutos ·
            <mat-icon>check_circle</mat-icon> Cancela cuando quieras
          </p>
        </div>

        <!-- Mockup decorativo -->
        <div class="hero-mockup">
          <div class="mockup-card">
            <div class="mockup-row">
              <span class="mockup-label">VENTAS HOY</span>
              <strong class="mockup-value">S/ 1,245.50</strong>
            </div>
            <div class="mockup-bar"><div class="mockup-fill" style="width: 78%"></div></div>
            <div class="mockup-mini">
              <div><span>Tortas</span><strong>S/ 720</strong></div>
              <div><span>Panes</span><strong>S/ 320</strong></div>
              <div><span>Bebidas</span><strong>S/ 205</strong></div>
            </div>
          </div>
        </div>
      </section>

      <!-- Features -->
      <section class="features">
        <h2>Todo lo que tu pastelería necesita</h2>
        <div class="features-grid">
          <div class="feature">
            <div class="feature-icon"><mat-icon>inventory_2</mat-icon></div>
            <h3>Inventario inteligente</h3>
            <p>Controla insumos con CPP automático, conteos físicos y alertas de stock crítico.</p>
          </div>
          <div class="feature">
            <div class="feature-icon"><mat-icon>menu_book</mat-icon></div>
            <h3>Recetas con BOM</h3>
            <p>Define ingredientes por producto, calcula costos reales y márgenes en vivo.</p>
          </div>
          <div class="feature">
            <div class="feature-icon"><mat-icon>point_of_sale</mat-icon></div>
            <h3>POS rápido</h3>
            <p>Vende en segundos. Imprime tickets térmicos. Acepta efectivo, tarjeta y Yape/Plin.</p>
          </div>
          <div class="feature">
            <div class="feature-icon"><mat-icon>warning_amber</mat-icon></div>
            <h3>Control de mermas</h3>
            <p>Registra desperdicio, mide variación invisible y baja tus costos ocultos.</p>
          </div>
          <div class="feature">
            <div class="feature-icon"><mat-icon>insights</mat-icon></div>
            <h3>Reportes claros</h3>
            <p>Hora pico, día pico, top productos, tendencia de costos. Decisiones con data.</p>
          </div>
          <div class="feature">
            <div class="feature-icon"><mat-icon>store</mat-icon></div>
            <h3>Multi-sucursal</h3>
            <p>Maneja varias tiendas desde una sola cuenta. Compara desempeño en tiempo real.</p>
          </div>
        </div>
      </section>

      <!-- Final CTA -->
      <section class="cta-final">
        <h2>Empieza hoy en menos de 2 minutos</h2>
        <p>Sin tarjeta. Sin instalación. Sin contratos.</p>
        <a routerLink="/auth/signup" mat-flat-button color="primary" class="hero-cta">
          <mat-icon>rocket_launch</mat-icon>
          <span>Crear cuenta gratis</span>
        </a>
      </section>

      <!-- Footer -->
      <footer class="footer">
        <p>© {{ year }} Pastelicias · Hecho en Perú 🇵🇪</p>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; background: #fff; }
    .landing { color: #0b1c30; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }

    /* ─── Nav ─── */
    .nav {
      display: flex; justify-content: space-between; align-items: center;
      padding: 20px 48px;
      max-width: 1280px; margin: 0 auto;
    }
    @media (max-width: 700px) { .nav { padding: 16px 20px; } }
    .nav-brand { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 18px; color: #4648d4; }
    .nav-logo {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #4648d4 0%, #645efb 100%);
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 18px;
    }
    .nav-actions { display: flex; align-items: center; gap: 16px; }
    .nav-link { color: #475569; font-weight: 600; text-decoration: none; font-size: 14px; }
    .nav-link:hover { color: #4648d4; }
    .nav-cta { font-weight: 700 !important; }

    /* ─── Hero ─── */
    .hero {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 60px;
      align-items: center;
      max-width: 1280px;
      margin: 0 auto;
      padding: 60px 48px 80px 48px;
    }
    @media (max-width: 900px) {
      .hero { grid-template-columns: 1fr; padding: 40px 20px; gap: 40px; }
      .hero-mockup { order: -1; }
    }
    .hero-tag {
      display: inline-block;
      padding: 6px 14px;
      background: #eef2ff;
      color: #4648d4;
      border-radius: 100px;
      font-size: 12px; font-weight: 700;
      letter-spacing: 0.05em; text-transform: uppercase;
      margin-bottom: 20px;
    }
    .hero h1 {
      font-size: clamp(32px, 5vw, 56px);
      line-height: 1.05;
      font-weight: 800;
      letter-spacing: -0.03em;
      margin: 0 0 20px 0;
      color: #0b1c30;
    }
    .hero-accent {
      background: linear-gradient(135deg, #4648d4 0%, #645efb 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero-sub {
      font-size: 17px; line-height: 1.6;
      color: #475569; max-width: 560px;
      margin: 0 0 28px 0;
    }
    .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .hero-cta {
      height: 52px !important;
      padding: 0 28px !important;
      font-size: 15px !important;
      font-weight: 700 !important;
      display: flex !important;
      align-items: center; gap: 8px;
      box-shadow: 0 8px 24px -6px rgba(70, 72, 212, 0.5) !important;
    }
    .hero-secondary {
      height: 52px !important;
      padding: 0 28px !important;
      font-size: 15px !important;
      font-weight: 600 !important;
    }
    .hero-note {
      display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
      font-size: 13px; color: #64748B;
      margin: 8px 0 0 0;
    }
    .hero-note mat-icon { font-size: 14px; width: 14px; height: 14px; color: #10b981; }

    /* Mockup */
    .hero-mockup {
      display: flex;
      justify-content: center;
      align-items: center;
      perspective: 1000px;
    }
    .mockup-card {
      width: 100%;
      max-width: 380px;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 24px 60px -16px rgba(70, 72, 212, 0.25),
                  0 0 0 1px rgba(70, 72, 212, 0.06);
      padding: 28px;
      transform: rotateY(-6deg) rotateX(4deg);
      animation: float 6s ease-in-out infinite;
    }
    @keyframes float {
      0%, 100% { transform: rotateY(-6deg) rotateX(4deg) translateY(0); }
      50%      { transform: rotateY(-6deg) rotateX(4deg) translateY(-12px); }
    }
    .mockup-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .mockup-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #94a3b8; }
    .mockup-value { font-size: 28px; font-weight: 800; color: #0b1c30; }
    .mockup-bar { height: 8px; background: #eef2ff; border-radius: 4px; overflow: hidden; margin-bottom: 20px; }
    .mockup-fill { height: 100%; background: linear-gradient(90deg, #4648d4, #645efb); border-radius: 4px; }
    .mockup-mini { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .mockup-mini > div {
      padding: 12px; background: #f8fafc; border-radius: 10px; text-align: center;
    }
    .mockup-mini span { display: block; font-size: 11px; color: #64748b; margin-bottom: 4px; }
    .mockup-mini strong { font-size: 14px; color: #0b1c30; }

    /* ─── Features ─── */
    .features {
      max-width: 1280px; margin: 0 auto;
      padding: 80px 48px;
    }
    @media (max-width: 700px) { .features { padding: 60px 20px; } }
    .features h2 {
      text-align: center;
      font-size: clamp(28px, 4vw, 40px);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 48px 0;
      color: #0b1c30;
    }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
    }
    .feature {
      padding: 28px 24px;
      background: #f8fafc;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .feature:hover {
      transform: translateY(-4px);
      box-shadow: 0 12px 24px -8px rgba(70, 72, 212, 0.15);
      border-color: #c7d2fe;
    }
    .feature-icon {
      width: 48px; height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #eef2ff, #e0e7ff);
      color: #4648d4;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 16px;
    }
    .feature-icon mat-icon { font-size: 24px; width: 24px; height: 24px; }
    .feature h3 { margin: 0 0 8px 0; font-size: 17px; font-weight: 700; color: #0b1c30; }
    .feature p { margin: 0; font-size: 14px; color: #64748b; line-height: 1.55; }

    /* ─── CTA final ─── */
    .cta-final {
      max-width: 1280px;
      margin: 0 auto;
      padding: 80px 48px;
      text-align: center;
      background:
        radial-gradient(at 50% 100%, rgba(70, 72, 212, 0.06) 0px, transparent 60%);
    }
    .cta-final h2 {
      font-size: clamp(28px, 4vw, 40px);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 12px 0;
      color: #0b1c30;
    }
    .cta-final p { font-size: 16px; color: #64748b; margin: 0 0 28px 0; }

    /* ─── Footer ─── */
    .footer {
      padding: 32px 48px;
      text-align: center;
      border-top: 1px solid #e2e8f0;
      color: #94a3b8;
      font-size: 13px;
    }
    .footer p { margin: 0; }
  `],
})
export class LandingComponent implements OnInit {
  year = new Date().getFullYear();

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    // Si ya está logueado, no mostrar landing — ir a su home (o al onboarding)
    if (this.authService.isAuthenticated()) {
      const user = this.authService.user();
      if (!user) return;
      if (user.role === 'OWNER' && !this.authService.onboardingCompleted()) {
        this.router.navigate(['/onboarding']);
      } else {
        this.router.navigate([homePathForRole(user.role)]);
      }
    }
  }
}
