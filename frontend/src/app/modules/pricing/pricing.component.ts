import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

/**
 * Página PÚBLICA /pricing — adaptación fiel del diseño Figma.
 * Estructura simple:
 *  - Navbar fixed
 *  - Hero centrado
 *  - 3 cards de planes (Pro destacado)
 *  - Card de info con HelpCircle
 *  - FAQ accordion (5 preguntas)
 *  - CTA gradient morado
 *  - Footer oscuro
 *
 * Los datos están hardcodeados acá; si los precios/límites cambian en
 * backend/src/config/plans.ts hay que actualizarlos también acá.
 */
interface PublicPlan {
  code: 'FREE' | 'PRO' | 'BUSINESS';
  name: string;
  description: string;
  price: number;
  period: string;
  features: string[];
  cta: string;
  popular: boolean;
  icon: string;
  gradient: string;
}

const PLANS: PublicPlan[] = [
  {
    code: 'FREE',
    name: 'Gratis',
    description: 'Para empezar y probar la plataforma sin compromiso',
    price: 0,
    period: '30 días de prueba',
    features: [
      '1 sucursal',
      'Hasta 30 insumos',
      'Hasta 30 productos',
      '1 usuario',
      'POS + inventario + recetas',
      'Reportes básicos',
    ],
    cta: 'Empezar gratis',
    popular: false,
    icon: 'auto_awesome',
    gradient: 'linear-gradient(135deg, #6b7280, #4b5563)',
  },
  {
    code: 'PRO',
    name: 'Pro',
    description: 'Para pastelerías que necesitan crecer y escalar más rápido',
    price: 49,
    period: '/mes',
    features: [
      'Hasta 3 sucursales',
      'Hasta 200 insumos',
      'Hasta 200 productos',
      'Hasta 5 usuarios',
      'Reportes avanzados',
      'Tickets personalizados',
      'Soporte por chat',
    ],
    cta: 'Empezar prueba',
    popular: true,
    icon: 'bolt',
    gradient: 'linear-gradient(135deg, #4f46e5, #9333ea)',
  },
  {
    code: 'BUSINESS',
    name: 'Business',
    description: 'Para cadenas con varias tiendas y catálogos grandes',
    price: 149,
    period: '/mes',
    features: [
      'Sucursales ilimitadas',
      'Insumos ilimitados',
      'Productos ilimitados',
      'Usuarios ilimitados',
      'Reportes avanzados + comparativo',
      'Soporte prioritario',
      'Onboarding asistido',
    ],
    cta: 'Empezar prueba',
    popular: false,
    icon: 'apartment',
    gradient: 'linear-gradient(135deg, #9333ea, #ec4899)',
  },
];

@Component({
  selector: 'app-pricing',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  template: `
    <div class="pricing">
      <!-- Navbar -->
      <nav class="navbar">
        <div class="navbar-inner">
          <a routerLink="/" class="nav-brand">
            <img src="assets/branding/logo.png" alt="Genimatech" class="nav-logo-img" />
            <span class="nav-name">Genimatech</span>
          </a>
          <div class="nav-menu">
            <a routerLink="/" class="nav-link">Inicio</a>
            <a routerLink="/pricing" class="nav-link active">Planes</a>
            <a routerLink="/auth/login" class="nav-link">Iniciar sesión</a>
            <a routerLink="/auth/signup" class="nav-cta">Crear cuenta gratis</a>
          </div>
        </div>
      </nav>

      <!-- Hero -->
      <section class="hero fade-up">
        <span class="badge">
          <mat-icon class="badge-icon">rocket_launch</mat-icon>
          PLANES Y PRECIOS
        </span>
        <h1 class="hero-title">
          Elige el plan ideal para tu
          <span class="gradient-text">pastelería</span>
        </h1>
        <p class="hero-sub">
          Empieza gratis con 30 días de prueba. Sin tarjeta, sin contratos.
        </p>
        <p class="hero-sub-secondary">
          Mejora cuando lo necesites → y bájate cuando quieras.
        </p>
      </section>

      <!-- Plans -->
      <section class="plans-section">
        <div class="plans-grid">
          @for (plan of plans; track plan.code; let i = $index) {
            <article class="plan-card fade-up"
                     [class.popular]="plan.popular"
                     [style.animation-delay.ms]="i * 100">
              @if (plan.popular) {
                <span class="plan-badge" [style.background]="plan.gradient">MÁS POPULAR</span>
              }
              <div class="plan-icon" [style.background]="plan.gradient">
                <mat-icon>{{ plan.icon }}</mat-icon>
              </div>
              <h3 class="plan-name">{{ plan.name }}</h3>
              <p class="plan-description">{{ plan.description }}</p>
              <div class="plan-price">
                <span class="plan-currency">S/</span>
                <span class="plan-amount">{{ plan.price }}</span>
                <span class="plan-period">{{ plan.period }}</span>
              </div>
              <a routerLink="/auth/signup"
                 class="plan-cta"
                 [class.cta-primary]="plan.popular"
                 [style.background]="plan.popular ? plan.gradient : ''">
                <mat-icon>bolt</mat-icon>
                <span>{{ plan.cta }}</span>
              </a>
              <ul class="plan-features">
                @for (feat of plan.features; track feat) {
                  <li>
                    <mat-icon class="check-icon">check</mat-icon>
                    <span>{{ feat }}</span>
                  </li>
                }
              </ul>
            </article>
          }
        </div>

        <!-- Info note -->
        <div class="info-note fade-up">
          <mat-icon class="info-icon">help_outline</mat-icon>
          <p>
            <strong>Todos los planes incluyen 30 días gratis para probar Genimatech.</strong>
            No te cobramos hasta que tú elijas un plan pagado
            <span class="info-highlight">(precios en soles peruanos incluyen IGV)</span>.
          </p>
        </div>
      </section>

      <!-- FAQ -->
      <section class="faq-section">
        <div class="section-header fade-up">
          <h2 class="section-title">Preguntas frecuentes</h2>
          <p class="section-sub">Todo lo que necesitas saber sobre nuestros planes.</p>
        </div>
        <div class="faq-list fade-up">
          @for (faq of faqs; track faq.q; let i = $index) {
            <details class="faq-item">
              <summary>
                <span>{{ faq.q }}</span>
                <mat-icon class="faq-arrow">expand_more</mat-icon>
              </summary>
              <p>{{ faq.a }}</p>
            </details>
          }
        </div>
      </section>

      <!-- CTA final -->
      <section class="cta-final">
        <div class="cta-pattern"></div>
        <div class="cta-content fade-up">
          <h2>Empieza a controlar tu pastelería hoy</h2>
          <p>Únete a cientos de pastelerías que ya están optimizando sus costos y aumentando sus ganancias.</p>
          <a routerLink="/auth/signup" class="btn-light">Crear cuenta gratis</a>
          <p class="cta-fineprint">30 días de prueba · Sin tarjeta de crédito · Cancela cuando quieras</p>
        </div>
      </section>

      <!-- Footer 4 columnas -->
      <footer class="footer">
        <div class="footer-grid">
          <div class="footer-col footer-brand">
            <div class="footer-brand-row">
              <img src="assets/branding/logo.png" alt="Genimatech" class="footer-logo" />
              <strong>Genimatech</strong>
            </div>
            <p class="footer-tagline">
              Software de gestión especializado para pastelerías, panaderías y dulcerías.
            </p>
          </div>

          <div class="footer-col">
            <h4>Producto</h4>
            <a routerLink="/pricing">Precios</a>
            <a routerLink="/">Funcionalidades</a>
          </div>

          <div class="footer-col">
            <h4>Empresa</h4>
            <a (click)="comingSoon('Sobre nosotros')">Sobre nosotros</a>
            <a (click)="comingSoon('Contacto')">Contacto</a>
          </div>

          <div class="footer-col">
            <h4>Legal</h4>
            <a (click)="comingSoon('Términos de Servicio')">Términos de Servicio</a>
            <a (click)="comingSoon('Política de Privacidad')">Política de Privacidad</a>
          </div>
        </div>

        <div class="footer-bottom">
          <p>© {{ year }} Genimatech. Todos los derechos reservados.</p>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; background: #fff; }
    .pricing {
      color: #0f172a;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      background: linear-gradient(180deg, #f9fafb 0%, #fff 30%, #eef2ff 100%);
      min-height: 100vh;
    }

    /* ─── Animations ─── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .fade-up { animation: fadeUp 0.6s ease-out both; }

    /* ─── Navbar (igual a Landing) ─── */
    .navbar {
      position: fixed; top: 0; left: 0; right: 0; z-index: 50;
      background: rgba(255, 255, 255, 0.8);
      backdrop-filter: blur(16px) saturate(160%);
      -webkit-backdrop-filter: blur(16px) saturate(160%);
      border-bottom: 1px solid #e5e7eb;
    }
    .navbar-inner {
      max-width: 1280px; margin: 0 auto;
      padding: 0 24px;
      height: 64px;
      display: flex; align-items: center; justify-content: space-between;
    }
    .nav-brand {
      display: flex; align-items: center; gap: 10px;
      text-decoration: none;
    }
    .nav-logo-img {
      width: 40px; height: 40px; border-radius: 12px;
      display: block;
      object-fit: cover;
      transition: transform 0.2s ease;
    }
    .nav-brand:hover .nav-logo-img { transform: scale(1.1); }
    .nav-name {
      font-size: 22px; font-weight: 800; letter-spacing: -0.02em;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .nav-menu { display: flex; align-items: center; gap: 32px; }
    .nav-link {
      color: #475569; font-size: 15px; font-weight: 500;
      text-decoration: none;
      transition: color 0.15s ease;
    }
    .nav-link:hover, .nav-link.active { color: #4f46e5; }
    .nav-link.active { font-weight: 600; }
    .nav-cta {
      display: inline-flex; align-items: center;
      padding: 0 18px; height: 40px;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
      border-radius: 10px;
      font-size: 14.5px; font-weight: 600;
      text-decoration: none;
      transition: opacity 0.2s ease, transform 0.2s ease;
    }
    .nav-cta:hover {
      opacity: 0.92;
      transform: translateY(-1px);
    }
    @media (max-width: 880px) {
      .nav-menu .nav-link { display: none; }
    }

    .gradient-text {
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }

    /* ─── Hero ─── */
    .hero {
      max-width: 1280px;
      margin: 0 auto;
      padding: 112px 24px 48px;
      text-align: center;
    }
    .badge {
      display: inline-flex; align-items: center; gap: 6px;
      padding: 6px 14px;
      background: #eef2ff;
      color: #4338ca;
      border: 1px solid #c7d2fe;
      border-radius: 100px;
      font-size: 12px; font-weight: 700;
      letter-spacing: 0.04em;
      margin-bottom: 16px;
    }
    .badge-icon { font-size: 14px; width: 14px; height: 14px; }
    .hero-title {
      font-size: clamp(40px, 5vw, 60px);
      font-weight: 800;
      letter-spacing: -0.025em;
      line-height: 1.1;
      margin: 0 0 24px 0;
    }
    .hero-sub {
      font-size: 20px;
      color: #475569;
      max-width: 720px;
      margin: 0 auto 8px;
      line-height: 1.55;
    }
    .hero-sub-secondary {
      font-size: 18px;
      color: #6b7280;
      max-width: 720px;
      margin: 0 auto;
    }

    /* ─── Plans ─── */
    .plans-section {
      max-width: 1280px;
      margin: 0 auto;
      padding: 0 24px 80px;
    }
    .plans-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 32px;
      align-items: stretch;
    }
    @media (max-width: 960px) {
      .plans-grid { grid-template-columns: 1fr; gap: 24px; }
    }
    .plan-card {
      position: relative;
      padding: 32px;
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 16px;
      box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.06);
      display: flex;
      flex-direction: column;
    }
    .plan-card.popular {
      border: 2px solid #4f46e5;
      box-shadow: 0 24px 48px -16px rgba(79, 70, 229, 0.3);
      transform: translateY(-16px);
    }
    @media (max-width: 960px) {
      .plan-card.popular { transform: none; }
    }
    .plan-badge {
      position: absolute;
      top: -14px;
      left: 50%;
      transform: translateX(-50%);
      padding: 5px 24px;
      color: #fff;
      border-radius: 100px;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.08em;
      box-shadow: 0 8px 16px -4px rgba(79, 70, 229, 0.4);
    }
    .plan-icon {
      width: 64px; height: 64px;
      border-radius: 16px;
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 16px;
    }
    .plan-icon mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .plan-name {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 8px 0;
    }
    .plan-description {
      font-size: 15px;
      color: #475569;
      line-height: 1.5;
      margin: 0 0 24px 0;
      min-height: 48px;
    }
    .plan-price {
      display: flex; align-items: baseline; gap: 8px;
      margin-bottom: 24px;
    }
    .plan-currency { font-size: 20px; color: #475569; }
    .plan-amount {
      font-size: 56px;
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1;
    }
    .plan-period { color: #6b7280; font-size: 15px; }
    .plan-cta {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      height: 48px;
      background: #fff;
      color: #1f2937;
      border: 2px solid #d1d5db;
      border-radius: 10px;
      font-size: 15px; font-weight: 600;
      text-decoration: none;
      margin-bottom: 24px;
      transition: background 0.2s ease, opacity 0.2s ease, box-shadow 0.2s ease;
    }
    .plan-cta:hover {
      background: #f9fafb;
    }
    .plan-cta.cta-primary {
      color: #fff;
      border: none;
      box-shadow: 0 12px 24px -8px rgba(79, 70, 229, 0.4);
    }
    .plan-cta.cta-primary:hover {
      opacity: 0.92;
    }
    .plan-cta mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .plan-features {
      list-style: none;
      padding: 0;
      margin: 0;
      flex: 1;
      display: flex; flex-direction: column;
      gap: 12px;
    }
    .plan-features li {
      display: flex; align-items: flex-start; gap: 12px;
      color: #1f2937;
      font-size: 15px;
      line-height: 1.5;
    }
    .check-icon {
      color: #16a34a;
      font-size: 20px;
      width: 20px;
      height: 20px;
      flex-shrink: 0;
      margin-top: 1px;
    }

    /* ─── Info note ─── */
    .info-note {
      margin-top: 48px;
      max-width: 900px;
      margin-left: auto;
      margin-right: auto;
      padding: 24px;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-radius: 16px;
      display: flex; align-items: flex-start; gap: 12px;
    }
    .info-icon {
      color: #4f46e5;
      font-size: 22px;
      width: 22px;
      height: 22px;
      flex-shrink: 0;
      margin-top: 2px;
    }
    .info-note p {
      font-size: 15.5px;
      color: #1f2937;
      line-height: 1.55;
      margin: 0;
    }
    .info-highlight { color: #4f46e5; font-weight: 600; }

    /* ─── FAQ ─── */
    .faq-section {
      max-width: 900px;
      margin: 0 auto;
      padding: 80px 24px;
      background: #fff;
    }
    .section-header {
      text-align: center;
      margin-bottom: 48px;
    }
    .section-title {
      font-size: clamp(32px, 4vw, 40px);
      font-weight: 800;
      letter-spacing: -0.025em;
      margin: 0 0 12px 0;
    }
    .section-sub {
      font-size: 18px;
      color: #475569;
      margin: 0;
    }
    .faq-list {
      display: flex; flex-direction: column; gap: 16px;
    }
    .faq-item {
      background: #fff;
      border: 1px solid #e5e7eb;
      border-radius: 12px;
      box-shadow: 0 2px 6px -2px rgba(0, 0, 0, 0.04);
      overflow: hidden;
      transition: box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .faq-item:hover { box-shadow: 0 8px 16px -4px rgba(0, 0, 0, 0.08); }
    .faq-item[open] { border-color: #c7d2fe; }
    .faq-item summary {
      list-style: none;
      cursor: pointer;
      padding: 20px 24px;
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px;
      font-size: 17px;
      font-weight: 600;
    }
    .faq-item summary::-webkit-details-marker { display: none; }
    .faq-arrow {
      color: #9ca3af;
      transition: transform 0.2s ease, color 0.2s ease;
    }
    .faq-item[open] .faq-arrow {
      transform: rotate(180deg);
      color: #4f46e5;
    }
    .faq-item p {
      padding: 0 24px 20px;
      margin: 0;
      font-size: 15.5px;
      color: #475569;
      line-height: 1.6;
    }

    /* ─── CTA final ─── */
    .cta-final {
      position: relative;
      padding: 96px 24px;
      background: linear-gradient(135deg, #8b5cf6 0%, #a855f7 40%, #ec4899 100%);
      color: #fff;
      text-align: center;
      overflow: hidden;
    }
    .cta-pattern {
      position: absolute;
      inset: 0;
      background-image:
        linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px);
      background-size: 60px 60px;
      opacity: 0.5;
      pointer-events: none;
    }
    .cta-content {
      position: relative;
      z-index: 1;
      max-width: 800px;
      margin: 0 auto;
    }
    .cta-final h2 {
      font-size: clamp(32px, 4vw, 44px);
      font-weight: 700;
      letter-spacing: -0.02em;
      line-height: 1.15;
      margin: 0 0 16px 0;
    }
    .cta-final > .cta-content > p {
      font-size: 19px;
      color: #f5f3ff;
      line-height: 1.5;
      max-width: 640px;
      margin: 0 auto 32px;
    }
    .btn-light {
      display: inline-flex; align-items: center; justify-content: center;
      padding: 0 36px; height: 52px;
      background: #fff;
      color: #7c3aed;
      border-radius: 12px;
      font-size: 17px;
      font-weight: 600;
      text-decoration: none;
      box-shadow: 0 12px 24px -8px rgba(0, 0, 0, 0.18);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .btn-light:hover {
      transform: translateY(-2px);
      box-shadow: 0 16px 32px -8px rgba(0, 0, 0, 0.25);
    }
    .cta-fineprint {
      margin-top: 24px !important;
      font-size: 13.5px !important;
      color: #f3e8ff !important;
      max-width: none !important;
    }

    /* ─── Footer 4 columnas ─── */
    .footer {
      background: #0f1729;
      color: #fff;
      padding: 64px 24px 32px;
    }
    .footer-grid {
      max-width: 1200px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: 1.5fr 1fr 1fr 1fr;
      gap: 48px;
      padding-bottom: 40px;
    }
    @media (max-width: 880px) {
      .footer-grid { grid-template-columns: 1fr 1fr; gap: 32px; }
      .footer-brand { grid-column: 1 / -1; }
    }
    .footer-col h4 {
      font-size: 15px;
      font-weight: 700;
      color: #fff;
      margin: 0 0 16px 0;
      letter-spacing: -0.01em;
    }
    .footer-col a {
      display: block;
      color: #9ca3af;
      font-size: 14.5px;
      text-decoration: none;
      padding: 6px 0;
      cursor: pointer;
      transition: color 0.15s ease;
    }
    .footer-col a:hover { color: #c4b5fd; }
    .footer-brand-row {
      display: inline-flex; align-items: center; gap: 10px;
      margin-bottom: 12px;
    }
    .footer-logo {
      width: 32px; height: 32px;
      border-radius: 8px;
      display: block;
      object-fit: cover;
    }
    .footer-brand-row strong {
      font-size: 17px;
      font-weight: 700;
      color: #fff;
      letter-spacing: -0.01em;
    }
    .footer-tagline {
      font-size: 14px;
      color: #9ca3af;
      line-height: 1.55;
      margin: 0;
      max-width: 280px;
    }
    .footer-bottom {
      max-width: 1200px;
      margin: 0 auto;
      padding-top: 24px;
      border-top: 1px solid rgba(255, 255, 255, 0.08);
      text-align: center;
    }
    .footer-bottom p {
      font-size: 14px;
      color: #9ca3af;
      margin: 0;
    }
  `],
})
export class PricingComponent {
  plans = PLANS;
  year = new Date().getFullYear();

  constructor(private snack: MatSnackBar) {}

  comingSoon(featureName: string): void {
    this.snack.open(`${featureName} — disponible pronto.`, 'OK', { duration: 4000 });
  }

  faqs = [
    {
      q: '¿Cómo funciona la prueba de 30 días?',
      a: 'Te registras gratis y obtienes 30 días para usar todas las funciones del plan Gratis. Al terminar, te pediremos elegir un plan para continuar. Los datos se conservan sin importar el plan que elijas.',
    },
    {
      q: '¿Qué pasa con mis datos si bajo de plan o cancelo?',
      a: 'Tus datos siguen intactos por al menos 90 días desde el último pago. Si decides volver antes de ese plazo, los recuperas tal cual los dejaste.',
    },
    {
      q: '¿Puedo cambiar de plan después?',
      a: 'Sí, en cualquier momento. Mejora o baja de plan desde Configuración → Plan. Los cambios aplican al instante.',
    },
    {
      q: '¿Aceptan Yape, Plin o tarjetas?',
      a: 'Pronto. Estamos integrando Culqi (tarjeta) y Yape/Plin para suscripciones. Te avisamos por correo cuando esté listo. El plan Gratis no requiere datos de pago.',
    },
    {
      q: '¿Sirve para panaderías y cafés también?',
      a: 'Sí. El modelo de insumos + recetas + POS funciona para cualquier negocio de comida: pastelerías, panaderías, cafés, dulcerías y chocolaterías.',
    },
  ];
}
