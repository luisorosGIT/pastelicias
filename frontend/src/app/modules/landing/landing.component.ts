import { Component, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar } from '@angular/material/snack-bar';
import { AuthService } from '../../core/services/auth.service';
import { homePathForRole } from '../../core/utils/home-path';

/**
 * Landing pública / — adaptación fiel del diseño Figma "Mejorar páginas de ventas".
 * Si el usuario ya está autenticado, redirige automáticamente a su home.
 *
 * Estructura del diseño:
 *  - Navbar fixed con backdrop blur
 *  - Hero 2-col: texto + stats card con imagen Unsplash
 *  - Features 6 en grid 3x2 con icon gradients distintos
 *  - Image gallery 3 fotos Unsplash con hover scale
 *  - CTA banner gradient morado con SVG grid pattern
 *  - Footer oscuro
 */
@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink, MatIconModule],
  template: `
    <div class="landing">
      <!-- ─── Navbar ─── -->
      <nav class="navbar">
        <div class="navbar-inner">
          <a routerLink="/" class="nav-brand">
            <img src="assets/branding/logo.png" alt="Genimatech" class="nav-logo-img" />
            <span class="nav-name">Genimatech</span>
          </a>
          <div class="nav-menu">
            <a routerLink="/" class="nav-link active">Inicio</a>
            <a routerLink="/pricing" class="nav-link">Planes</a>
            <a routerLink="/auth/login" class="nav-link">Iniciar sesión</a>
            <a routerLink="/auth/signup" class="nav-cta">Crear cuenta gratis</a>
          </div>
        </div>
      </nav>

      <!-- ─── Hero ─── -->
      <section class="hero">
        <div class="hero-grid">
          <!-- Left -->
          <div class="hero-left fade-up">
            <span class="badge">
              <mat-icon class="badge-icon">auto_awesome</mat-icon>
              SAAS PARA PASTELERÍAS Y PANADERÍAS
            </span>
            <h1 class="hero-title">
              El POS que entiende cómo
              <span class="gradient-text">trabaja tu pastelería</span>
            </h1>
            <p class="hero-sub">
              Inventario por insumo, recetas con BOM, control de mermas, ventas
              en POS y reportes claros. Todo en una sola app, sin instalar nada.
            </p>
            <div class="hero-actions">
              <a routerLink="/auth/signup" class="btn-primary">
                <mat-icon>bolt</mat-icon>
                <span>Crear cuenta gratis</span>
              </a>
              <a routerLink="/auth/login" class="btn-outline">Ya tengo cuenta</a>
            </div>
            <div class="hero-benefits">
              @for (b of benefits; track b.label) {
                <div class="benefit">
                  <mat-icon class="benefit-icon">{{ b.icon }}</mat-icon>
                  <span>{{ b.label }}</span>
                </div>
              }
            </div>
          </div>

          <!-- Right: stats card -->
          <div class="hero-right fade-right">
            <div class="card-glow"></div>
            <div class="stats-card">
              <div class="stats-header">
                <p class="stats-label">VENTAS HOY</p>
                <p class="stats-value gradient-text">S/ 1,245.50</p>
              </div>
              <div class="stats-bar"></div>
              <div class="stats-grid">
                @for (s of statsMini; track s.label) {
                  <div class="stat-mini">
                    <p class="stat-value">{{ s.value }}</p>
                    <p class="stat-label">{{ s.label }}</p>
                  </div>
                }
              </div>
              <div class="stats-image-wrap">
                <img
                  src="https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=720&q=70"
                  alt="Showcase de pasteles"
                  class="stats-image"
                  loading="lazy"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <!-- ─── Features ─── -->
      <section class="features">
        <div class="section-header fade-up">
          <h2 class="section-title">Todo lo que tu pastelería necesita</h2>
          <p class="section-sub">
            Diseñado específicamente para el negocio de repostería y panadería.
          </p>
        </div>

        <div class="features-grid">
          @for (f of features; track f.title; let i = $index) {
            <article class="feature-card fade-up" [style.animation-delay.ms]="i * 80">
              <div class="feature-icon" [style.background]="f.gradient">
                <mat-icon>{{ f.icon }}</mat-icon>
              </div>
              <h3>{{ f.title }}</h3>
              <p>{{ f.desc }}</p>
            </article>
          }
        </div>
      </section>

      <!-- ─── Gallery ─── -->
      <section class="gallery">
        <div class="section-header fade-up">
          <h2 class="section-title">Potencia tu negocio de repostería</h2>
          <p class="section-sub">
            Únete a cientos de pastelerías que ya usan Genimatech.
          </p>
        </div>

        <div class="gallery-grid">
          @for (img of galleryImages; track img.alt; let i = $index) {
            <figure class="gallery-card scale-in" [style.animation-delay.ms]="i * 100">
              <img [src]="img.url" [alt]="img.alt" loading="lazy" />
            </figure>
          }
        </div>
      </section>

      <!-- ─── CTA final + Footer (sección unificada) ─── -->
      <section class="cta-final">
        <div class="cta-pattern"></div>
        <div class="cta-content fade-up">
          <h2>Empieza a controlar tu pastelería hoy</h2>
          <p>Únete a cientos de pastelerías que ya están optimizando sus costos y aumentando sus ganancias.</p>
          <a routerLink="/auth/signup" class="btn-light">Crear cuenta gratis</a>
          <p class="cta-fineprint">30 días de prueba · Sin tarjeta de crédito · Cancela cuando quieras</p>
        </div>
      </section>

      <!-- ─── Footer 4 columnas ─── -->
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
            <a href="#features">Funcionalidades</a>
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
    .landing {
      color: #0f172a;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      background: linear-gradient(180deg, #f9fafb 0%, #fff 60%);
      min-height: 100vh;
    }

    /* ─── Animations ─── */
    @keyframes fadeUp {
      from { opacity: 0; transform: translateY(20px); }
      to { opacity: 1; transform: translateY(0); }
    }
    @keyframes fadeRight {
      from { opacity: 0; transform: translateX(20px); }
      to { opacity: 1; transform: translateX(0); }
    }
    @keyframes scaleIn {
      from { opacity: 0; transform: scale(0.9); }
      to { opacity: 1; transform: scale(1); }
    }
    .fade-up { animation: fadeUp 0.6s ease-out both; }
    .fade-right { animation: fadeRight 0.6s ease-out 0.2s both; }
    .scale-in { animation: scaleIn 0.5s ease-out both; }

    /* ─── Navbar ─── */
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
    .nav-logo-img.small { width: 36px; height: 36px; border-radius: 10px; }
    .nav-brand:hover .nav-logo-img { transform: scale(1.1); }
    .nav-name {
      font-size: 22px; font-weight: 800; letter-spacing: -0.02em;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .nav-menu {
      display: flex; align-items: center; gap: 32px;
    }
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

    /* ─── Common ─── */
    .gradient-text {
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .section-header {
      text-align: center;
      max-width: 800px;
      margin: 0 auto 64px;
    }
    .section-title {
      font-size: clamp(32px, 4vw, 48px);
      font-weight: 800;
      letter-spacing: -0.025em;
      line-height: 1.1;
      margin: 0 0 16px 0;
    }
    .section-sub {
      font-size: 20px;
      color: #475569;
      line-height: 1.5;
      margin: 0;
    }

    /* ─── Hero ─── */
    .hero {
      padding: 112px 24px 48px;
      max-width: 1280px;
      margin: 0 auto;
    }
    .hero-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 48px;
      align-items: center;
    }
    @media (max-width: 960px) {
      .hero-grid { grid-template-columns: 1fr; }
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
      font-size: clamp(40px, 6vw, 72px);
      font-weight: 800;
      letter-spacing: -0.03em;
      line-height: 1.05;
      margin: 0 0 24px 0;
      color: #0f172a;
    }
    .gradient-text { display: inline; }
    .hero-sub {
      font-size: 20px;
      color: #475569;
      line-height: 1.55;
      margin: 0 0 32px 0;
    }
    .hero-actions {
      display: flex; gap: 16px;
      margin-bottom: 32px;
      flex-wrap: wrap;
    }
    .btn-primary {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 0 28px; height: 56px;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      color: #fff;
      border-radius: 12px;
      font-size: 17px; font-weight: 600;
      text-decoration: none;
      box-shadow: 0 10px 24px -8px rgba(79, 70, 229, 0.45);
      transition: box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 32px -8px rgba(79, 70, 229, 0.55);
      opacity: 0.95;
    }
    .btn-primary mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .btn-outline {
      display: inline-flex; align-items: center;
      padding: 0 28px; height: 56px;
      background: #fff;
      color: #0f172a;
      border: 2px solid #d1d5db;
      border-radius: 12px;
      font-size: 17px; font-weight: 600;
      text-decoration: none;
      transition: background 0.2s ease, border-color 0.2s ease;
    }
    .btn-outline:hover {
      background: #f9fafb;
      border-color: #9ca3af;
    }
    .hero-benefits {
      display: flex; flex-wrap: wrap;
      gap: 24px;
    }
    .benefit {
      display: inline-flex; align-items: center; gap: 8px;
      color: #475569;
      font-size: 15px;
    }
    .benefit-icon {
      color: #10b981;
      font-size: 20px;
      width: 20px; height: 20px;
    }

    /* ─── Hero right card ─── */
    .hero-right {
      position: relative;
    }
    .card-glow {
      position: absolute;
      inset: 0;
      background: linear-gradient(135deg, #4f46e5, #9333ea);
      border-radius: 24px;
      filter: blur(48px);
      opacity: 0.2;
      z-index: 0;
    }
    .stats-card {
      position: relative;
      z-index: 1;
      padding: 32px;
      background: rgba(255, 255, 255, 0.85);
      backdrop-filter: blur(8px);
      border-radius: 24px;
      box-shadow: 0 24px 48px -16px rgba(0, 0, 0, 0.18);
    }
    .stats-header {
      margin-bottom: 24px;
    }
    .stats-label {
      font-size: 16px;
      color: #475569;
      margin: 0 0 6px 0;
      font-weight: 500;
    }
    .stats-value {
      font-size: 48px;
      font-weight: 800;
      letter-spacing: -0.025em;
      margin: 0;
    }
    .stats-bar {
      height: 8px;
      background: linear-gradient(90deg, #4f46e5, #9333ea, #ec4899);
      border-radius: 100px;
      margin-bottom: 24px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }
    .stat-mini .stat-value {
      font-size: 22px;
      font-weight: 800;
      color: #1f2937;
      margin: 0 0 4px 0;
    }
    .stat-mini .stat-label {
      font-size: 13px;
      color: #6b7280;
      margin: 0;
    }
    .stats-image-wrap {
      padding: 12px;
      background: linear-gradient(135deg, #eef2ff, #f3e8ff);
      border: 1px solid #e0e7ff;
      border-radius: 14px;
    }
    .stats-image {
      width: 100%;
      height: 192px;
      object-fit: cover;
      border-radius: 10px;
      display: block;
    }

    /* ─── Features ─── */
    .features {
      padding: 80px 24px;
      max-width: 1280px;
      margin: 0 auto;
      background: #fff;
    }
    .features-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 32px;
    }
    @media (max-width: 960px) {
      .features-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 640px) {
      .features-grid { grid-template-columns: 1fr; }
    }
    .feature-card {
      padding: 24px;
      background: #fff;
      border: none;
      border-radius: 16px;
      box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.06);
      cursor: pointer;
      transition: box-shadow 0.3s ease, transform 0.3s ease;
    }
    .feature-card:hover {
      box-shadow: 0 16px 32px -8px rgba(0, 0, 0, 0.12);
      transform: translateY(-4px);
    }
    .feature-icon {
      width: 56px; height: 56px;
      border-radius: 16px;
      display: flex; align-items: center; justify-content: center;
      margin-bottom: 16px;
      color: #fff;
      transition: transform 0.3s ease;
    }
    .feature-card:hover .feature-icon {
      transform: scale(1.1);
    }
    .feature-icon mat-icon {
      font-size: 28px; width: 28px; height: 28px;
    }
    .feature-card h3 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.01em;
      margin: 0 0 12px 0;
    }
    .feature-card p {
      font-size: 15px;
      color: #475569;
      line-height: 1.6;
      margin: 0;
    }

    /* ─── Gallery ─── */
    .gallery {
      padding: 80px 24px;
      background: linear-gradient(180deg, #fff 0%, #eef2ff 100%);
    }
    .gallery-grid {
      max-width: 1280px;
      margin: 0 auto;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 24px;
    }
    @media (max-width: 960px) {
      .gallery-grid { grid-template-columns: repeat(2, 1fr); }
    }
    @media (max-width: 640px) {
      .gallery-grid { grid-template-columns: 1fr; }
    }
    .gallery-card {
      margin: 0;
      overflow: hidden;
      border-radius: 16px;
      box-shadow: 0 4px 12px -2px rgba(0, 0, 0, 0.1);
      transition: box-shadow 0.3s ease;
    }
    .gallery-card:hover {
      box-shadow: 0 24px 48px -8px rgba(0, 0, 0, 0.2);
    }
    .gallery-card img {
      width: 100%;
      height: 288px;
      object-fit: cover;
      display: block;
      transition: transform 0.5s ease;
    }
    .gallery-card:hover img {
      transform: scale(1.1);
    }

    /* ─── CTA final (banner morado-rosa full width) ─── */
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
export class LandingComponent implements OnInit {
  year = new Date().getFullYear();

  benefits = [
    { icon: 'shield', label: 'Sin tarjeta de crédito' },
    { icon: 'schedule', label: 'Empieza en 2 minutos' },
    { icon: 'check_circle', label: 'Cancela cuando quieras' },
  ];

  statsMini = [
    { value: 'S/ 720', label: 'Ayer' },
    { value: 'S/ 320', label: 'Hace 2 días' },
    { value: 'S/ 205', label: 'Hace 3 días' },
  ];

  features = [
    {
      icon: 'inventory_2',
      title: 'Inventario inteligente',
      desc: 'Controla insumos con CPP automático, costeo físico y alertas de stock crítico.',
      gradient: 'linear-gradient(135deg, #3b82f6, #06b6d4)',
    },
    {
      icon: 'menu_book',
      title: 'Recetas con BOM',
      desc: 'Define ingredientes por producto, calcula costos reales y mejora tus márgenes en vivo.',
      gradient: 'linear-gradient(135deg, #a855f7, #ec4899)',
    },
    {
      icon: 'point_of_sale',
      title: 'POS rápido',
      desc: 'Vende en segundos. Imprime tickets térmicos. Acepta efectivo, tarjeta, Yape/Plin.',
      gradient: 'linear-gradient(135deg, #f97316, #ef4444)',
    },
    {
      icon: 'bar_chart',
      title: 'Control de mermas',
      desc: 'Registra desperdicio, mide rotación de inventario y baja tus costos ocultos.',
      gradient: 'linear-gradient(135deg, #22c55e, #10b981)',
    },
    {
      icon: 'trending_up',
      title: 'Reportes claros',
      desc: 'Monitorea día a día tus productos, tendencias de costos. Decisiones con data.',
      gradient: 'linear-gradient(135deg, #6366f1, #a855f7)',
    },
    {
      icon: 'store',
      title: 'Multi-sucursal',
      desc: 'Maneja varias tiendas desde una sola cuenta. Compara desempeño en tiempo real.',
      gradient: 'linear-gradient(135deg, #ec4899, #f43f5e)',
    },
  ];

  galleryImages = [
    {
      url: 'https://images.unsplash.com/photo-1486427944299-d1955d23e34d?auto=format&fit=crop&w=720&q=70',
      alt: 'Cupcakes coloridos',
    },
    {
      url: 'https://images.unsplash.com/photo-1606755962773-d324e0a13086?auto=format&fit=crop&w=720&q=70',
      alt: 'Chef decorando pastel',
    },
    {
      url: 'https://images.unsplash.com/photo-1627818243473-acb731041bd5?auto=format&fit=crop&w=720&q=70',
      alt: 'Pastel de bodas elegante',
    },
  ];

  constructor(
    private authService: AuthService,
    private router: Router,
    private snack: MatSnackBar,
  ) {}

  comingSoon(featureName: string): void {
    this.snack.open(`${featureName} — disponible pronto.`, 'OK', { duration: 4000 });
  }

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
