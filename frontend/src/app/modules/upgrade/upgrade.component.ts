import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { PlanService } from '../../core/services/plan.service';
import { PlanCode } from '../../core/models';

/**
 * Página comparativa de planes. Permite cambiar de plan (mock — sin pago aún).
 * En Fase 3 los botones lanzarán el checkout de Culqi/Stripe.
 */
@Component({
  selector: 'app-upgrade',
  standalone: true,
  imports: [
    CommonModule, RouterLink,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="upgrade-page">
      <div class="upgrade-header">
        <a routerLink="/app/dashboard" class="back-link">
          <mat-icon>arrow_back</mat-icon> Volver
        </a>
        <h1>Elige tu plan</h1>
        <p class="sub">Sin contratos. Cambia o cancela cuando quieras.</p>
      </div>

      @if (plan.loading() && !plan.state()) {
        <div class="loading"><mat-spinner diameter="48" /></div>
      }
      @if (plan.state(); as p) {
        <div class="plans-grid">
          @for (planOption of p.allPlans; track planOption.plan) {
            <div class="plan-card"
                 [class.current]="planOption.plan === p.plan"
                 [class.recommended]="planOption.plan === 'PRO'">
              @if (planOption.plan === 'PRO') {
                <span class="recommended-tag">RECOMENDADO</span>
              }
              @if (planOption.plan === p.plan) {
                <span class="current-tag"><mat-icon>check_circle</mat-icon> Plan actual</span>
              }

              <h2 class="plan-name">{{ planOption.label }}</h2>
              <div class="plan-price">
                <strong>S/ {{ planOption.priceMonthlyPen }}</strong>
                <span>{{ planOption.priceMonthlyPen === 0 ? '· 30 días de prueba' : '/ mes' }}</span>
              </div>

              <div class="plan-features">
                <div class="feature">
                  <mat-icon>check</mat-icon>
                  <span>{{ formatLimit(planOption.limits.branches) }} sucursal{{ planOption.limits.branches === 1 ? '' : 'es' }}</span>
                </div>
                <div class="feature">
                  <mat-icon>check</mat-icon>
                  <span>{{ formatLimit(planOption.limits.ingredients) }} insumos</span>
                </div>
                <div class="feature">
                  <mat-icon>check</mat-icon>
                  <span>{{ formatLimit(planOption.limits.recipes) }} productos</span>
                </div>
                <div class="feature">
                  <mat-icon>check</mat-icon>
                  <span>{{ formatLimit(planOption.limits.users) }} usuario{{ planOption.limits.users === 1 ? '' : 's' }}</span>
                </div>
                @if (planOption.plan !== 'FREE') {
                  <div class="feature">
                    <mat-icon>check</mat-icon>
                    <span>Reportes avanzados</span>
                  </div>
                }
                @if (planOption.plan === 'BUSINESS') {
                  <div class="feature">
                    <mat-icon>check</mat-icon>
                    <span>Soporte prioritario</span>
                  </div>
                  <div class="feature">
                    <mat-icon>check</mat-icon>
                    <span>Multi-sucursal sin límite</span>
                  </div>
                }
              </div>

              @if (planOption.plan === p.plan) {
                <button mat-stroked-button class="plan-cta" disabled>
                  Tu plan actual
                </button>
              } @else if (changing() === planOption.plan) {
                <button mat-flat-button color="primary" class="plan-cta" disabled>
                  <mat-spinner diameter="20" />
                </button>
              } @else {
                <button mat-flat-button
                        [color]="planOption.plan === 'PRO' || planOption.plan === 'BUSINESS' ? 'primary' : ''"
                        class="plan-cta"
                        [disabled]="!!changing()"
                        (click)="confirmChange(planOption.plan, planOption.label)">
                  @if (isUpgrade(planOption.plan, p.plan)) {
                    Mejorar a {{ planOption.label }}
                  } @else {
                    Cambiar a {{ planOption.label }}
                  }
                </button>
              }
            </div>
          }
        </div>

        <div class="note">
          <mat-icon>info</mat-icon>
          <span>
            <strong>Versión beta:</strong> Aún no hemos integrado pasarela de pago.
            Cambiar de plan es gratis durante esta fase. Pronto pagos seguros con
            Culqi (tarjeta) y Yape.
          </span>
        </div>
      }
    </div>
  `,
  styles: [`
    :host { display: block; background: #f8f9ff; min-height: 100vh; }

    .upgrade-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 40px 24px 80px 24px;
    }
    .upgrade-header { text-align: center; margin-bottom: 40px; }
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: #64748b;
      text-decoration: none;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 20px;
    }
    .back-link mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .back-link:hover { color: #4648d4; }

    .upgrade-header h1 {
      font-size: clamp(28px, 4vw, 40px);
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #0b1c30;
      margin: 0 0 8px 0;
    }
    .upgrade-header .sub { font-size: 15px; color: #64748b; margin: 0; }

    .plans-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      gap: 20px;
      margin-bottom: 32px;
    }

    .plan-card {
      position: relative;
      padding: 32px 28px;
      background: #fff;
      border-radius: 20px;
      border: 2px solid #e2e8f0;
      display: flex;
      flex-direction: column;
      gap: 16px;
      transition: transform 0.2s ease, box-shadow 0.2s ease;
    }
    .plan-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 16px 32px -8px rgba(70, 72, 212, 0.15);
    }
    .plan-card.recommended {
      border-color: #4648d4;
      box-shadow: 0 12px 28px -8px rgba(70, 72, 212, 0.25);
    }
    .plan-card.current {
      border-color: #10b981;
      background: linear-gradient(180deg, #f0fdf4, #fff 40%);
    }

    .recommended-tag, .current-tag {
      position: absolute;
      top: -12px;
      left: 50%;
      transform: translateX(-50%);
      padding: 4px 14px;
      border-radius: 100px;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.06em;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .recommended-tag {
      background: linear-gradient(135deg, #4648d4, #645efb);
      color: #fff;
    }
    .current-tag {
      background: #10b981;
      color: #fff;
    }
    .current-tag mat-icon { font-size: 14px; width: 14px; height: 14px; }

    .plan-name {
      font-size: 22px;
      font-weight: 800;
      letter-spacing: -0.01em;
      color: #0b1c30;
      margin: 8px 0 0 0;
    }
    .plan-price strong { font-size: 36px; font-weight: 800; color: #0b1c30; letter-spacing: -0.02em; }
    .plan-price span { color: #94a3b8; font-size: 14px; margin-left: 4px; }

    .plan-features {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 16px 0;
      border-top: 1px solid #f1f5f9;
      border-bottom: 1px solid #f1f5f9;
      flex: 1;
    }
    .feature {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      color: #475569;
    }
    .feature mat-icon { color: #10b981; font-size: 18px; width: 18px; height: 18px; flex-shrink: 0; }

    .plan-cta {
      height: 48px !important;
      font-size: 14px !important;
      font-weight: 700 !important;
      display: flex !important;
      align-items: center; justify-content: center;
    }

    .note {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: 14px 18px;
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 12px;
      font-size: 13px;
      color: #92400e;
      line-height: 1.5;
    }
    .note mat-icon { color: #d97706; flex-shrink: 0; }
    .note strong { color: #78350f; }

    .loading { display: flex; justify-content: center; padding: 64px; }
  `],
})
export class UpgradeComponent implements OnInit {
  /** Plan que se está cambiando ahora (para mostrar spinner solo en ese card). */
  changing = signal<PlanCode | null>(null);

  constructor(
    public plan: PlanService,
    private snack: MatSnackBar,
    private router: Router
  ) {}

  async ngOnInit(): Promise<void> {
    await this.plan.load(true);
  }

  formatLimit(limit: number | null): string {
    return limit === null ? 'Ilimitado' : `Hasta ${limit}`;
  }

  /** True si el cambio es UN UPGRADE (sube de nivel), no downgrade. */
  isUpgrade(target: PlanCode, current: PlanCode): boolean {
    const order: PlanCode[] = ['FREE', 'PRO', 'BUSINESS'];
    return order.indexOf(target) > order.indexOf(current);
  }

  async confirmChange(target: PlanCode, label: string): Promise<void> {
    if (this.changing()) return;
    const ok = confirm(
      `¿Cambiar tu plan a ${label}?\n\n` +
      `(Versión beta — sin cobro real por ahora)`
    );
    if (!ok) return;

    this.changing.set(target);
    try {
      await this.plan.upgrade(target);
      this.snack.open(`✓ Plan cambiado a ${label}`, 'OK', { duration: 3500 });
      this.router.navigate(['/app/settings']);
    } catch (e: unknown) {
      this.snack.open(e instanceof Error ? e.message : 'Error', 'OK', { duration: 5000 });
    } finally {
      this.changing.set(null);
    }
  }
}
