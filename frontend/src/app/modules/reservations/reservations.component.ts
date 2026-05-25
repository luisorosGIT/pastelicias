import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ReservationsService, ReservationPayload } from '../../core/services/reservations.service';
import { RecipesService } from '../../core/services/recipes.service';
import { BranchService } from '../../core/services/branch.service';
import { AuthService } from '../../core/services/auth.service';
import { ReservationFormDialogComponent } from './reservation-form-dialog.component';
import { Reservation, ReservationStatus } from '../../core/models';
import { getErrorMessage } from '../../core/utils/error-message';

interface KanbanColumn {
  status: ReservationStatus;
  label: string;
  color: string;
  icon: string;
}

const COLUMNS: KanbanColumn[] = [
  { status: 'PENDING',     label: 'Pendiente',  color: '#94A3B8', icon: 'hourglass_empty' },
  { status: 'CONFIRMED',   label: 'Confirmada', color: '#06B6D4', icon: 'check_circle' },
  { status: 'IN_PROCESS',  label: 'En Proceso', color: '#F59E0B', icon: 'autorenew' },
  { status: 'READY',       label: 'Listo',      color: '#10B981', icon: 'inventory_2' },
  { status: 'DELIVERED',   label: 'Entregado',  color: '#4F46E5', icon: 'check' },
];

const STATUS_ORDER: ReservationStatus[] = ['PENDING', 'CONFIRMED', 'IN_PROCESS', 'READY', 'DELIVERED'];

/** Cuántas horas se mantiene una reserva DELIVERED en su columna antes de
 *  bajar a la sección de Historial. */
const DELIVERY_KEEP_HOURS = 24;

/** A partir de cuántas tarjetas la columna entra en modo compacto (con
 *  expandir individual). 3+ = compacto, 1-2 = normal. */
const COMPACT_THRESHOLD = 2;

@Component({
  selector: 'app-reservations',
  standalone: true,
  imports: [
    CommonModule, CurrencyPipe, DatePipe,
    MatButtonModule, MatIconModule, MatTooltipModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-header">
      <div>
        <h2>Reservaciones</h2>
        <p class="page-subtitle">Gestiona los pedidos programados y su estado de producción.</p>
      </div>
      <button mat-flat-button color="primary" (click)="openForm()">
        <mat-icon>add</mat-icon> Nueva Reservación
      </button>
    </div>

    @if (reservations.loading()) {
      <div class="loading"><mat-spinner diameter="40" /></div>
    } @else {
      <div class="kanban">
        @for (col of columns; track col.status) {
          <div class="column">
            <div class="column-header" [style.--accent]="col.color">
              <mat-icon [style.color]="col.color">{{ col.icon }}</mat-icon>
              <span class="column-title">{{ col.label }}</span>
              <span class="column-count">{{ itemsForColumn(col.status).length }}</span>
            </div>

            <div class="column-body" [class.compact]="isCompactColumn(col.status)">
              @if (itemsForColumn(col.status).length === 0) {
                <div class="column-empty">Sin reservaciones</div>
              } @else {
                @for (r of itemsForColumn(col.status); track r.id) {
                  <div class="reservation-card"
                       [class.compact-card]="isCompactColumn(col.status) && !isExpanded(r.id)"
                       [style.borderLeftColor]="col.color">

                    @if (isCompactColumn(col.status) && !isExpanded(r.id)) {
                      <!-- ─── Modo compacto ─── -->
                      <button class="compact-row" (click)="toggleCard(r.id)" type="button">
                        <div class="compact-main">
                          <strong>{{ r.clientName }}</strong>
                          <span class="compact-meta">
                            @if (r.customProduct) { {{ r.customProduct }} }
                            @else { {{ recipeName(r.recipeId) }} }
                            · {{ r.deliveryDate | date:'dd/MM HH:mm' }}
                          </span>
                        </div>
                        <div class="compact-right">
                          <span class="compact-total">{{ r.totalPrice | currency:'S/ ':'symbol':'1.0-0' }}</span>
                          <mat-icon class="compact-chevron">expand_more</mat-icon>
                        </div>
                      </button>
                    } @else {
                      <!-- ─── Modo expandido (normal) ─── -->
                      @if (isCompactColumn(col.status)) {
                        <button class="collapse-btn" (click)="toggleCard(r.id)" type="button"
                                matTooltip="Colapsar">
                          <mat-icon>expand_less</mat-icon>
                        </button>
                      }

                      <div class="card-top">
                        <strong>{{ r.clientName }}</strong>
                        <span class="muted">{{ r.phone }}</span>
                      </div>

                      <div class="card-product">
                        @if (r.customProduct) {
                          <mat-icon>cake</mat-icon> <span>{{ r.customProduct }}</span>
                        } @else {
                          <mat-icon>restaurant</mat-icon> <span>{{ recipeName(r.recipeId) }}</span>
                        }
                      </div>

                      @if (r.details) {
                        <p class="card-details">{{ r.details }}</p>
                      }

                      <div class="card-meta">
                        <span><mat-icon>schedule</mat-icon> {{ r.deliveryDate | date:'dd/MM HH:mm' }}</span>
                      </div>

                      <div class="card-finance">
                        <div>
                          <span class="label">Total</span>
                          <strong>{{ r.totalPrice | currency:'S/ ':'symbol':'1.2-2' }}</strong>
                        </div>
                        <div>
                          <span class="label">Anticipo</span>
                          <strong>{{ r.advance | currency:'S/ ':'symbol':'1.2-2' }}</strong>
                        </div>
                        <div>
                          <span class="label">Saldo</span>
                          <strong>{{ (r.totalPrice - r.advance) | currency:'S/ ':'symbol':'1.2-2' }}</strong>
                        </div>
                      </div>

                      @if (nextStatus(r.status); as next) {
                        <button mat-stroked-button class="advance-btn" (click)="advance(r)">
                          <mat-icon>arrow_forward</mat-icon>
                          Mover a {{ labelOf(next) }}
                        </button>
                      }
                    }
                  </div>
                }
              }
            </div>
          </div>
        }
      </div>

      <!-- ─── Historial de entregados (>24h) ──────────────────────────────── -->
      @if (historyDelivered().length > 0) {
        <section class="history">
          <header class="history-header" (click)="historyOpen.set(!historyOpen())">
            <div class="history-title">
              <mat-icon>history</mat-icon>
              <span>Historial de entregados</span>
              <span class="history-count">{{ historyDelivered().length }}</span>
            </div>
            <mat-icon class="history-chevron" [class.open]="historyOpen()">expand_more</mat-icon>
          </header>

          @if (historyOpen()) {
            <div class="history-table">
              <div class="history-row history-row-head">
                <div>Cliente</div>
                <div>Teléfono</div>
                <div>Producto</div>
                <div>Entregado el</div>
                <div class="ta-right">Total</div>
              </div>
              @for (r of historyDelivered(); track r.id) {
                <div class="history-row">
                  <div><strong>{{ r.clientName }}</strong></div>
                  <div class="muted">{{ r.phone }}</div>
                  <div>
                    @if (r.customProduct) { {{ r.customProduct }} }
                    @else { {{ recipeName(r.recipeId) }} }
                  </div>
                  <div class="muted">{{ r.updatedAt | date:'dd/MM/yy HH:mm' }}</div>
                  <div class="ta-right"><strong>{{ r.totalPrice | currency:'S/ ':'symbol':'1.2-2' }}</strong></div>
                </div>
              }
            </div>
          }
        </section>
      }
    }
  `,
  styles: [`
    .kanban {
      display: grid;
      grid-template-columns: repeat(5, minmax(220px, 1fr));
      gap: 12px;
      overflow-x: auto;
      padding-bottom: 8px;
    }

    .column {
      background: var(--color-surface);
      border-radius: var(--radius-xl);
      display: flex;
      flex-direction: column;
      min-width: 240px;
      box-shadow: var(--shadow-2);
      border: none;
    }

    .column-header {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      border-bottom: none;
    }
    .column-title {
      font-size: 13px;
      font-weight: 700;
      color: #1E293B;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      flex: 1;
    }
    .column-count {
      background: var(--accent);
      color: #fff;
      border-radius: 12px;
      padding: 2px 10px;
      font-size: 12px;
      font-weight: 700;
    }

    .column-body {
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-height: 120px;
    }
    /* En modo compacto el padding entre tarjetas es menor para meter más en el alto */
    .column-body.compact { gap: 4px; }

    .column-empty {
      text-align: center;
      padding: 24px 8px;
      color: #94A3B8;
      font-size: 12px;
      font-style: italic;
    }

    .reservation-card {
      position: relative;
      background: var(--color-surface-low);
      border-radius: var(--radius-sm);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      border-left: 3px solid #CBD5E1;
      transition: background 0.15s ease;
    }
    .reservation-card:hover {
      background: var(--color-primary-soft);
    }
    .reservation-card.compact-card {
      padding: 0;
      gap: 0;
    }

    /* ─── Compact row ─── */
    .compact-row {
      width: 100%;
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      background: transparent;
      border: none;
      border-radius: inherit;
      cursor: pointer;
      text-align: left;
      font-family: inherit;
      transition: background 0.15s ease;
    }
    .compact-row:hover { background: rgba(99, 102, 241, 0.1); }
    .compact-row:hover .compact-chevron { color: #4F46E5; }
    .compact-main {
      flex: 1;
      min-width: 0;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .compact-main strong {
      font-size: 13.5px;
      color: #1E293B;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .compact-meta {
      font-size: 11.5px;
      color: #64748B;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .compact-right {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
    .compact-total {
      font-size: 13px;
      font-weight: 700;
      color: #4F46E5;
    }
    .compact-chevron {
      font-size: 22px; width: 22px; height: 22px;
      color: #94A3B8;
      background: rgba(148, 163, 184, 0.12);
      border-radius: 50%;
      padding: 2px;
      transition: color 0.15s ease, background 0.15s ease;
    }
    .compact-row:hover .compact-chevron {
      background: rgba(79, 70, 229, 0.12);
    }

    /* ─── Botón colapsar en modo expandido (cuando estamos en col compacta) ─── */
    .collapse-btn {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 26px; height: 26px;
      border-radius: 6px;
      border: none;
      background: rgba(148, 163, 184, 0.12);
      color: #64748B;
      cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.15s ease;
    }
    .collapse-btn:hover { background: rgba(148, 163, 184, 0.22); }
    .collapse-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }

    /* ─── Card normal (sin cambios) ─── */
    .card-top { display: flex; flex-direction: column; gap: 0; }
    .card-top strong { font-size: 14px; color: #1E293B; }
    .muted { color: #94A3B8; font-size: 12px; }

    .card-product {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #475569;
      font-weight: 500;
    }
    .card-product mat-icon {
      font-size: 16px; width: 16px; height: 16px;
      color: #6366F1;
    }

    .card-details {
      margin: 0;
      font-size: 12px;
      color: #64748B;
      background: #F8FAFC;
      padding: 6px 8px;
      border-radius: 6px;
      max-height: 60px;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .card-meta { display: flex; gap: 10px; font-size: 12px; color: #64748B; align-items: center; }
    .card-meta mat-icon { font-size: 14px; width: 14px; height: 14px; vertical-align: middle; }
    .card-meta span { display: inline-flex; align-items: center; gap: 4px; }

    .card-finance {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 6px;
      padding: 6px;
      background: #F8FAFC;
      border-radius: 6px;
    }
    .card-finance > div { display: flex; flex-direction: column; }
    .card-finance .label { font-size: 10px; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.4px; }
    .card-finance strong { font-size: 11px; color: #1E293B; }

    .advance-btn {
      width: 100%;
      margin-top: 2px;
      font-size: 12px !important;
      min-height: 32px !important;
      padding: 0 12px !important;
    }
    .advance-btn mat-icon {
      font-size: 14px; width: 14px; height: 14px;
      margin-right: 4px;
    }

    .loading {
      display: flex;
      justify-content: center;
      padding: 64px;
    }

    /* ─── Historial ─── */
    .history {
      margin-top: 32px;
      background: var(--color-surface);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-2);
      overflow: hidden;
    }
    .history-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 20px;
      cursor: pointer;
      transition: background 0.15s ease;
    }
    .history-header:hover { background: rgba(99, 102, 241, 0.05); }
    .history-title {
      display: flex; align-items: center; gap: 10px;
      font-size: 14px; font-weight: 700;
      color: #1E293B;
    }
    .history-title mat-icon { color: #64748B; }
    .history-count {
      background: #E2E8F0;
      color: #475569;
      border-radius: 12px;
      padding: 2px 10px;
      font-size: 12px;
      font-weight: 700;
    }
    .history-chevron {
      color: #94A3B8;
      transition: transform 0.2s ease;
    }
    .history-chevron.open { transform: rotate(180deg); }

    .history-table {
      border-top: 1px solid #E2E8F0;
    }
    .history-row {
      display: grid;
      grid-template-columns: 1.5fr 1fr 1.8fr 1.5fr 1fr;
      gap: 12px;
      padding: 12px 20px;
      align-items: center;
      font-size: 13px;
      border-bottom: 1px solid #F1F5F9;
    }
    .history-row:last-child { border-bottom: none; }
    .history-row-head {
      background: #F8FAFC;
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: #64748B;
    }
    .history-row-head:hover { background: #F8FAFC; }
    .history-row:not(.history-row-head):hover { background: #FAFBFF; }
    .ta-right { text-align: right; }

    @media (max-width: 720px) {
      .history-row {
        grid-template-columns: 1fr 1fr;
        gap: 8px;
        padding: 12px 16px;
      }
      .history-row > :nth-child(3),
      .history-row > :nth-child(4) {
        grid-column: 1 / -1;
        font-size: 12px;
      }
      .history-row-head { display: none; }
    }
  `],
})
export class ReservationsComponent implements OnInit {
  columns = COLUMNS;
  compactThreshold = COMPACT_THRESHOLD;

  /** IDs de las cards expandidas mientras la columna está en modo compacto. */
  expandedCards = signal<Set<string>>(new Set());

  /** Si el panel de Historial está abierto. Por defecto cerrado para no
   *  ensuciar la vista cuando crezca con muchos meses de ventas. */
  historyOpen = signal(false);

  /** Las DELIVERED recientes (< 24h desde updatedAt) que se quedan en la
   *  columna del kanban. */
  recentDelivered = computed(() =>
    this.reservations.grouped().DELIVERED.filter((r) => this.isRecentDelivery(r))
  );

  /** Las DELIVERED viejas (>= 24h) que van a la sección de Historial, ordenadas
   *  de la más reciente a la más antigua. */
  historyDelivered = computed(() =>
    this.reservations.grouped().DELIVERED
      .filter((r) => !this.isRecentDelivery(r))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  );

  constructor(
    public reservations: ReservationsService,
    private recipesService: RecipesService,
    private branchService: BranchService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snack: MatSnackBar
  ) {}

  async ngOnInit(): Promise<void> {
    if (this.authService.role() === 'OWNER') {
      await this.branchService.loadBranches();
    }
    await Promise.all([this.reservations.load(), this.recipesService.load()]);
  }

  /** Items que se muestran en la columna del kanban. DELIVERED solo muestra
   *  los recientes; el resto muestra todos. */
  itemsForColumn(status: ReservationStatus): Reservation[] {
    if (status === 'DELIVERED') return this.recentDelivered();
    return this.reservations.grouped()[status];
  }

  /** True cuando la columna tiene más items que el umbral cómodo y debe
   *  cambiar a modo compacto (cards chicas + expandir individual). */
  isCompactColumn(status: ReservationStatus): boolean {
    return this.itemsForColumn(status).length > COMPACT_THRESHOLD;
  }

  /** ¿La reservación está dentro del periodo de gracia en la columna DELIVERED? */
  private isRecentDelivery(r: Reservation): boolean {
    if (r.status !== 'DELIVERED') return true;
    if (!r.updatedAt) return true; // fallback si el backend aún no manda updatedAt
    const updatedAt = new Date(r.updatedAt).getTime();
    return Date.now() - updatedAt < DELIVERY_KEEP_HOURS * 60 * 60 * 1000;
  }

  toggleCard(id: string): void {
    this.expandedCards.update((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  isExpanded(id: string): boolean {
    return this.expandedCards().has(id);
  }

  recipeName(id: string | null): string {
    if (!id) return '—';
    return this.recipesService.recipes().find((r) => r.id === id)?.name ?? 'Producto no encontrado';
  }

  labelOf(s: ReservationStatus): string {
    return COLUMNS.find((c) => c.status === s)?.label ?? s;
  }

  nextStatus(current: ReservationStatus): ReservationStatus | null {
    const i = STATUS_ORDER.indexOf(current);
    if (i < 0 || i >= STATUS_ORDER.length - 1) return null;
    return STATUS_ORDER[i + 1];
  }

  async advance(r: Reservation): Promise<void> {
    const next = this.nextStatus(r.status);
    if (!next) return;
    // Si estamos en vista global, usar el branchId de la propia reservación
    // antes de enviar el PATCH — para que el backend pueda localizarla.
    if (this.authService.role() === 'OWNER' && !this.branchService.selectedBranchId()) {
      this.branchService.selectBranch(r.branchId);
    }
    try {
      await this.reservations.updateStatus(r.id, next);
      this.snack.open(`Reservación movida a ${this.labelOf(next)}`, 'OK', { duration: 2500 });
    } catch (e: unknown) {
      this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
    }
  }

  private async ensureBranchSelected(): Promise<boolean> {
    if (this.authService.role() !== 'OWNER' || this.branchService.selectedBranchId()) return true;
    const firstBranch = this.branchService.branches()[0];
    if (!firstBranch) {
      this.snack.open('No tienes sucursales disponibles. Crea una en Configuración.', 'OK', { duration: 4000 });
      return false;
    }
    this.branchService.selectBranch(firstBranch.id);
    this.snack.open(`Trabajando en sucursal: ${firstBranch.name}`, 'OK', { duration: 2500 });
    return true;
  }

  async openForm(): Promise<void> {
    if (!(await this.ensureBranchSelected())) return;
    const ref = this.dialog.open(ReservationFormDialogComponent, {
      data: { recipes: this.recipesService.recipes() },
      disableClose: true,
    });

    ref.afterClosed().subscribe(async (payload: ReservationPayload | undefined) => {
      if (!payload) return;
      try {
        await this.reservations.create(payload);
        this.snack.open('Reservación creada', 'OK', { duration: 2500 });
      } catch (e: unknown) {
        this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
      }
    });
  }
}
