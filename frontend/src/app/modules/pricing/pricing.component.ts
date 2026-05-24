import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

/**
 * Página PÚBLICA /pricing — visible sin autenticación. Marketing comparativo
 * de los 3 planes (Gratis / Pro / Business).
 *
 * Los datos están hardcodeados acá (no consume API) para que cargue rápido
 * y sin pegarle al backend. Si los precios/límites cambian en
 * backend/src/config/plans.ts hay que actualizarlos también acá.
 *
 * Distinta de /app/upgrade que es la interna (autenticada) y permite cambiar
 * de plan. Esta solo muestra info y manda al signup.
 */
interface PublicPlan {
  code: 'FREE' | 'PRO' | 'BUSINESS';
  label: string;
  tagline: string;
  priceMonthlyPen: number;
  priceNote: string;
  highlighted?: boolean;
  features: string[];
  ctaLabel: string;
  ctaIcon: string;
}

const PLANS: PublicPlan[] = [
  {
    code: 'FREE',
    label: 'Gratis',
    tagline: 'Para empezar y probar la plataforma sin compromiso.',
    priceMonthlyPen: 0,
    priceNote: '30 días de prueba',
    features: [
      '1 sucursal',
      'Hasta 30 insumos',
      'Hasta 30 productos',
      '1 usuario',
      'POS + inventario + recetas',
      'Reportes básicos',
    ],
    ctaLabel: 'Empezar gratis',
    ctaIcon: 'rocket_launch',
  },
  {
    code: 'PRO',
    label: 'Pro',
    tagline: 'Para pastelerías que crecen y necesitan más control.',
    priceMonthlyPen: 49,
    priceNote: '/ mes',
    highlighted: true,
    features: [
      'Hasta 3 sucursales',
      'Hasta 200 insumos',
      'Hasta 200 productos',
      'Hasta 5 usuarios',
      'Reportes avanzados',
      'Tickets personalizados',
      'Soporte por chat',
    ],
    ctaLabel: 'Empezar prueba',
    ctaIcon: 'auto_awesome',
  },
  {
    code: 'BUSINESS',
    label: 'Business',
    tagline: 'Para cadenas con varias tiendas y catálogos grandes.',
    priceMonthlyPen: 149,
    priceNote: '/ mes',
    features: [
      'Sucursales ilimitadas',
      'Insumos ilimitados',
      'Productos ilimitados',
      'Usuarios ilimitados',
      'Reportes avanzados + comparativo',
      'Soporte prioritario',
      'Onboarding asistido',
    ],
    ctaLabel: 'Empezar prueba',
    ctaIcon: 'workspace_premium',
  },
];

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [RouterLink, MatButtonModule, MatIconModule],
  template: `
    <div class="pricing">
      <!-- Nav -->
      <nav class="nav">
        <a routerLink="/" class="nav-brand">
          <div class="nav-logo">P</div>
          <span>Pastelicias</span>
        </a>
        <div class="nav-actions">
          <a routerLink="/" class="nav-link">Inicio</a>
          <a routerLink="/auth/login" class="nav-link">Iniciar sesión</a>
          <a routerLink="/auth/signup" mat-flat-button color="primary" class="nav-cta">
            Crear cuenta gratis
          </a>
        </div>
      </nav>

      <!-- Header -->
      <section class="hero">
        <span class="hero-tag">PLANES Y PRECIOS</span>
        <h1>Elige el plan ideal para tu pastelería</h1>
        <p class="hero-sub">
          Empieza gratis con 30 días de prueba. Sin tarjeta, sin contratos.
          Mejora cuando lo necesites — y bájate cuando quieras.
        </p>
      </section>

      <!-- Plans grid -->
      <section class="plans-section">
        <div class="plans-grid">
          @for (plan of plans; track plan.code) {
            <article class="plan-card" [class.highlighted]="plan.highlighted">
              @if (plan.highlighted) {
                <span class="plan-tag">MÁS POPULAR</span>
              }
              <header class="plan-header">
                <h2 class="plan-name">{{ plan.label }}</h2>
                <p class="plan-tagline">{{ plan.tagline }}</p>
              </header>

              <div class="plan-price">
                <span class="plan-currency">S/</span>
                <strong>{{ plan.priceMonthlyPen }}</strong>
                <span class="plan-note">{{ plan.priceNote }}</span>
              </div>

              <ul class="plan-features">
                @for (feat of plan.features; track feat) {
                  <li>
                    <mat-icon>check_circle</mat-icon>
                    <span>{{ feat }}</span>
                  </li>
                }
              </ul>

              <a routerLink="/auth/signup"
                 class="plan-cta"
                 [class.cta-primary]="plan.highlighted">
                <mat-icon>{{ plan.ctaIcon }}</mat-icon>
                <span>{{ plan.ctaLabel }}</span>
              </a>
            </article>
          }
        </div>

        <p class="disclaimer">
          <mat-icon>info</mat-icon>
          <span>
            Todos los planes incluyen 30 días gratis para probar Pastelicias.
            No te cobramos hasta que tú elijas un plan pagado. Los precios están
            en soles peruanos (PEN) e incluyen IGV.
          </span>
        </p>
      </section>

      <!-- FAQ -->
      <section class="faq">
        <h2>Preguntas frecuentes</h2>
        <div class="faq-grid">
          <div class="faq-item">
            <h3>¿Cómo funciona la prueba de 30 días?</h3>
            <p>
              Te registras gratis y obtienes 30 días para usar todas las
              funciones del plan Gratis. Al terminar, te pediremos elegir un
              plan para seguir creando ventas, insumos, etc. (siempre podrás ver
              lo que ya creaste).
            </p>
          </div>
          <div class="faq-item">
            <h3>¿Necesito tarjeta de crédito para empezar?</h3>
            <p>
              No. La prueba es 100% sin tarjeta. Solo te pedimos datos de pago
              cuando decidas pasar al plan Pro o Business.
            </p>
          </div>
          <div class="faq-item">
            <h3>¿Puedo cambiar de plan después?</h3>
            <p>
              Sí, en cualquier momento. Mejora o baja de plan desde
              Configuración → Plan. Los cambios aplican al instante.
            </p>
          </div>
          <div class="faq-item">
            <h3>¿Qué pasa con mis datos si bajo de plan o cancelo?</h3>
            <p>
              Tus datos siguen intactos por al menos 90 días. Si vuelves antes
              de ese plazo, los recuperas tal cual los dejaste.
            </p>
          </div>
          <div class="faq-item">
            <h3>¿Aceptan Yape, Plin o tarjeta?</h3>
            <p>
              Pronto. Estamos integrando Culqi (tarjeta) y Yape para suscripciones.
              Por ahora la app está en beta y los cambios de plan son gratuitos.
            </p>
          </div>
          <div class="faq-item">
            <h3>¿Sirve para panaderías y cafés también?</h3>
            <p>
              Sí. El modelo de insumos + recetas + POS funciona para cualquier
              negocio de comida: pastelerías, panaderías, cafés, dulcerías y
              chocolaterías.
            </p>
          </div>
        </div>
      </section>

      <!-- Final CTA -->
      <section class="cta-final">
        <h2>¿Listo para empezar?</h2>
        <p>30 días gratis. Sin tarjeta. Sin instalación.</p>
        <a routerLink="/auth/signup" mat-flat-button color="primary" class="cta-button">
          <mat-icon>rocket_launch</mat-icon>
          <span>Crear cuenta gratis</span>
        </a>
      </section>

      <!-- Footer -->
      <footer class="footer">
        <p>© {{ year }} Pastelicias · Hecho en Perú</p>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; background: #fff; }
    .pricing { color: #0b1c30; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }

    /* ─── Nav ─── */
    .nav {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px 24px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .nav-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 800;
      letter-spacing: -0.01em;
      color: #0b1c30;
      text-decoration: none;
    }
    .nav-logo {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      background: linear-gradient(135deg, #4648d4, #645efb);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
    }
    .nav-actions { display: flex; align-items: center; gap: 16px; }
    .nav-link {
      color: #475569;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
    }
    .nav-link:hover { color: #4648d4; }
    .nav-cta { font-weight: 700 !important; }

    /* ─── Hero ─── */
    .hero {
      max-width: 800px;
      margin: 60px auto 40px;
      padding: 0 24px;
      text-align: center;
    }
    .hero-tag {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 100px;
      background: #eef2ff;
      color: #4648d4;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.06em;
      margin-bottom: 20px;
    }
    .hero h1 {
      font-size: clamp(32px, 5vw, 52px);
      font-weight: 800;
      letter-spacing: -0.025em;
      line-height: 1.1;
      margin: 0 0 16px 0;
    }
    .hero-sub {
      font-size: 17px;
      color: #475569;
      line-height: 1.6;
      max-width: 560px;
      margin: 0 auto;
    }

    /* ─── Plans grid ─── */
    .plans-section {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 24px 80px;
    }
    .plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
    }
    .plan-card {
      position: relative;
      padding: 36px 28px 28px;
      background: #fff;
      border: 2px solid #e2e8f0;
      border-radius: 24px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .plan-card:hover {
      transform: translateY(-6px);
      box-shadow: 0 20px 40px -12px rgba(70, 72, 212, 0.15);
    }
    .plan-card.highlighted {
      border-color: #4648d4;
      box-shadow: 0 16px 32px -8px rgba(70, 72, 212, 0.25);
    }
    .plan-tag {
      position: absolute;
      top: -14px;
      left: 50%;
      transform: translateX(-50%);
      padding: 5px 16px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      background: linear-gradient(135deg, #4648d4, #645efb);
      color: #fff;
      white-space: nowrap;
    }
    .plan-header h2 {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.01em;
      margin: 0 0 6px 0;
    }
    .plan-tagline {
      color: #64748b;
      font-size: 14px;
      line-height: 1.5;
      margin: 0;
    }

    .plan-price {
      display: flex;
      align-items: baseline;
      gap: 4px;
      padding: 8px 0 16px;
      border-bottom: 1px solid #f1f5f9;
    }
    .plan-currency { font-size: 18px; font-weight: 700; color: #64748b; }
    .plan-price strong { font-size: 44px; font-weight: 800; letter-spacing: -0.025em; }
    .plan-note { color: #94a3b8; font-size: 14px; margin-left: 6px; }

    .plan-features {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
      flex: 1;
    }
    .plan-features li {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      color: #334155;
      font-size: 14.5px;
      line-height: 1.5;
    }
    .plan-features mat-icon {
      color: #10b981;
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    .plan-cta {
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 48px;
      border-radius: 12px;
      font-weight: 700;
      font-size: 14.5px;
      text-decoration: none;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
      cursor: pointer;
      background: #fff;
      border: 2px solid #4648d4;
      color: #4648d4;
    }
    .plan-cta.cta-primary {
      background: linear-gradient(135deg, #4648d4, #645efb);
      border-color: transparent;
      color: #fff;
    }
    .plan-cta:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(70, 72, 212, 0.2);
    }
    .plan-cta mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .disclaimer {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      max-width: 720px;
      margin: 40px auto 0;
      padding: 16px 20px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      color: #475569;
      font-size: 13.5px;
      line-height: 1.6;
    }
    .disclaimer mat-icon { color: #4648d4; flex-shrink: 0; }

    /* ─── FAQ ─── */
    .faq {
      max-width: 1100px;
      margin: 0 auto;
      padding: 40px 24px 80px;
    }
    .faq h2 {
      text-align: center;
      font-size: clamp(26px, 3vw, 34px);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 40px 0;
    }
    .faq-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 24px;
    }
    .faq-item {
      padding: 20px;
      background: #f8fafc;
      border-radius: 16px;
    }
    .faq-item h3 {
      font-size: 16px;
      font-weight: 700;
      margin: 0 0 8px 0;
      color: #0b1c30;
    }
    .faq-item p {
      font-size: 14.5px;
      color: #475569;
      line-height: 1.6;
      margin: 0;
    }

    /* ─── Final CTA ─── */
    .cta-final {
      background: linear-gradient(135deg, #4648d4 0%, #645efb 100%);
      color: #fff;
      padding: 60px 24px;
      text-align: center;
    }
    .cta-final h2 {
      font-size: clamp(28px, 3.5vw, 38px);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 12px 0;
    }
    .cta-final p {
      font-size: 16px;
      opacity: 0.9;
      margin: 0 0 28px 0;
    }
    .cta-button {
      display: inline-flex !important;
      align-items: center;
      gap: 8px;
      padding: 0 28px !important;
      height: 52px !important;
      font-size: 15px !important;
      font-weight: 700 !important;
      background: #fff !important;
      color: #4648d4 !important;
      border-radius: 12px !important;
    }
    .cta-button mat-icon { font-size: 20px; width: 20px; height: 20px; }

    /* ─── Footer ─── */
    .footer {
      text-align: center;
      padding: 30px 24px;
      color: #94a3b8;
      font-size: 14px;
      border-top: 1px solid #f1f5f9;
    }

    /* Mobile */
    @media (max-width: 640px) {
      .nav { padding: 16px; }
      .nav-actions { gap: 10px; }
      .nav-link:not(.nav-cta) { display: none; }
      .nav-cta { padding: 0 14px !important; font-size: 13px !important; }
      .plan-card { padding: 28px 22px 22px; }
    }
  `],
})
export class PricingComponent {
  plans = PLANS;
  year = new Date().getFullYear();
}
