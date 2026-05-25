import { Component, OnInit } from '@angular/core';
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
              <span class="column-count">{{ reservations.grouped()[col.status].length }}</span>
            </div>

            <div class="column-body">
              @if (reservations.grouped()[col.status].length === 0) {
                <div class="column-empty">Sin reservaciones</div>
              } @else {
                @for (r of reservations.grouped()[col.status]; track r.id) {
                  <div class="reservation-card" [style.borderLeftColor]="col.color">
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
                  </div>
                }
              }
            </div>
          </div>
        }
      </div>
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
    .column-empty {
      text-align: center;
      padding: 24px 8px;
      color: #94A3B8;
      font-size: 12px;
      font-style: italic;
    }

    .reservation-card {
      background: var(--color-surface-low);
      border-radius: var(--radius-sm);
      padding: 14px;
      display: flex;
      flex-direction: column;
      gap: 8px;
      border-left: 3px solid #CBD5E1;
      transition: all 0.15s;
    }
    .reservation-card:hover {
      background: var(--color-primary-soft);
    }

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
  `],
})
export class ReservationsComponent implements OnInit {
  columns = COLUMNS;

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
