import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';

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

/** Filas de la tabla comparativa. value puede ser string o booleano. */
interface CompareRow {
  feature: string;
  free: string | boolean;
  pro: string | boolean;
  business: string | boolean;
  group?: string; // si está set, abre una nueva sección
}

const COMPARE_ROWS: CompareRow[] = [
  { feature: 'Sucursales',                    free: '1',         pro: '3',        business: 'Ilimitado',     group: 'LÍMITES' },
  { feature: 'Insumos',                       free: '30',        pro: '200',      business: 'Ilimitado' },
  { feature: 'Productos / recetas',           free: '30',        pro: '200',      business: 'Ilimitado' },
  { feature: 'Usuarios',                      free: '1',         pro: '5',        business: 'Ilimitado' },

  { feature: 'POS con tickets térmicos',      free: true,        pro: true,       business: true,            group: 'OPERACIÓN' },
  { feature: 'Inventario con CPP automático', free: true,        pro: true,       business: true },
  { feature: 'Recetas con BOM',               free: true,        pro: true,       business: true },
  { feature: 'Control de mermas',             free: true,        pro: true,       business: true },
  { feature: 'Producción y conversiones',     free: true,        pro: true,       business: true },
  { feature: 'Reservaciones',                 free: true,        pro: true,       business: true },

  { feature: 'Reportes básicos',              free: true,        pro: true,       business: true,            group: 'ANÁLISIS' },
  { feature: 'Reportes avanzados',            free: false,       pro: true,       business: true },
  { feature: 'Comparativo multi-sucursal',    free: false,       pro: false,      business: true },
  { feature: 'Exportar a CSV',                free: true,        pro: true,       business: true },

  { feature: 'Soporte por email',             free: true,        pro: true,       business: true,            group: 'SOPORTE' },
  { feature: 'Soporte por chat',              free: false,       pro: true,       business: true },
  { feature: 'Soporte prioritario',           free: false,       pro: false,      business: true },
  { feature: 'Onboarding asistido',           free: false,       pro: false,      business: true },
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
        <h1>Elige el plan ideal para<br/>tu <span class="hero-accent">pastelería</span></h1>
        <p class="hero-sub">
          Empieza gratis con 30 días de prueba. Sin tarjeta, sin contratos.
          Mejora cuando lo necesites — y bájate cuando quieras.
        </p>

        <!-- Toggle Mensual / Anual (decorativo) -->
        <div class="billing-toggle">
          <button class="toggle-btn" [class.active]="billing() === 'monthly'" (click)="setBilling('monthly')">
            Mensual
          </button>
          <button class="toggle-btn" [class.active]="billing() === 'yearly'" (click)="setBilling('yearly')">
            Anual <span class="toggle-discount">-20%</span>
          </button>
        </div>
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
                <strong>{{ displayPrice(plan.priceMonthlyPen) }}</strong>
                <span class="plan-note">{{ priceNoteFor(plan) }}</span>
              </div>
              @if (billing() === 'yearly' && plan.priceMonthlyPen > 0) {
                <p class="plan-yearly-note">Facturado anualmente como S/{{ yearlyTotal(plan.priceMonthlyPen) }}</p>
              }

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

      <!-- Garantía -->
      <section class="guarantee">
        <div class="guarantee-card">
          <div class="guarantee-icon">
            <mat-icon>verified_user</mat-icon>
          </div>
          <div class="guarantee-content">
            <h3>Garantía de 30 días</h3>
            <p>
              Si en los primeros 30 días no te convence, te devolvemos tu dinero
              sin preguntas. Sin formularios, sin filas, sin trampas.
            </p>
          </div>
        </div>
      </section>

      <!-- Tabla comparativa -->
      <section class="compare">
        <div class="section-header">
          <span class="section-tag">COMPARATIVA DETALLADA</span>
          <h2>Todo lo que incluye cada plan</h2>
        </div>

        <div class="compare-table-wrap">
          <table class="compare-table">
            <thead>
              <tr>
                <th class="col-feature">Funcionalidad</th>
                <th>Gratis</th>
                <th class="col-pro">Pro</th>
                <th>Business</th>
              </tr>
            </thead>
            <tbody>
              @for (row of compareRows; track row.feature; let i = $index) {
                @if (row.group) {
                  <tr class="group-row">
                    <td colspan="4">{{ row.group }}</td>
                  </tr>
                }
                <tr>
                  <td class="col-feature">{{ row.feature }}</td>
                  <td>
                    @if (isBool(row.free)) {
                      <mat-icon [class.check]="row.free" [class.cross]="!row.free">
                        {{ row.free ? 'check' : 'close' }}
                      </mat-icon>
                    } @else {
                      <span>{{ row.free }}</span>
                    }
                  </td>
                  <td class="col-pro">
                    @if (isBool(row.pro)) {
                      <mat-icon [class.check]="row.pro" [class.cross]="!row.pro">
                        {{ row.pro ? 'check' : 'close' }}
                      </mat-icon>
                    } @else {
                      <span>{{ row.pro }}</span>
                    }
                  </td>
                  <td>
                    @if (isBool(row.business)) {
                      <mat-icon [class.check]="row.business" [class.cross]="!row.business">
                        {{ row.business ? 'check' : 'close' }}
                      </mat-icon>
                    } @else {
                      <span>{{ row.business }}</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- Add-ons / próximamente -->
      <section class="addons">
        <div class="section-header">
          <span class="section-tag">PRÓXIMAMENTE</span>
          <h2>Lo que estamos construyendo</h2>
          <p class="section-sub">
            Estos add-ons llegarán en los próximos meses. Si te interesa alguno,
            avísanos por email y lo priorizamos.
          </p>
        </div>
        <div class="addons-grid">
          <div class="addon-card">
            <div class="addon-icon"><mat-icon>credit_card</mat-icon></div>
            <h4>Pagos integrados</h4>
            <p>Cobra suscripciones con Culqi (tarjeta) y Yape, sin salir de la app.</p>
            <span class="addon-eta">Q1 2026</span>
          </div>
          <div class="addon-card">
            <div class="addon-icon"><mat-icon>phone_iphone</mat-icon></div>
            <h4>App móvil nativa</h4>
            <p>POS y consulta de stock desde tu celular Android e iOS, sin navegador.</p>
            <span class="addon-eta">Q2 2026</span>
          </div>
          <div class="addon-card">
            <div class="addon-icon"><mat-icon>cake</mat-icon></div>
            <h4>SMS de cumpleaños</h4>
            <p>Captura el cumpleaños de tus clientes y mándales un descuento automático.</p>
            <span class="addon-eta">Q2 2026</span>
          </div>
          <div class="addon-card">
            <div class="addon-icon"><mat-icon>local_shipping</mat-icon></div>
            <h4>Delivery integrado</h4>
            <p>Conecta con repartidores y haz seguimiento de pedidos a domicilio.</p>
            <span class="addon-eta">Q3 2026</span>
          </div>
        </div>
      </section>

      <!-- FAQ -->
      <section class="faq">
        <div class="section-header">
          <span class="section-tag">DUDAS COMUNES</span>
          <h2>Preguntas frecuentes</h2>
        </div>
        <div class="faq-grid">
          @for (q of faqs; track q.q) {
            <details class="faq-item">
              <summary>
                <span>{{ q.q }}</span>
                <mat-icon class="faq-icon">expand_more</mat-icon>
              </summary>
              <p>{{ q.a }}</p>
            </details>
          }
        </div>
      </section>

      <!-- Final CTA -->
      <section class="cta-final">
        <div class="cta-final-card">
          <h2>¿Listo para empezar?</h2>
          <p>30 días gratis · Sin tarjeta · Sin instalación</p>
          <a routerLink="/auth/signup" class="cta-button-primary">
            <mat-icon>rocket_launch</mat-icon>
            <span>Crear cuenta gratis</span>
          </a>
        </div>
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
      position: sticky;
      top: 0;
      z-index: 50;
      max-width: 1280px;
      margin: 0 auto;
      padding: 16px 48px;
      display: flex; align-items: center; justify-content: space-between;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: saturate(160%) blur(12px);
    }
    @media (max-width: 700px) { .nav { padding: 14px 20px; } }
    .nav-brand {
      display: flex; align-items: center; gap: 10px;
      font-size: 18px; font-weight: 800; color: #0b1c30;
      text-decoration: none;
    }
    .nav-logo {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #4648d4, #645efb);
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 18px;
    }
    .nav-actions { display: flex; align-items: center; gap: 20px; }
    .nav-link { color: #475569; text-decoration: none; font-weight: 600; font-size: 14px; }
    .nav-link:hover { color: #4648d4; }
    .nav-cta { font-weight: 700 !important; height: 40px !important; padding: 0 18px !important; }
    @media (max-width: 700px) { .nav-link:not(.nav-cta) { display: none; } }

    /* ─── Hero ─── */
    .hero {
      max-width: 800px;
      margin: 60px auto 30px;
      padding: 0 24px;
      text-align: center;
      animation: fadeUp 0.6s ease-out both;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .hero-tag {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 100px;
      background: #eef2ff;
      color: #4648d4;
      font-size: 12px; font-weight: 800;
      letter-spacing: 0.08em;
      margin-bottom: 20px;
    }
    .hero h1 {
      font-size: clamp(36px, 5.5vw, 56px);
      font-weight: 800;
      letter-spacing: -0.025em;
      line-height: 1.05;
      margin: 0 0 20px 0;
    }
    .hero-accent {
      background: linear-gradient(135deg, #4648d4, #645efb);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .hero-sub {
      font-size: 17px; color: #475569;
      line-height: 1.6;
      max-width: 580px;
      margin: 0 auto 32px;
    }

    /* ─── Billing toggle ─── */
    .billing-toggle {
      display: inline-flex;
      padding: 4px;
      background: #f1f5f9;
      border-radius: 100px;
      gap: 2px;
    }
    .toggle-btn {
      padding: 10px 22px;
      border: none;
      background: transparent;
      border-radius: 100px;
      font-size: 14px;
      font-weight: 700;
      color: #64748b;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex; align-items: center; gap: 8px;
      font-family: inherit;
    }
    .toggle-btn.active {
      background: #fff;
      color: #0b1c30;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
    }
    .toggle-discount {
      padding: 2px 8px;
      background: #10b981;
      color: #fff;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 800;
    }

    /* ─── Plans grid ─── */
    .plans-section {
      max-width: 1280px;
      margin: 0 auto;
      padding: 40px 48px 60px;
    }
    @media (max-width: 700px) { .plans-section { padding: 30px 20px 40px; } }
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
      box-shadow: 0 24px 48px -16px rgba(70, 72, 212, 0.18);
    }
    .plan-card.highlighted {
      border-color: #4648d4;
      box-shadow: 0 20px 40px -12px rgba(70, 72, 212, 0.25);
      transform: scale(1.02);
    }
    .plan-card.highlighted:hover { transform: scale(1.02) translateY(-6px); }
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
      font-size: 24px; font-weight: 800;
      letter-spacing: -0.01em; margin: 0 0 6px 0;
    }
    .plan-tagline {
      color: #64748b; font-size: 14px;
      line-height: 1.5; margin: 0;
    }
    .plan-price {
      display: flex; align-items: baseline; gap: 4px;
      padding-bottom: 8px;
    }
    .plan-currency { font-size: 18px; font-weight: 700; color: #64748b; }
    .plan-price strong { font-size: 44px; font-weight: 800; letter-spacing: -0.025em; }
    .plan-note { color: #94a3b8; font-size: 14px; margin-left: 6px; }
    .plan-yearly-note {
      font-size: 12px; color: #64748b;
      margin: -8px 0 0 0;
      padding-bottom: 8px;
      border-bottom: 1px solid #f1f5f9;
    }
    .plan-features {
      list-style: none; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: 10px;
      flex: 1;
      padding-top: 8px;
      border-top: 1px solid #f1f5f9;
    }
    .plan-features li {
      display: flex; align-items: flex-start; gap: 10px;
      color: #334155; font-size: 14.5px;
      line-height: 1.5;
    }
    .plan-features mat-icon {
      color: #10b981; font-size: 20px; width: 20px; height: 20px;
      flex-shrink: 0; margin-top: 1px;
    }
    .plan-cta {
      display: inline-flex !important;
      align-items: center; justify-content: center;
      gap: 8px;
      height: 48px;
      border-radius: 12px;
      font-weight: 700; font-size: 14.5px;
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
      display: flex; align-items: flex-start; gap: 10px;
      max-width: 720px; margin: 40px auto 0;
      padding: 16px 20px;
      background: #f8fafc; border: 1px solid #e2e8f0;
      border-radius: 14px;
      color: #475569; font-size: 13.5px; line-height: 1.6;
    }
    .disclaimer mat-icon { color: #4648d4; flex-shrink: 0; }

    /* ─── Garantía ─── */
    .guarantee {
      max-width: 1100px;
      margin: 0 auto;
      padding: 20px 48px 60px;
    }
    @media (max-width: 700px) { .guarantee { padding: 20px 20px 40px; } }
    .guarantee-card {
      display: flex; align-items: center; gap: 24px;
      padding: 32px;
      background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
      border-radius: 20px;
    }
    @media (max-width: 600px) {
      .guarantee-card { flex-direction: column; text-align: center; }
    }
    .guarantee-icon {
      flex-shrink: 0;
      width: 64px; height: 64px;
      border-radius: 18px;
      background: #fff;
      display: flex; align-items: center; justify-content: center;
      color: #d97706;
    }
    .guarantee-icon mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .guarantee-content h3 {
      font-size: 20px; font-weight: 800;
      margin: 0 0 4px 0;
      color: #78350f;
    }
    .guarantee-content p {
      font-size: 14.5px; color: #92400e;
      line-height: 1.5; margin: 0;
    }

    /* ─── Section header ─── */
    .section-header {
      text-align: center;
      max-width: 720px;
      margin: 0 auto 48px;
    }
    .section-tag {
      display: inline-block;
      padding: 5px 12px;
      background: #eef2ff;
      color: #4648d4;
      border-radius: 100px;
      font-size: 11px; font-weight: 800;
      letter-spacing: 0.08em; text-transform: uppercase;
      margin-bottom: 16px;
    }
    .section-header h2 {
      font-size: clamp(28px, 4vw, 40px);
      font-weight: 800;
      letter-spacing: -0.025em;
      margin: 0 0 12px 0;
    }
    .section-sub {
      font-size: 16px; color: #64748b;
      line-height: 1.6; margin: 0;
    }

    /* ─── Tabla comparativa ─── */
    .compare {
      max-width: 1100px;
      margin: 0 auto;
      padding: 60px 48px;
    }
    @media (max-width: 700px) { .compare { padding: 40px 20px; } }
    .compare-table-wrap {
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 20px;
      overflow-x: auto;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.04);
    }
    .compare-table {
      width: 100%;
      border-collapse: collapse;
      min-width: 580px;
    }
    .compare-table thead th {
      padding: 18px 16px;
      text-align: center;
      font-size: 14px;
      font-weight: 700;
      color: #0b1c30;
      background: #f8fafc;
      border-bottom: 2px solid #e2e8f0;
      position: sticky; top: 0;
    }
    .compare-table thead th.col-feature {
      text-align: left;
      color: #64748b;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
    }
    .compare-table thead th.col-pro {
      color: #4648d4;
      background: #eef2ff;
    }
    .compare-table tbody td {
      padding: 12px 16px;
      text-align: center;
      font-size: 14px;
      color: #334155;
      border-bottom: 1px solid #f1f5f9;
    }
    .compare-table tbody td.col-feature {
      text-align: left;
      font-weight: 600;
    }
    .compare-table tbody td.col-pro { background: #fafbff; }
    .compare-table tbody tr:hover td { background: #f8fafc; }
    .compare-table tbody tr:hover td.col-pro { background: #eef2ff; }
    .compare-table tbody tr.group-row td {
      padding: 18px 16px 8px;
      text-align: left;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.08em;
      color: #94a3b8;
      background: transparent !important;
      border-bottom: none;
    }
    .compare-table mat-icon {
      font-size: 22px; width: 22px; height: 22px;
    }
    .compare-table mat-icon.check { color: #10b981; }
    .compare-table mat-icon.cross { color: #cbd5e1; }

    /* ─── Add-ons ─── */
    .addons {
      max-width: 1280px;
      margin: 0 auto;
      padding: 60px 48px;
    }
    @media (max-width: 700px) { .addons { padding: 40px 20px; } }
    .addons-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;
    }
    .addon-card {
      position: relative;
      padding: 24px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      transition: transform 0.2s ease;
    }
    .addon-card:hover { transform: translateY(-4px); }
    .addon-icon {
      width: 44px; height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #fef3c7, #fde68a);
      color: #d97706;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 14px;
    }
    .addon-card h4 {
      font-size: 16px; font-weight: 700;
      margin: 0 0 6px 0;
    }
    .addon-card p {
      font-size: 13.5px; color: #64748b;
      line-height: 1.55; margin: 0 0 12px 0;
    }
    .addon-eta {
      display: inline-block;
      padding: 3px 10px;
      background: #f1f5f9;
      color: #64748b;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
    }

    /* ─── FAQ ─── */
    .faq {
      max-width: 880px;
      margin: 0 auto;
      padding: 60px 48px;
    }
    @media (max-width: 700px) { .faq { padding: 40px 20px; } }
    .faq-grid {
      display: flex; flex-direction: column; gap: 12px;
    }
    .faq-item {
      padding: 0;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 14px;
      overflow: hidden;
      transition: border-color 0.2s ease;
    }
    .faq-item[open] { border-color: #c7d2fe; }
    .faq-item summary {
      list-style: none;
      cursor: pointer;
      padding: 18px 22px;
      display: flex; align-items: center; justify-content: space-between;
      gap: 12px;
      font-size: 15px; font-weight: 700;
    }
    .faq-item summary::-webkit-details-marker { display: none; }
    .faq-icon { color: #94a3b8; transition: transform 0.2s ease; }
    .faq-item[open] .faq-icon { transform: rotate(180deg); color: #4648d4; }
    .faq-item p {
      padding: 0 22px 18px;
      margin: 0;
      font-size: 14.5px;
      color: #64748b;
      line-height: 1.6;
    }

    /* ─── Final CTA ─── */
    .cta-final {
      max-width: 1280px;
      margin: 0 auto;
      padding: 40px 48px 80px;
    }
    @media (max-width: 700px) { .cta-final { padding: 30px 20px 60px; } }
    .cta-final-card {
      background: linear-gradient(135deg, #4648d4 0%, #645efb 100%);
      color: #fff;
      padding: 60px 48px;
      border-radius: 28px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .cta-final-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(at 20% 0%, rgba(255, 255, 255, 0.2) 0px, transparent 50%),
        radial-gradient(at 80% 100%, rgba(0, 0, 0, 0.15) 0px, transparent 50%);
    }
    .cta-final-card > * { position: relative; z-index: 1; }
    .cta-final-card h2 {
      font-size: clamp(28px, 3.5vw, 38px);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 12px 0;
    }
    .cta-final-card p {
      font-size: 16px; opacity: 0.9;
      margin: 0 0 28px 0;
    }
    .cta-button-primary {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 0 28px;
      height: 52px;
      font-size: 15px; font-weight: 700;
      background: #fff;
      color: #4648d4;
      border-radius: 12px;
      text-decoration: none;
      transition: transform 0.15s ease, box-shadow 0.15s ease;
    }
    .cta-button-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.15);
    }
    .cta-button-primary mat-icon { font-size: 20px; width: 20px; height: 20px; }

    /* ─── Footer ─── */
    .footer {
      text-align: center;
      padding: 30px 24px;
      color: #94a3b8;
      font-size: 14px;
      border-top: 1px solid #f1f5f9;
    }
  `],
})
export class PricingComponent {
  plans = PLANS;
  compareRows = COMPARE_ROWS;
  year = new Date().getFullYear();

  faqs = [
    {
      q: '¿Cómo funciona la prueba de 30 días?',
      a: 'Te registras gratis y obtienes 30 días para usar todas las funciones del plan Gratis. Al terminar, te pediremos elegir un plan para seguir creando ventas, insumos, etc. (siempre podrás ver lo que ya creaste).',
    },
    {
      q: '¿Necesito tarjeta de crédito para empezar?',
      a: 'No. La prueba es 100% sin tarjeta. Solo te pedimos datos de pago cuando decidas pasar al plan Pro o Business.',
    },
    {
      q: '¿Puedo cambiar de plan después?',
      a: 'Sí, en cualquier momento. Mejora o baja de plan desde Configuración → Plan. Los cambios aplican al instante.',
    },
    {
      q: '¿Qué pasa con mis datos si bajo de plan o cancelo?',
      a: 'Tus datos siguen intactos por al menos 90 días. Si vuelves antes de ese plazo, los recuperas tal cual los dejaste.',
    },
    {
      q: '¿Aceptan Yape, Plin o tarjeta?',
      a: 'Pronto. Estamos integrando Culqi (tarjeta) y Yape para suscripciones. Por ahora la app está en beta y los cambios de plan son gratuitos.',
    },
    {
      q: '¿Sirve para panaderías y cafés también?',
      a: 'Sí. El modelo de insumos + recetas + POS funciona para cualquier negocio de comida: pastelerías, panaderías, cafés, dulcerías y chocolaterías.',
    },
    {
      q: '¿Cómo manejan la facturación electrónica (SUNAT)?',
      a: 'Por ahora generamos comprobantes internos (tickets). Estamos trabajando en la integración con un PSE para boletas y facturas electrónicas SUNAT, llegará en Q2 2026.',
    },
    {
      q: '¿Pueden ayudarme a migrar de otro sistema?',
      a: 'Sí. En planes Pro y Business hacemos la carga inicial sin cargo extra. Solo mándanos tu Excel, CSV o backup y armamos tu catálogo.',
    },
  ];

  billing = signal<'monthly' | 'yearly'>('monthly');

  constructor(private snack: MatSnackBar) {}

  setBilling(b: 'monthly' | 'yearly'): void {
    if (this.billing() === b) return;
    this.billing.set(b);
    if (b === 'yearly') {
      this.snack.open(
        'Facturación anual disponible pronto — por ahora todo es mensual sin compromiso.',
        'OK',
        { duration: 4000 }
      );
    }
  }

  /** Precio visible según billing seleccionado. Yearly = -20%. */
  displayPrice(monthly: number): number {
    if (monthly === 0) return 0;
    if (this.billing() === 'yearly') return Math.round(monthly * 0.8);
    return monthly;
  }

  /** Texto descriptivo de la unidad de precio. */
  priceNoteFor(plan: PublicPlan): string {
    if (plan.priceMonthlyPen === 0) return plan.priceNote;
    return this.billing() === 'yearly' ? '/ mes facturado anual' : '/ mes';
  }

  /** Total anual para mostrar abajo. */
  yearlyTotal(monthly: number): number {
    return Math.round(monthly * 0.8 * 12);
  }

  /** Helper para distinguir booleano de string en el template. */
  isBool(v: string | boolean): v is boolean {
    return typeof v === 'boolean';
  }
}
