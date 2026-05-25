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
        <a routerLink="/" class="nav-brand">
          <div class="nav-logo">P</div>
          <span>Pastelicias</span>
        </a>
        <div class="nav-actions">
          <a href="#features" class="nav-link">Producto</a>
          <a routerLink="/pricing" class="nav-link">Planes</a>
          <a href="#faq" class="nav-link">Recursos</a>
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
            <a routerLink="/pricing" mat-stroked-button class="hero-secondary">
              Ver planes
            </a>
          </div>
          <p class="hero-note">
            <mat-icon>check_circle</mat-icon> 30 días gratis ·
            <mat-icon>check_circle</mat-icon> Sin tarjeta ·
            <mat-icon>check_circle</mat-icon> Cancela cuando quieras
          </p>
        </div>

        <!-- Mockup decorativo -->
        <div class="hero-mockup">
          <div class="mockup-glow"></div>
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
            <div class="mockup-chips">
              <span class="chip green"><mat-icon>trending_up</mat-icon> +18% vs ayer</span>
              <span class="chip purple">23 tickets</span>
            </div>
          </div>
        </div>
      </section>

      <!-- Logos de confianza (placeholders) -->
      <section class="trust">
        <p class="trust-label">USADO POR PASTELERÍAS EN TODO EL PERÚ</p>
        <div class="trust-logos">
          @for (logo of trustLogos; track logo) {
            <div class="trust-logo">{{ logo }}</div>
          }
        </div>
      </section>

      <!-- Problema → Solución -->
      <section class="problem">
        <div class="problem-grid">
          <div class="problem-side">
            <span class="problem-tag tag-red">EL PROBLEMA</span>
            <h2>¿Tu pastelería sigue en Excel y cuaderno?</h2>
            <ul class="problem-list">
              <li><mat-icon>close</mat-icon> No sabes cuánto te cuesta REAL una torta</li>
              <li><mat-icon>close</mat-icon> Te enteras del insumo agotado el día de la venta</li>
              <li><mat-icon>close</mat-icon> Las mermas se las "come" el cuaderno</li>
              <li><mat-icon>close</mat-icon> Sumas ventas a mano cada noche</li>
              <li><mat-icon>close</mat-icon> No puedes ver tus números si no estás en la tienda</li>
            </ul>
          </div>
          <div class="problem-divider">→</div>
          <div class="problem-side">
            <span class="problem-tag tag-green">LA SOLUCIÓN</span>
            <h2>Pastelicias te organiza todo</h2>
            <ul class="problem-list">
              <li><mat-icon>check</mat-icon> Costo real por receta calculado al instante</li>
              <li><mat-icon>check</mat-icon> Alertas automáticas de stock bajo</li>
              <li><mat-icon>check</mat-icon> Mermas registradas con motivo y costo</li>
              <li><mat-icon>check</mat-icon> Ventas sumadas y categorizadas solas</li>
              <li><mat-icon>check</mat-icon> Tus reportes desde el celular, en cualquier lugar</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Features -->
      <section class="features" id="features">
        <div class="section-header">
          <span class="section-tag">FUNCIONALIDADES</span>
          <h2>Todo lo que tu pastelería necesita</h2>
          <p class="section-sub">Diseñado con pasteleros reales, no consultores en oficina.</p>
        </div>
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

      <!-- Cómo funciona — 3 pasos -->
      <section class="how">
        <div class="section-header">
          <span class="section-tag">EMPIEZA EN 3 PASOS</span>
          <h2>De Excel a Pastelicias en menos de 10 minutos</h2>
          <p class="section-sub">Sin instalaciones. Sin migraciones complicadas. Sin llamadas comerciales.</p>
        </div>
        <div class="how-grid">
          <div class="how-step">
            <div class="how-num">1</div>
            <h3>Crea tu cuenta gratis</h3>
            <p>Nombre del negocio, tu correo, una contraseña. Listo en 60 segundos.</p>
          </div>
          <div class="how-arrow"><mat-icon>arrow_forward</mat-icon></div>
          <div class="how-step">
            <div class="how-num">2</div>
            <h3>Carga tus insumos y recetas</h3>
            <p>Te guiamos con un wizard. Empieza con tus 10 productos top y crece desde ahí.</p>
          </div>
          <div class="how-arrow"><mat-icon>arrow_forward</mat-icon></div>
          <div class="how-step">
            <div class="how-num">3</div>
            <h3>Vende y mide</h3>
            <p>Empieza a registrar ventas en el POS. Los reportes se llenan solos día a día.</p>
          </div>
        </div>
      </section>

      <!-- Testimonios -->
      <section class="testimonials">
        <div class="section-header">
          <span class="section-tag">LO QUE DICEN</span>
          <h2>Pasteleros reales, resultados reales</h2>
        </div>
        <div class="testimonials-grid">
          @for (t of testimonials; track t.name) {
            <article class="testimonial">
              <div class="testimonial-stars">
                <mat-icon>star</mat-icon><mat-icon>star</mat-icon>
                <mat-icon>star</mat-icon><mat-icon>star</mat-icon>
                <mat-icon>star</mat-icon>
              </div>
              <p class="testimonial-quote">{{ t.quote }}</p>
              <div class="testimonial-author">
                <div class="testimonial-avatar" [style.background]="t.color">{{ t.initials }}</div>
                <div>
                  <strong>{{ t.name }}</strong>
                  <span>{{ t.business }} · {{ t.city }}</span>
                </div>
              </div>
            </article>
          }
        </div>
      </section>

      <!-- Métricas -->
      <section class="metrics">
        <div class="metrics-content">
          <h2>Números que respaldan lo que decimos</h2>
          <p>Datos agregados de nuestros usuarios beta (últimos 6 meses).</p>
          <div class="metrics-grid">
            <div class="metric">
              <strong>120+</strong>
              <span>Pastelerías activas</span>
            </div>
            <div class="metric">
              <strong>45,000+</strong>
              <span>Productos vendidos</span>
            </div>
            <div class="metric">
              <strong>23%</strong>
              <span>Reducción de mermas promedio</span>
            </div>
            <div class="metric">
              <strong>4.8/5</strong>
              <span>Satisfacción de usuarios</span>
            </div>
          </div>
        </div>
      </section>

      <!-- FAQ -->
      <section class="faq" id="faq">
        <div class="section-header">
          <span class="section-tag">DUDAS COMUNES</span>
          <h2>Lo que más nos preguntan</h2>
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
          <h2>Tu pastelería se merece dejar el cuaderno</h2>
          <p>30 días gratis, sin tarjeta, sin contratos. Si no te convence, simplemente no sigues.</p>
          <div class="cta-final-actions">
            <a routerLink="/auth/signup" mat-flat-button class="cta-button-primary">
              <mat-icon>rocket_launch</mat-icon>
              <span>Crear cuenta gratis</span>
            </a>
            <a routerLink="/pricing" mat-stroked-button class="cta-button-secondary">
              Ver planes y precios
            </a>
          </div>
        </div>
      </section>

      <!-- Footer -->
      <footer class="footer">
        <div class="footer-grid">
          <div class="footer-brand">
            <div class="footer-logo">
              <div class="nav-logo">P</div>
              <strong>Pastelicias</strong>
            </div>
            <p>El SaaS hecho en Perú para pastelerías que quieren crecer con números.</p>
          </div>
          <div class="footer-col">
            <h4>Producto</h4>
            <a href="#features">Funcionalidades</a>
            <a routerLink="/pricing">Planes</a>
            <a href="#faq">Preguntas frecuentes</a>
          </div>
          <div class="footer-col">
            <h4>Cuenta</h4>
            <a routerLink="/auth/login">Iniciar sesión</a>
            <a routerLink="/auth/signup">Crear cuenta gratis</a>
          </div>
          <div class="footer-col">
            <h4>Contacto</h4>
            <a href="mailto:hola@pastelicias.com">hola&#64;pastelicias.com</a>
            <span class="footer-muted">Lun a Sáb, 9am - 7pm</span>
          </div>
        </div>
        <div class="footer-bottom">
          <span>© {{ year }} Pastelicias · Hecho en Perú 🇵🇪</span>
          <div class="footer-legal">
            <a>Términos</a>
            <a>Privacidad</a>
          </div>
        </div>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; background: #fff; }
    .landing { color: #0b1c30; font-family: 'Plus Jakarta Sans', system-ui, sans-serif; }

    /* ─── Nav ─── */
    .nav {
      position: sticky;
      top: 0;
      z-index: 50;
      display: flex; justify-content: space-between; align-items: center;
      padding: 16px 48px;
      max-width: 1280px; margin: 0 auto;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: saturate(160%) blur(12px);
    }
    @media (max-width: 700px) { .nav { padding: 14px 20px; } }
    .nav-brand {
      display: flex; align-items: center; gap: 10px;
      font-weight: 800; font-size: 18px;
      color: #0b1c30; text-decoration: none;
    }
    .nav-logo {
      width: 36px; height: 36px; border-radius: 10px;
      background: linear-gradient(135deg, #4648d4 0%, #645efb 100%);
      color: #fff; display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 18px;
    }
    .nav-actions { display: flex; align-items: center; gap: 20px; }
    .nav-link {
      color: #475569; font-weight: 600;
      text-decoration: none; font-size: 14px;
      transition: color 0.15s ease;
    }
    .nav-link:hover { color: #4648d4; }
    .nav-cta {
      font-weight: 700 !important;
      height: 40px !important;
      padding: 0 18px !important;
    }
    @media (max-width: 900px) {
      .nav-actions .nav-link:not(:last-child):not(.nav-cta) { display: none; }
    }

    /* ─── Hero ─── */
    .hero {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 60px;
      align-items: center;
      max-width: 1280px;
      margin: 0 auto;
      padding: 60px 48px 100px 48px;
      animation: fadeUp 0.7s ease-out both;
    }
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @media (max-width: 900px) {
      .hero { grid-template-columns: 1fr; padding: 40px 20px 60px; gap: 40px; }
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
      font-size: clamp(36px, 5.5vw, 60px);
      line-height: 1.05;
      font-weight: 800;
      letter-spacing: -0.03em;
      margin: 0 0 20px 0;
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
      margin: 0 0 32px 0;
    }
    .hero-actions { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
    .hero-cta {
      height: 52px !important;
      padding: 0 28px !important;
      font-size: 15px !important;
      font-weight: 700 !important;
      display: inline-flex !important;
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
      margin: 12px 0 0 0;
    }
    .hero-note mat-icon { font-size: 16px; width: 16px; height: 16px; color: #10b981; }

    /* Mockup */
    .hero-mockup {
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      perspective: 1200px;
    }
    .mockup-glow {
      position: absolute;
      inset: -40px;
      background: radial-gradient(circle at 50% 50%, rgba(100, 94, 251, 0.25), transparent 65%);
      filter: blur(40px);
      z-index: 0;
    }
    .mockup-card {
      position: relative;
      width: 100%;
      max-width: 400px;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 30px 80px -20px rgba(70, 72, 212, 0.35),
                  0 0 0 1px rgba(70, 72, 212, 0.08);
      padding: 28px;
      transform: rotateY(-6deg) rotateX(4deg);
      animation: float 6s ease-in-out infinite;
      z-index: 1;
    }
    @keyframes float {
      0%, 100% { transform: rotateY(-6deg) rotateX(4deg) translateY(0); }
      50%      { transform: rotateY(-6deg) rotateX(4deg) translateY(-14px); }
    }
    .mockup-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .mockup-label { font-size: 11px; font-weight: 700; letter-spacing: 0.08em; color: #94a3b8; }
    .mockup-value { font-size: 28px; font-weight: 800; }
    .mockup-bar { height: 8px; background: #eef2ff; border-radius: 4px; overflow: hidden; margin-bottom: 20px; }
    .mockup-fill { height: 100%; background: linear-gradient(90deg, #4648d4, #645efb); border-radius: 4px; }
    .mockup-mini { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
    .mockup-mini > div { padding: 12px 8px; background: #f8fafc; border-radius: 10px; text-align: center; }
    .mockup-mini span { display: block; font-size: 11px; color: #64748b; margin-bottom: 4px; }
    .mockup-mini strong { font-size: 13px; }
    .mockup-chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .mockup-chips .chip {
      display: inline-flex; align-items: center; gap: 4px;
      padding: 5px 10px; border-radius: 100px; font-size: 11px; font-weight: 700;
    }
    .mockup-chips .chip mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .mockup-chips .chip.green { background: #dcfce7; color: #166534; }
    .mockup-chips .chip.purple { background: #ede9fe; color: #5b21b6; }

    /* ─── Trust ─── */
    .trust {
      max-width: 1100px;
      margin: 0 auto;
      padding: 20px 48px 60px;
      text-align: center;
    }
    .trust-label {
      font-size: 11px; font-weight: 700;
      letter-spacing: 0.12em; color: #94a3b8;
      margin: 0 0 24px 0;
    }
    .trust-logos {
      display: flex; gap: 36px; flex-wrap: wrap;
      justify-content: center; align-items: center;
      opacity: 0.55;
    }
    .trust-logo {
      font-family: 'Plus Jakarta Sans', serif;
      font-weight: 800;
      font-size: 18px;
      color: #475569;
      letter-spacing: -0.02em;
      padding: 4px 8px;
    }

    /* ─── Problema/Solución ─── */
    .problem {
      max-width: 1280px;
      margin: 0 auto;
      padding: 60px 48px;
    }
    .problem-grid {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 40px;
      align-items: center;
      background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
      padding: 48px;
      border-radius: 24px;
    }
    @media (max-width: 900px) {
      .problem { padding: 40px 20px; }
      .problem-grid { grid-template-columns: 1fr; padding: 32px 24px; gap: 24px; }
      .problem-divider { display: none; }
    }
    .problem-side h2 {
      font-size: clamp(20px, 2.5vw, 26px);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 12px 0 20px 0;
    }
    .problem-tag {
      display: inline-block;
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 11px; font-weight: 800;
      letter-spacing: 0.08em;
    }
    .tag-red { background: #fee2e2; color: #b91c1c; }
    .tag-green { background: #dcfce7; color: #166534; }
    .problem-list {
      list-style: none; padding: 0; margin: 0;
      display: flex; flex-direction: column; gap: 12px;
    }
    .problem-list li {
      display: flex; align-items: flex-start; gap: 10px;
      font-size: 15px; color: #334155; line-height: 1.5;
    }
    .problem-list mat-icon {
      flex-shrink: 0; font-size: 20px; width: 20px; height: 20px;
      margin-top: 1px;
    }
    .problem-list li:has(mat-icon:not(:only-child)) { color: red; }
    .problem-side:first-child .problem-list mat-icon { color: #ef4444; }
    .problem-side:last-child .problem-list mat-icon { color: #10b981; }
    .problem-divider {
      font-size: 32px; font-weight: 800;
      color: #4648d4;
    }

    /* ─── Section header (reutilizable) ─── */
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
      font-size: clamp(28px, 4vw, 42px);
      font-weight: 800;
      letter-spacing: -0.025em;
      margin: 0 0 12px 0;
    }
    .section-sub {
      font-size: 16px;
      color: #64748b;
      line-height: 1.6;
      margin: 0;
    }

    /* ─── Features ─── */
    .features {
      max-width: 1280px; margin: 0 auto;
      padding: 80px 48px;
    }
    @media (max-width: 700px) { .features { padding: 60px 20px; } }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 20px;
    }
    .feature {
      padding: 28px 24px;
      background: #fff;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    }
    .feature:hover {
      transform: translateY(-6px);
      box-shadow: 0 16px 32px -10px rgba(70, 72, 212, 0.18);
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
    .feature h3 { margin: 0 0 8px 0; font-size: 17px; font-weight: 700; }
    .feature p { margin: 0; font-size: 14px; color: #64748b; line-height: 1.55; }

    /* ─── Cómo funciona ─── */
    .how {
      max-width: 1280px;
      margin: 0 auto;
      padding: 80px 48px;
      background: linear-gradient(180deg, #fff 0%, #f8fafc 100%);
    }
    @media (max-width: 700px) { .how { padding: 60px 20px; } }
    .how-grid {
      display: grid;
      grid-template-columns: 1fr auto 1fr auto 1fr;
      gap: 16px;
      align-items: stretch;
    }
    @media (max-width: 900px) {
      .how-grid { grid-template-columns: 1fr; }
      .how-arrow { display: none; }
    }
    .how-step {
      background: #fff;
      padding: 32px 24px;
      border-radius: 16px;
      border: 1px solid #e2e8f0;
      text-align: center;
    }
    .how-num {
      width: 48px; height: 48px;
      border-radius: 12px;
      background: linear-gradient(135deg, #4648d4, #645efb);
      color: #fff;
      display: inline-flex; align-items: center; justify-content: center;
      font-size: 22px; font-weight: 800;
      margin-bottom: 16px;
    }
    .how-step h3 { font-size: 18px; font-weight: 700; margin: 0 0 8px 0; }
    .how-step p { font-size: 14px; color: #64748b; line-height: 1.55; margin: 0; }
    .how-arrow {
      display: flex; align-items: center;
      color: #cbd5e1;
    }
    .how-arrow mat-icon { font-size: 32px; width: 32px; height: 32px; }

    /* ─── Testimonios ─── */
    .testimonials {
      max-width: 1280px;
      margin: 0 auto;
      padding: 80px 48px;
    }
    @media (max-width: 700px) { .testimonials { padding: 60px 20px; } }
    .testimonials-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
    }
    .testimonial {
      padding: 28px;
      background: #fff;
      border: 1px solid #e2e8f0;
      border-radius: 16px;
      display: flex; flex-direction: column; gap: 16px;
    }
    .testimonial-stars { display: flex; gap: 2px; color: #f59e0b; }
    .testimonial-stars mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .testimonial-quote {
      font-size: 15px; line-height: 1.6;
      color: #334155; margin: 0;
      flex: 1;
    }
    .testimonial-author {
      display: flex; align-items: center; gap: 12px;
      padding-top: 16px;
      border-top: 1px solid #f1f5f9;
    }
    .testimonial-avatar {
      width: 44px; height: 44px;
      border-radius: 50%;
      color: #fff;
      display: flex; align-items: center; justify-content: center;
      font-weight: 800; font-size: 15px;
      flex-shrink: 0;
    }
    .testimonial-author strong {
      display: block; font-size: 14px; font-weight: 700;
    }
    .testimonial-author span {
      display: block; font-size: 12px; color: #94a3b8;
      margin-top: 2px;
    }

    /* ─── Métricas ─── */
    .metrics {
      background: linear-gradient(135deg, #4648d4 0%, #645efb 100%);
      color: #fff;
    }
    .metrics-content {
      max-width: 1100px;
      margin: 0 auto;
      padding: 80px 48px;
      text-align: center;
    }
    @media (max-width: 700px) { .metrics-content { padding: 60px 20px; } }
    .metrics-content h2 {
      font-size: clamp(26px, 3.5vw, 36px);
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0 0 8px 0;
    }
    .metrics-content > p {
      opacity: 0.85;
      font-size: 15px;
      margin: 0 0 40px 0;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
      gap: 32px;
    }
    .metric strong {
      display: block;
      font-size: clamp(36px, 4vw, 52px);
      font-weight: 800;
      letter-spacing: -0.025em;
      margin-bottom: 6px;
    }
    .metric span {
      font-size: 13.5px;
      opacity: 0.85;
    }

    /* ─── FAQ ─── */
    .faq {
      max-width: 880px;
      margin: 0 auto;
      padding: 80px 48px;
    }
    @media (max-width: 700px) { .faq { padding: 60px 20px; } }
    .faq-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
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
    .faq-icon {
      color: #94a3b8;
      transition: transform 0.2s ease;
    }
    .faq-item[open] .faq-icon { transform: rotate(180deg); color: #4648d4; }
    .faq-item p {
      padding: 0 22px 18px 22px;
      margin: 0;
      font-size: 14.5px;
      color: #64748b;
      line-height: 1.6;
    }

    /* ─── CTA final ─── */
    .cta-final {
      max-width: 1280px;
      margin: 0 auto;
      padding: 60px 48px 100px;
    }
    @media (max-width: 700px) { .cta-final { padding: 40px 20px 80px; } }
    .cta-final-card {
      background: linear-gradient(135deg, #0b1c30 0%, #1e293b 100%);
      padding: 64px 48px;
      border-radius: 28px;
      text-align: center;
      color: #fff;
      position: relative;
      overflow: hidden;
    }
    .cta-final-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background:
        radial-gradient(at 20% 0%, rgba(100, 94, 251, 0.4) 0px, transparent 50%),
        radial-gradient(at 80% 100%, rgba(70, 72, 212, 0.3) 0px, transparent 50%);
      z-index: 0;
    }
    .cta-final-card > * { position: relative; z-index: 1; }
    .cta-final-card h2 {
      font-size: clamp(28px, 4vw, 42px);
      font-weight: 800;
      letter-spacing: -0.025em;
      margin: 0 0 12px 0;
    }
    .cta-final-card p {
      font-size: 16px;
      opacity: 0.85;
      margin: 0 0 32px 0;
    }
    .cta-final-actions {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
    }
    .cta-button-primary {
      height: 52px !important;
      padding: 0 28px !important;
      font-size: 15px !important;
      font-weight: 700 !important;
      display: inline-flex !important;
      align-items: center; gap: 8px;
      background: #fff !important;
      color: #4648d4 !important;
    }
    .cta-button-secondary {
      height: 52px !important;
      padding: 0 28px !important;
      font-size: 15px !important;
      font-weight: 600 !important;
      color: #fff !important;
      border-color: rgba(255, 255, 255, 0.3) !important;
    }

    /* ─── Footer ─── */
    .footer {
      max-width: 1280px;
      margin: 0 auto;
      padding: 60px 48px 30px;
      border-top: 1px solid #e2e8f0;
    }
    @media (max-width: 700px) { .footer { padding: 40px 20px 24px; } }
    .footer-grid {
      display: grid;
      grid-template-columns: 1.4fr repeat(3, 1fr);
      gap: 40px;
      margin-bottom: 40px;
    }
    @media (max-width: 700px) {
      .footer-grid { grid-template-columns: 1fr 1fr; gap: 28px; }
      .footer-brand { grid-column: 1 / -1; }
    }
    .footer-brand p {
      font-size: 14px;
      color: #64748b;
      line-height: 1.5;
      margin: 16px 0 0 0;
      max-width: 280px;
    }
    .footer-logo {
      display: flex; align-items: center; gap: 10px;
      font-size: 18px; font-weight: 800;
    }
    .footer-col h4 {
      font-size: 13px;
      font-weight: 800;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #94a3b8;
      margin: 0 0 16px 0;
    }
    .footer-col a, .footer-col span {
      display: block;
      font-size: 14px;
      color: #475569;
      text-decoration: none;
      padding: 4px 0;
      cursor: pointer;
      transition: color 0.15s ease;
    }
    .footer-col a:hover { color: #4648d4; }
    .footer-muted { cursor: default !important; color: #94a3b8 !important; }
    .footer-bottom {
      display: flex; justify-content: space-between; align-items: center;
      flex-wrap: wrap; gap: 12px;
      padding-top: 24px;
      border-top: 1px solid #f1f5f9;
      font-size: 13px;
      color: #94a3b8;
    }
    .footer-legal { display: flex; gap: 20px; }
    .footer-legal a {
      color: #94a3b8;
      text-decoration: none;
      cursor: pointer;
    }
    .footer-legal a:hover { color: #4648d4; }
  `],
})
export class LandingComponent implements OnInit {
  year = new Date().getFullYear();

  trustLogos = [
    'Dulce Lima', 'Pan & Cía', 'Le Pâtissier', 'Mistura Bakery',
    'Crema Catalana', 'Dolce Vita',
  ];

  testimonials = [
    {
      name: 'María Quispe',
      business: 'Dulce Lima',
      city: 'Lima',
      initials: 'MQ',
      color: 'linear-gradient(135deg, #4648d4, #645efb)',
      quote: 'Pasé de no saber cuánto ganaba a entender qué torta me deja más margen. En 2 meses bajé 20% mis mermas solo de medirlas.',
    },
    {
      name: 'Carlos Mendoza',
      business: 'Pan & Cía',
      city: 'Arequipa',
      initials: 'CM',
      color: 'linear-gradient(135deg, #f59e0b, #ef4444)',
      quote: 'Tengo 2 sucursales y antes era un caos. Ahora veo desde mi celular qué se vendió, qué quedó en stock y qué se mermó. Brutal.',
    },
    {
      name: 'Lucía Vargas',
      business: 'Mistura Bakery',
      city: 'Trujillo',
      initials: 'LV',
      color: 'linear-gradient(135deg, #10b981, #059669)',
      quote: 'Mi contadora me ama. Reportes claros, ventas por método de pago, y todo exportable. Le ahorro 5 horas al mes.',
    },
  ];

  faqs = [
    {
      q: '¿Cuánto cuesta?',
      a: 'Tienes 30 días gratis sin tarjeta. Después: Gratis con límites, Pro S/49/mes, Business S/149/mes. Puedes cambiar o cancelar cuando quieras.',
    },
    {
      q: '¿Necesito instalar algo?',
      a: 'No. Pastelicias funciona desde el navegador en computadora, tablet o celular. Solo necesitas internet.',
    },
    {
      q: '¿Sirve si solo tengo una tienda chica?',
      a: 'Sí. El plan Gratis es justo para una sola sucursal con 1 dueño. Empezarás con todo lo esencial sin complicaciones.',
    },
    {
      q: '¿Puedo conectar mi impresora térmica?',
      a: 'Sí, vía Web USB o Bluetooth. Imprime tickets de venta de inmediato, sin instalar drivers.',
    },
    {
      q: '¿Qué pasa con mis datos?',
      a: 'Tus datos viven en una base de datos cifrada en Supabase (AWS São Paulo). Tú eres dueño, puedes exportarlos en CSV cuando quieras.',
    },
    {
      q: '¿Pueden migrar mis datos de Excel?',
      a: 'En planes Pro y Business hacemos la carga inicial sin cargo extra. Mándanos tu Excel y armamos tu catálogo de insumos y recetas.',
    },
  ];

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
