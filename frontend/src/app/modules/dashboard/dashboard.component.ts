import { Component, OnInit, computed, effect, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DashboardService } from '../../core/services/dashboard.service';
import { BranchService } from '../../core/services/branch.service';
import { AuthService } from '../../core/services/auth.service';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { DateFilter } from '../../core/models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, CurrencyPipe, DecimalPipe,
    MatButtonToggleModule, MatIconModule, MatProgressSpinnerModule,
    KpiCardComponent,
  ],
  template: `
    <div class="page-header">
      <div>
        <h2>Resumen General</h2>
        <p class="page-subtitle">Métricas clave de las operaciones al día de hoy.</p>
      </div>
      <mat-button-toggle-group [value]="filter()" (change)="setFilter($event.value)" class="period-toggle">
        <mat-button-toggle value="today">Hoy</mat-button-toggle>
        <mat-button-toggle value="yesterday">Ayer</mat-button-toggle>
        <mat-button-toggle value="week">Semana</mat-button-toggle>
        <mat-button-toggle value="month">Mes</mat-button-toggle>
        <mat-button-toggle value="quarter">Trim</mat-button-toggle>
        <mat-button-toggle value="year">Año</mat-button-toggle>
      </mat-button-toggle-group>
    </div>

    @if (dashboard.loading()) {
      <div class="loading"><mat-spinner diameter="40" /></div>
    } @else if (!summary()) {
      <div class="empty card">
        <mat-icon>insights</mat-icon>
        <p>Sin datos para el período seleccionado.</p>
      </div>
    } @else {
      <!-- ─── KPIs ──────────────────────────────────────── -->
      <div class="kpi-grid">
        <app-kpi-card
          label="Ventas del Período"
          [value]="summary()!.kpis.dailySales"
          format="currency"
          icon="trending_up"
          accentColor="#4648d4"
          [subtitle]="summary()!.salesCount + ' venta' + (summary()!.salesCount === 1 ? '' : 's')"
        />
        <app-kpi-card
          label="Ticket Promedio"
          [value]="summary()!.kpis.averageTicket"
          format="currency"
          icon="receipt_long"
          accentColor="#645efb"
        />
        <app-kpi-card
          label="Índice de Merma"
          [value]="summary()!.kpis.wasteIndex"
          format="percent"
          icon="warning_amber"
          accentColor="#dc2626"
        />
        <app-kpi-card
          label="Insumos Críticos"
          [value]="summary()!.kpis.criticalIngredients"
          format="integer"
          icon="inventory_2"
          accentColor="#d97706"
          [subtitle]="summary()!.kpis.criticalIngredients === 0 ? 'Todo en orden' : 'Revisar inventario'"
        />
      </div>

      <div class="dash-grid">
        <!-- ─── Gráfico ventas ────────────────────────── -->
        <div class="card chart-card">
          <h3><mat-icon>show_chart</mat-icon> Ventas por período</h3>
          @if (summary()!.series.length === 0) {
            <p class="empty-text muted">Sin ventas en este período.</p>
          } @else {
            <div class="bar-chart">
              @for (point of summary()!.series; track point.label) {
                <div class="bar-col" [style.height.%]="barHeight(point.total)">
                  <div class="bar-value">{{ point.total | currency:'S/ ':'symbol':'1.0-0' }}</div>
                  <div class="bar" [style.height.%]="barHeight(point.total)"></div>
                  <div class="bar-label">{{ point.label }}</div>
                </div>
              }
            </div>
          }
        </div>

        <!-- ─── Top productos ─────────────────────────── -->
        <div class="card top-card">
          <h3><mat-icon>star</mat-icon> Top 5 Productos</h3>
          @if (summary()!.topProducts.length === 0) {
            <p class="empty-text muted">Sin ventas.</p>
          } @else {
            <div class="top-list">
              @for (p of summary()!.topProducts; track p.name; let i = $index) {
                <div class="top-row">
                  <span class="pos" [class.gold]="i === 0" [class.silver]="i === 1" [class.bronze]="i === 2">#{{ i + 1 }}</span>
                  <div class="top-info">
                    <strong>{{ p.name }}</strong>
                    <div class="top-bar-track">
                      <div class="top-bar-fill" [style.width.%]="topBarWidth(p.quantity)"></div>
                    </div>
                  </div>
                  <div class="top-stats">
                    <strong>{{ p.quantity }} u.</strong>
                    <span class="muted">{{ p.revenue | currency:'S/ ':'symbol':'1.2-2' }}</span>
                  </div>
                </div>
              }
            </div>
          }
        </div>

        @if (summary()!.branches.length > 0) {
          <div class="card branches-card span-2">
            <h3><mat-icon>store</mat-icon> Sucursales activas</h3>
            <div class="branch-grid">
              @for (b of summary()!.branches; track b.id) {
                <div class="branch-item">
                  <div class="branch-title-group">
                    <mat-icon>storefront</mat-icon>
                    <span>{{ b.name }}</span>
                  </div>
                  <span class="status-dot" [class.active]="b.isActive" [class.inactive]="!b.isActive"></span>
                </div>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .period-toggle {
      background: var(--color-surface);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-1);
    }
    ::ng-deep .period-toggle .mat-button-toggle {
      border: none;
      background: transparent;
    }
    ::ng-deep .period-toggle .mat-button-toggle-checked {
      background: var(--color-primary-soft) !important;
      color: var(--color-primary) !important;
    }
    ::ng-deep .period-toggle .mat-button-toggle-label-content {
      font-weight: 600;
      font-size: 13px;
    }

    .dash-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: var(--space-4);
    }
    .span-2 { grid-column: span 2; }
    .card h3 {
      margin: 0 0 16px 0;
      font-size: 16px;
      font-weight: 700;
      color: var(--color-text);
      display: flex;
      align-items: center;
      gap: 8px;
      letter-spacing: -0.01em;
    }
    .card h3 mat-icon { color: var(--color-primary); font-size: 20px; width: 20px; height: 20px; }
    .empty-text { padding: 32px 0; text-align: center; font-size: 13px; margin: 0; }
    .muted { color: var(--color-text-muted); }

    /* ─── Bar chart ─── */
    .bar-chart {
      display: flex;
      align-items: flex-end;
      gap: 16px;
      height: 280px;
      padding: 16px 8px 8px 8px;
      overflow-x: auto;
    }
    .bar-col {
      flex: 1;
      min-width: 48px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
      position: relative;
      height: 100%;
      justify-content: flex-end;
    }
    .bar-value {
      font-size: 10px;
      font-weight: 700;
      color: var(--color-primary);
      white-space: nowrap;
    }
    .bar {
      width: 60%;
      max-width: 40px;
      background: linear-gradient(180deg, #645efb 0%, #4648d4 100%);
      border-radius: 8px 8px 0 0;
      transition: height 0.3s ease;
      min-height: 4px;
    }
    .bar-label {
      font-size: 11px;
      color: var(--color-text-muted);
      font-weight: 600;
      margin-top: 4px;
    }

    /* ─── Top productos ─── */
    .top-list { display: flex; flex-direction: column; gap: 4px; }
    .top-row {
      display: grid;
      grid-template-columns: 32px 1fr auto;
      gap: 12px;
      align-items: center;
      padding: 12px 0;
      border-bottom: 1px solid var(--color-border);
    }
    .top-row:last-child { border-bottom: none; }
    .pos {
      width: 28px;
      height: 28px;
      border-radius: var(--radius-full);
      background: var(--color-surface-low);
      color: var(--color-text-muted);
      display: flex; align-items: center; justify-content: center;
      font-size: 11px;
      font-weight: 700;
    }
    .pos.gold   { background: #fef3c7; color: #d97706; }
    .pos.silver { background: #e5e7eb; color: #475569; }
    .pos.bronze { background: #fed7aa; color: #c2410c; }

    .top-info { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .top-info strong {
      font-size: 13px;
      color: var(--color-text);
      font-weight: 600;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .top-bar-track {
      height: 4px;
      background: var(--color-surface-low);
      border-radius: 2px;
      overflow: hidden;
    }
    .top-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, #645efb 0%, #4648d4 100%);
      border-radius: 2px;
    }
    .top-stats {
      display: flex; flex-direction: column; align-items: flex-end;
      font-size: 12px;
    }
    .top-stats strong { color: var(--color-text); font-weight: 700; }

    /* ─── Sucursales ─── */
    .branch-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 10px;
    }
    .branch-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      padding: 14px 16px;
      background: var(--color-surface-low);
      border-radius: var(--radius-sm);
      font-size: 13px;
      color: var(--color-text);
      font-weight: 600;
      transition: all 0.15s;
    }
    .branch-item:hover {
      background: var(--color-primary-soft);
      transform: translateY(-1px);
    }
    .branch-title-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .branch-item mat-icon { color: var(--color-primary); font-size: 18px; width: 18px; height: 18px; }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: var(--radius-full);
      flex-shrink: 0;
    }
    .status-dot.active { background: #22c55e; }
    .status-dot.inactive { background: #ef4444; }

    .loading, .empty {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 80px 32px;
      gap: 12px;
      color: var(--color-text-muted);
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-1);
    }
    .empty mat-icon { font-size: 56px; width: 56px; height: 56px; color: var(--color-border-strong); }
    .empty p { margin: 0; font-size: 15px; font-weight: 500; }
  `],
})
export class DashboardComponent implements OnInit {
  filter = signal<DateFilter>('today');

  summary = computed(() => this.dashboard.summary());

  private maxSeriesValue = computed(() => {
    const s = this.summary()?.series ?? [];
    return Math.max(1, ...s.map((p) => p.total));
  });

  private maxTopQuantity = computed(() => {
    const top = this.summary()?.topProducts ?? [];
    return Math.max(1, ...top.map((p) => p.quantity));
  });

  private branchInitialized = false;

  constructor(
    public dashboard: DashboardService,
    private branchService: BranchService,
    private authService: AuthService
  ) {
    // Recargar cuando la sucursal seleccionada cambie (OWNER).
    // Skip primer fire para no duplicar el load de ngOnInit.
    effect(() => {
      this.branchService.selectedBranchId();
      if (!this.branchInitialized) {
        this.branchInitialized = true;
        return;
      }
      void this.dashboard.load(this.filter());
    }, { allowSignalWrites: true });
  }

  async ngOnInit(): Promise<void> {
    if (this.authService.role() === 'OWNER') {
      await this.branchService.loadBranches();
    }
    await this.dashboard.load(this.filter());
  }

  async setFilter(f: DateFilter): Promise<void> {
    this.filter.set(f);
    await this.dashboard.load(f);
  }

  barHeight(value: number): number {
    const max = this.maxSeriesValue();
    return max > 0 ? Math.max(2, (value / max) * 100) : 2;
  }

  topBarWidth(qty: number): number {
    const max = this.maxTopQuantity();
    return max > 0 ? (qty / max) * 100 : 0;
  }
}
