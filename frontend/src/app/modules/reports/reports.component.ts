import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReportsService } from '../../core/services/reports.service';
import { BranchService } from '../../core/services/branch.service';
import { AuthService } from '../../core/services/auth.service';
import { InventoryService } from '../../core/services/inventory.service';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { DateFilter } from '../../core/models';
import { getErrorMessage } from '../../core/utils/error-message';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule, CurrencyPipe, DatePipe, DecimalPipe,
    MatButtonModule, MatButtonToggleModule, MatIconModule, MatProgressSpinnerModule,
    KpiCardComponent,
  ],
  template: `
    <div class="page-header">
      <div>
        <h2>Visión General</h2>
        <p class="page-subtitle">Métricas clave y rendimiento de ventas de la sucursal.</p>
      </div>
      <button mat-stroked-button (click)="downloadCsv()" [disabled]="downloading()">
        @if (downloading()) {
          <mat-spinner diameter="20" />
        } @else {
          <mat-icon>download</mat-icon> Exportar CSV
        }
      </button>
    </div>

    <!-- Filtro de período -->
    <div class="period-bar">
      <mat-button-toggle-group [value]="filter()" (change)="setFilter($event.value)" class="period-toggle">
        <mat-button-toggle value="today">Hoy</mat-button-toggle>
        <mat-button-toggle value="yesterday">Ayer</mat-button-toggle>
        <mat-button-toggle value="week">Semana</mat-button-toggle>
        <mat-button-toggle value="month">Mes</mat-button-toggle>
        <mat-button-toggle value="quarter">Trim</mat-button-toggle>
        <mat-button-toggle value="year">Año</mat-button-toggle>
      </mat-button-toggle-group>
      @if (summary()?.period) {
        <span class="period-range">
          {{ summary()!.period.from | date:'dd/MM/yyyy' }} → {{ summary()!.period.to | date:'dd/MM/yyyy' }}
        </span>
      }
    </div>

    @if (reports.loading()) {
      <div class="loading"><mat-spinner diameter="40" /></div>
    } @else if (!summary()) {
      <div class="empty card">
        <mat-icon>insert_chart</mat-icon>
        <p>Sin datos para el período seleccionado.</p>
      </div>
    } @else {
      <!-- KPIs principales -->
      <div class="kpi-grid">
        <app-kpi-card
          label="Ventas Brutas"
          [value]="summary()!.kpis.grossSales"
          format="currency"
          icon="attach_money"
          accentColor="#10B981"
        />
        <app-kpi-card
          label="Ventas Netas"
          [value]="summary()!.kpis.netSales"
          format="currency"
          icon="payments"
          accentColor="#06B6D4"
          subtitle="Brutas − Merma"
        />
        <app-kpi-card
          label="Impacto de Merma"
          [value]="summary()!.kpis.wasteImpact"
          format="currency"
          icon="trending_down"
          accentColor="#EF4444"
        />
        <app-kpi-card
          label="% de Merma"
          [value]="summary()!.kpis.wastePercent"
          format="percent"
          icon="warning"
          accentColor="#F59E0B"
        />
        <app-kpi-card
          label="Valor de Inventario"
          [value]="inventory.kpis().totalValue"
          format="currency"
          icon="account_balance_wallet"
          accentColor="#4648d4"
          [subtitle]="inventoryKpiSubtitle()"
        />
        <app-kpi-card
          label="Productos Vendidos"
          [value]="summary()!.totalItemsSold"
          format="integer"
          icon="shopping_basket"
          accentColor="#8B5CF6"
          subtitle="Unidades totales del periodo"
        />
        <app-kpi-card
          label="Hora Pico"
          [value]="peakHourValue()"
          format="integer"
          icon="schedule"
          accentColor="#F472B6"
          [subtitle]="peakHourSubtitle()"
        />
        <app-kpi-card
          label="Día Pico"
          [value]="peakDayValue()"
          format="currency"
          icon="event"
          accentColor="#14B8A6"
          [subtitle]="peakDaySubtitle()"
        />
      </div>

      <div class="report-grid">
        <!-- Ventas Registradas -->
        <div class="card">
          <h3><mat-icon>receipt_long</mat-icon> Ventas Registradas</h3>

          @if (summary()!.sales.length === 0) {
            <p class="empty-text muted">No hay ventas en este período.</p>
          } @else {
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Ticket</th>
                    <th>Fecha</th>
                    <th>Vendedor</th>
                    <th>Productos</th>
                    <th class="right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  @for (s of pagedSales(); track s.id) {
                    <tr>
                      <td><code class="ticket-code">{{ shortTicket(s.ticketCode) }}</code></td>
                      <td>{{ s.createdAt | date:'dd/MM HH:mm' }}</td>
                      <td>
                        <div class="seller-cell">
                          <span class="seller-avatar">{{ sellerInitials(s.user?.fullName) }}</span>
                          <span class="seller-name">{{ s.user?.fullName ?? '—' }}</span>
                        </div>
                      </td>
                      <td>{{ s.items.length }} item{{ s.items.length === 1 ? '' : 's' }}</td>
                      <td class="right"><strong>{{ s.total | currency:'S/ ':'symbol':'1.2-2' }}</strong></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>

            @if (totalPages() > 1) {
              <div class="pagination">
                <button mat-icon-button (click)="prevPage()" [disabled]="page() === 1">
                  <mat-icon>chevron_left</mat-icon>
                </button>
                <span class="page-info">Página {{ page() }} de {{ totalPages() }} ({{ summary()!.sales.length }} ventas)</span>
                <button mat-icon-button (click)="nextPage()" [disabled]="page() === totalPages()">
                  <mat-icon>chevron_right</mat-icon>
                </button>
              </div>
            }
          }
        </div>

        <!-- Top Sucursales (solo si vista global) -->
        @if (summary()!.topBranches.length > 0) {
          <div class="card">
            <h3><mat-icon>store</mat-icon> Top Sucursales</h3>
            <div class="branch-rank">
              @for (b of summary()!.topBranches; track b.branchId; let i = $index) {
                <div class="rank-row">
                  <span class="rank-pos" [class.gold]="i === 0" [class.silver]="i === 1" [class.bronze]="i === 2">
                    #{{ i + 1 }}
                  </span>
                  <span class="rank-name">{{ b.branchName }}</span>
                  <strong class="rank-total">{{ b.total | currency:'S/ ':'symbol':'1.2-2' }}</strong>
                </div>
              }
            </div>
          </div>
        }

        <!-- Top Productos vendidos -->
        <div class="card">
          <h3><mat-icon>star</mat-icon> Top Productos vendidos</h3>
          @if (summary()!.topProducts.length === 0) {
            <p class="empty-text muted">Sin ventas en este periodo.</p>
          } @else {
            <div class="rank-list">
              @for (p of summary()!.topProducts; track p.recipeId; let i = $index) {
                <div class="rank-row">
                  <span class="rank-pos" [class.gold]="i === 0" [class.silver]="i === 1" [class.bronze]="i === 2">
                    #{{ i + 1 }}
                  </span>
                  <div class="rank-info">
                    <strong>{{ p.name }}</strong>
                    <span class="muted small">{{ p.quantity }} unidad{{ p.quantity === 1 ? '' : 'es' }}</span>
                  </div>
                  <strong class="rank-total">{{ p.revenue | currency:'S/ ':'symbol':'1.2-2' }}</strong>
                </div>
              }
            </div>
          }
        </div>

        <!-- Top Insumos por consumo -->
        <div class="card">
          <h3><mat-icon>local_grocery_store</mat-icon> Top Insumos consumidos</h3>
          @if (summary()!.topConsumedIngredients.length === 0) {
            <p class="empty-text muted">Sin consumo registrado (producciones / mermas).</p>
          } @else {
            <div class="rank-list">
              @for (i of summary()!.topConsumedIngredients; track i.ingredientId; let idx = $index) {
                <div class="rank-row">
                  <span class="rank-pos" [class.gold]="idx === 0" [class.silver]="idx === 1" [class.bronze]="idx === 2">
                    #{{ idx + 1 }}
                  </span>
                  <div class="rank-info">
                    <strong>{{ i.name }}</strong>
                    <span class="muted small">{{ i.quantity | number:'1.0-2' }} {{ unitShort(i.unit) }}</span>
                  </div>
                  <strong class="rank-total warn-color">{{ i.cost | currency:'S/ ':'symbol':'1.2-2' }}</strong>
                </div>
              }
            </div>
          }
        </div>

        <!-- Insumos críticos -->
        <div class="card span-2">
          <h3><mat-icon class="warn-icon">warning</mat-icon> Insumos críticos (stock ≤ mínimo)</h3>
          @if (summary()!.criticalIngredients.length === 0) {
            <p class="empty-text muted">Todo en orden. Ningún insumo bajo del mínimo.</p>
          } @else {
            <div class="alert-banner">
              <mat-icon>error_outline</mat-icon>
              <span>
                Tienes <strong>{{ summary()!.criticalIngredients.length }}</strong>
                insumo{{ summary()!.criticalIngredients.length === 1 ? '' : 's' }}
                bajo del mínimo. Reponer urgente para no parar producción.
              </span>
            </div>
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Insumo</th>
                    <th class="right">Stock actual</th>
                    <th class="right">Stock mínimo</th>
                    <th class="right">% sobre mínimo</th>
                    <th class="right">Valor en stock</th>
                  </tr>
                </thead>
                <tbody>
                  @for (c of summary()!.criticalIngredients; track c.id) {
                    <tr>
                      <td><strong>{{ c.name }}</strong></td>
                      <td class="right warn-color"><strong>{{ c.stock | number:'1.0-2' }} {{ unitShort(c.unit) }}</strong></td>
                      <td class="right">{{ c.minStock | number:'1.0-2' }} {{ unitShort(c.unit) }}</td>
                      <td class="right">
                        <span class="badge"
                          [class.danger]="criticalRatio(c) < 50"
                          [class.warning]="criticalRatio(c) >= 50">
                          {{ criticalRatio(c) | number:'1.0-0' }}%
                        </span>
                      </td>
                      <td class="right">{{ c.stock * c.cost | currency:'S/ ':'symbol':'1.2-2' }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>

        <!-- Tendencia de costos -->
        <div class="card span-2">
          <h3><mat-icon>trending_up</mat-icon> Tendencia de costos</h3>

          @if (summary()!.costTrend.dailySpend.length === 0 && summary()!.costTrend.priceChanges.length === 0) {
            <p class="empty-text muted">Sin compras registradas en el periodo.</p>
          } @else {
            <div class="cost-trend-grid">
              <!-- Gasto en compras por día (barra simple CSS) -->
              <div>
                <h4 class="sub-h">Gasto en compras por día</h4>
                @if (summary()!.costTrend.dailySpend.length === 0) {
                  <p class="empty-text muted small">Sin compras este periodo.</p>
                } @else {
                  <div class="spend-chart">
                    @for (d of summary()!.costTrend.dailySpend; track d.date) {
                      <div class="spend-bar-row">
                        <span class="spend-date">{{ d.date | date:'dd/MM' }}</span>
                        <div class="spend-bar-wrapper">
                          <div class="spend-bar" [style.width.%]="spendBarWidth(d.total)"></div>
                        </div>
                        <strong class="spend-total">{{ d.total | currency:'S/ ':'symbol':'1.2-2' }}</strong>
                      </div>
                    }
                  </div>
                  <div class="total-spend">
                    Total: <strong>{{ totalDailySpend() | currency:'S/ ':'symbol':'1.2-2' }}</strong>
                  </div>
                }
              </div>

              <!-- Cambios de precio (CPP) -->
              <div>
                <h4 class="sub-h">Cambios de CPP en el periodo</h4>
                @if (summary()!.costTrend.priceChanges.length === 0) {
                  <p class="empty-text muted small">Ningún insumo cambió de precio.</p>
                } @else {
                  <div class="table-wrapper">
                    <table class="data-table compact">
                      <thead>
                        <tr>
                          <th>Insumo</th>
                          <th class="right">CPP inicial</th>
                          <th class="right">CPP final</th>
                          <th class="right">Cambio</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (p of summary()!.costTrend.priceChanges; track p.ingredientId) {
                          <tr>
                            <td><strong>{{ p.name }}</strong></td>
                            <td class="right">S/ {{ p.oldCpp | number:'1.2-4' }}</td>
                            <td class="right">S/ {{ p.newCpp | number:'1.2-4' }}</td>
                            <td class="right">
                              <span class="delta" [class.up]="p.deltaPercent > 0" [class.down]="p.deltaPercent < 0">
                                {{ p.deltaPercent > 0 ? '▲' : '▼' }}
                                {{ p.deltaPercent | number:'1.1-1' }}%
                              </span>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            </div>
          }
        </div>

        <!-- Mermas Registradas -->
        <div class="card span-2">
          <h3><mat-icon>delete</mat-icon> Mermas Registradas</h3>
          @if (summary()!.wasteLogs.length === 0) {
            <p class="empty-text muted">Sin mermas en este período.</p>
          } @else {
            <div class="table-wrapper">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Insumo / Producto</th>
                    <th>Tipo</th>
                    <th>Cantidad</th>
                    <th>Fecha</th>
                    <th class="right">Costo</th>
                  </tr>
                </thead>
                <tbody>
                  @for (w of summary()!.wasteLogs; track w.id) {
                    <tr>
                      <td><strong>{{ w.ingredient?.name ?? w.recipe?.name ?? '—' }}</strong></td>
                      <td><span class="badge">{{ w.type === 'INGREDIENT' ? 'Insumo' : 'Producto' }}</span></td>
                      <td>{{ w.quantity | number:'1.0-3' }}</td>
                      <td>{{ w.createdAt | date:'dd/MM HH:mm' }}</td>
                      <td class="right warn-color"><strong>-{{ w.cost | currency:'S/ ':'symbol':'1.2-2' }}</strong></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </div>
      </div>
    }
  `,
  styles: [`
    .period-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
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
    .period-bar .label {
      font-size: 12px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .period-range {
      margin-left: auto;
      font-size: 13px;
      color: #64748B;
    }

    .report-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 16px;
    }
    .span-2 { grid-column: span 2; }
    .card { padding: 20px; }
    .card h3 {
      margin: 0 0 12px 0;
      font-size: 16px;
      font-weight: 700;
      color: #1E293B;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .card h3 mat-icon { color: #6366F1; }
    .muted { color: #94A3B8; }
    .empty-text { padding: 24px 0; text-align: center; font-size: 13px; margin: 0; }

    .table-wrapper { overflow-x: auto; }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .data-table th {
      text-align: left;
      padding: 10px 12px;
      background: #F8FAFC;
      color: #475569;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-bottom: 1px solid #E2E8F0;
    }
    .data-table td {
      padding: 10px 12px;
      border-bottom: 1px solid #F1F5F9;
      color: #1E293B;
    }
    .data-table .right { text-align: right; }
    .warn-color { color: #DC2626; }
    .ticket-code {
      background: #F1F5F9;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
    }

    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      background: #EEF2FF;
      color: #4F46E5;
      font-size: 11px;
      font-weight: 600;
    }

    .pagination {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding-top: 12px;
    }
    .page-info { font-size: 13px; color: #64748B; }

    .branch-rank { display: flex; flex-direction: column; gap: 4px; }
    .rank-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 0;
      border-bottom: 1px solid #F1F5F9;
    }
    .rank-row:last-child { border-bottom: none; }
    .rank-pos {
      width: 32px; height: 32px;
      border-radius: 50%;
      background: #F1F5F9;
      color: #64748B;
      display: flex; align-items: center; justify-content: center;
      font-size: 12px; font-weight: 700;
    }
    .rank-pos.gold   { background: #FEF3C7; color: #D97706; }
    .rank-pos.silver { background: #E2E8F0; color: #475569; }
    .rank-pos.bronze { background: #FFEDD5; color: #C2410C; }
    .rank-name { flex: 1; font-size: 14px; color: #1E293B; font-weight: 500; }
    .rank-total { color: #059669; font-size: 14px; }

    .loading, .empty {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 64px;
      gap: 12px;
      color: #64748B;
    }
    .empty mat-icon { font-size: 48px; width: 48px; height: 48px; color: #CBD5E1; }
    .empty p { margin: 0; }

    /* ─── Rankings (Top Productos / Top Insumos) ─── */
    .rank-list { display: flex; flex-direction: column; }
    .rank-info { flex: 1; display: flex; flex-direction: column; gap: 2px; min-width: 0; }
    .rank-info strong { font-size: 14px; color: #1E293B; }

    /* ─── Banner de alerta para insumos críticos ─── */
    .alert-banner {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 14px;
      background: #FEF2F2;
      border: 1px solid #FCA5A5;
      border-radius: 8px;
      color: #B91C1C;
      font-size: 13px;
      margin-bottom: 12px;
    }
    .alert-banner strong { color: #991B1B; }
    .alert-banner mat-icon { color: #DC2626; flex-shrink: 0; }
    .warn-icon { color: #DC2626 !important; }

    /* ─── Badges del % sobre mínimo ─── */
    .badge.danger { background: #FEE2E2; color: #B91C1C; }
    .badge.warning { background: #FEF3C7; color: #92400E; }

    /* ─── Tendencia de costos ─── */
    .cost-trend-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
    }
    @media (max-width: 900px) {
      .cost-trend-grid { grid-template-columns: 1fr; }
    }
    .sub-h {
      margin: 0 0 10px 0;
      font-size: 13px;
      font-weight: 700;
      color: #64748B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* Mini-chart de barras CSS para el gasto diario */
    .spend-chart {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 280px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .spend-chart::-webkit-scrollbar { width: 6px; }
    .spend-chart::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
    .spend-bar-row {
      display: grid;
      grid-template-columns: 50px 1fr 90px;
      gap: 8px;
      align-items: center;
      font-size: 12px;
    }
    .spend-date { color: #64748B; font-weight: 600; }
    .spend-bar-wrapper {
      height: 18px;
      background: #F1F5F9;
      border-radius: 4px;
      overflow: hidden;
    }
    .spend-bar {
      height: 100%;
      background: linear-gradient(90deg, #6366F1, #4648d4);
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .spend-total { text-align: right; font-size: 12px; color: #1E293B; }
    .total-spend {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid #E2E8F0;
      text-align: right;
      font-size: 13px;
      color: #64748B;
    }
    .total-spend strong { font-size: 15px; color: #4648d4; }

    /* Celda del vendedor con avatar circular indigo */
    .seller-cell {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }
    .seller-avatar {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      background: #EEF2FF;
      color: #4648d4;
      font-size: 11px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .seller-name {
      color: #1E293B;
      font-size: 13px;
    }

    /* Tabla compacta para cambios de CPP */
    .data-table.compact th, .data-table.compact td { padding: 8px 10px; font-size: 12px; }
    .delta { font-weight: 700; font-size: 12px; }
    .delta.up { color: #DC2626; }
    .delta.down { color: #059669; }
  `],
})
export class ReportsComponent implements OnInit {
  filter = signal<DateFilter>('month');
  page = signal(1);
  downloading = signal(false);
  pageSize = 10;

  summary = computed(() => this.reports.summary());

  totalPages = computed(() => {
    const total = this.summary()?.sales.length ?? 0;
    return Math.max(1, Math.ceil(total / this.pageSize));
  });

  pagedSales = computed(() => {
    const sales = this.summary()?.sales ?? [];
    const start = (this.page() - 1) * this.pageSize;
    return sales.slice(start, start + this.pageSize);
  });

  /** Subtítulo del KPI de Valor de Inventario — incluye conteo total y críticos
   *  para dar contexto adicional sin ocupar otra tarjeta. */
  inventoryKpiSubtitle = computed(() => {
    const k = this.inventory.kpis();
    if (k.total === 0) return 'Sin insumos registrados';
    const critical = k.criticalCount;
    const totals = `${k.total} insumo${k.total === 1 ? '' : 's'}`;
    if (critical === 0) return `${totals} · Todo en orden`;
    return `${totals} · ${critical} crítico${critical === 1 ? '' : 's'}`;
  });

  // ── Helpers para Hora Pico ─────────────────────────────────────────────────
  peakHourValue = computed(() => this.summary()?.peakHour?.sales ?? 0);

  peakHourSubtitle = computed(() => {
    const p = this.summary()?.peakHour;
    if (!p) return 'Sin ventas en el periodo';
    const start = p.hour.toString().padStart(2, '0');
    const end = ((p.hour + 1) % 24).toString().padStart(2, '0');
    return `${start}:00 - ${end}:00 · S/ ${p.revenue.toFixed(2)}`;
  });

  // ── Helpers para Día Pico ──────────────────────────────────────────────────
  peakDayValue = computed(() => this.summary()?.peakDay?.revenue ?? 0);

  peakDaySubtitle = computed(() => {
    const p = this.summary()?.peakDay;
    if (!p) return 'Sin ventas en el periodo';
    const d = new Date(p.date);
    const days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const dayName = days[d.getDay()];
    return `${dayName} ${d.getDate()}/${d.getMonth() + 1} · ${p.sales} ventas`;
  });

  // ── Helpers para tabla de Insumos Críticos ────────────────────────────────
  /** % del stock actual sobre el mínimo. <50% = peligro, 50-99% = warning. */
  criticalRatio(c: { stock: number; minStock: number }): number {
    if (c.minStock <= 0) return 0;
    return Math.round((c.stock / c.minStock) * 100);
  }

  unitShort(u: string): string {
    const map: Record<string, string> = { KG: 'kg', G: 'g', L: 'l', ML: 'ml', UNIT: 'u' };
    return map[u] ?? u;
  }

  /** Iniciales del vendedor para el avatar circular en la tabla de ventas. */
  sellerInitials(fullName: string | undefined): string {
    if (!fullName) return '?';
    return fullName
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() ?? '')
      .join('');
  }

  // ── Helpers para gráfico de gasto en compras (barras CSS) ─────────────────
  totalDailySpend = computed(() => {
    const arr = this.summary()?.costTrend.dailySpend ?? [];
    return arr.reduce((s, d) => s + d.total, 0);
  });

  /** Ancho relativo (%) de cada barra según el máximo del periodo. */
  spendBarWidth(value: number): number {
    const arr = this.summary()?.costTrend.dailySpend ?? [];
    const max = arr.reduce((m, d) => Math.max(m, d.total), 0);
    return max > 0 ? Math.max(2, (value / max) * 100) : 0;
  }

  constructor(
    public reports: ReportsService,
    public inventory: InventoryService,
    private branchService: BranchService,
    private authService: AuthService,
    private snack: MatSnackBar
  ) { }

  async ngOnInit(): Promise<void> {
    if (this.authService.role() === 'OWNER') {
      await this.branchService.loadBranches();
    }
    // El reporte (sales/waste por periodo) y el inventario (valor actual, no
    // depende del periodo) se cargan en paralelo para no perder tiempo.
    await Promise.all([
      this.reports.load(this.filter()),
      this.inventory.load(),
    ]);
  }

  async setFilter(f: DateFilter): Promise<void> {
    this.filter.set(f);
    this.page.set(1);
    await this.reports.load(f);
  }

  shortTicket(code: string): string {
    return code.slice(0, 8);
  }

  prevPage(): void {
    if (this.page() > 1) this.page.update((p) => p - 1);
  }
  nextPage(): void {
    if (this.page() < this.totalPages()) this.page.update((p) => p + 1);
  }

  async downloadCsv(): Promise<void> {
    this.downloading.set(true);
    try {
      await this.reports.exportCsv(this.filter());
      this.snack.open('Reporte CSV generado', 'OK', { duration: 2500 });
    } catch (e: unknown) {
      this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
    } finally {
      this.downloading.set(false);
    }
  }
}
