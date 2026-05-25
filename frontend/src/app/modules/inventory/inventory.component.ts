import { Component, OnInit, computed, effect, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton/skeleton.component';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { IngredientFormDialogComponent } from './ingredient-form-dialog.component';
import { PurchaseDialogComponent } from './purchase-dialog.component';
import { CountDialogComponent } from './count-dialog.component';
import { InventoryService, IngredientPayload } from '../../core/services/inventory.service';
import { AuthService } from '../../core/services/auth.service';
import { BranchService } from '../../core/services/branch.service';
import { SettingsService } from '../../core/services/settings.service';
import { Ingredient, MeasureUnit } from '../../core/models';
import { formatStockBreakdown } from '../../core/utils/units';
import { getErrorMessage } from '../../core/utils/error-message';

type IngredientRow = Ingredient & { branch?: { id: string; name: string } | null };

const UNIT_LABEL: Record<MeasureUnit, string> = {
  KG: 'kg', G: 'g', L: 'l', ML: 'ml', UNIT: 'u',
};

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CurrencyPipe, DecimalPipe,
    MatButtonModule, MatIconModule, MatTooltipModule, MatFormFieldModule,
    MatInputModule, MatProgressSpinnerModule,
    KpiCardComponent, SkeletonComponent,
  ],
  template: `
    <div class="page-header">
      <div>
        <h2>Inventario</h2>
        <p class="page-subtitle">Gestión general de insumos y existencias.</p>
      </div>
      @if (canEdit()) {
        <button
          mat-flat-button
          color="primary"
          (click)="openForm(null)"
          [matTooltip]="isGlobalView() ? 'Se asignará a la primera sucursal disponible' : ''"
        >
          <mat-icon>add</mat-icon> Agregar Insumo
        </button>
      }
    </div>

    @if (isGlobalView()) {
      <div class="info-banner">
        <mat-icon>info</mat-icon>
        <div>
          <strong>Vista global activa</strong>
          <p>Estás viendo los insumos de todas las sucursales. Al crear o editar, se usará la sucursal asociada al insumo (o la primera disponible para nuevos).</p>
        </div>
      </div>
    }

    <!-- KPIs -->
    <div class="kpi-grid">
      <app-kpi-card
        label="Valor Total"
        [value]="kpis().totalValue"
        format="currency"
        icon="account_balance_wallet"
        accentColor="#4648d4"
      />
      <app-kpi-card
        label="Insumos Críticos"
        [value]="kpis().criticalCount"
        format="integer"
        icon="warning_amber"
        accentColor="#dc2626"
        [subtitle]="kpis().criticalCount === 0 ? 'Todo en orden' : 'por debajo del mínimo'"
      />
      <app-kpi-card
        label="Total de Insumos"
        [value]="kpis().total"
        format="integer"
        icon="category"
        accentColor="#645efb"
      />
    </div>

    <!-- Filtros / Búsqueda -->
    <div class="toolbar card">
      <div class="custom-search">
        <mat-icon>search</mat-icon>
        <input [ngModel]="search()" (ngModelChange)="search.set($event)" placeholder="Buscar insumo por nombre..." />
      </div>

      <button mat-stroked-button (click)="reload()">
        <mat-icon>refresh</mat-icon> Actualizar
      </button>
    </div>

    <!-- Tabla -->
    <div class="card table-card">
      @if (loading()) {
        <div class="skeleton-rows">
          @for (i of [1,2,3,4,5]; track i) {
            <div class="skeleton-row">
              <app-skeleton variant="text" width="35%" />
              <app-skeleton variant="text" width="20%" />
              <app-skeleton variant="text" width="15%" />
              <app-skeleton variant="text" width="15%" />
              <app-skeleton variant="text" width="15%" />
            </div>
          }
        </div>
      } @else if (filtered().length === 0) {
        <div class="empty">
          <mat-icon>inventory_2</mat-icon>
          <p>No hay insumos registrados{{ search() ? ' que coincidan con la búsqueda' : '' }}.</p>
          @if (canEdit() && !search() && !isGlobalView()) {
            <button mat-flat-button color="primary" (click)="openForm(null)">
              <mat-icon>add</mat-icon> Crear el primero
            </button>
          }
        </div>
      } @else {
        <div class="table-wrapper">
          <table class="data-table">
            <thead>
              <tr>
                <th>Nombre</th>
                @if (isGlobalView()) { <th>Sucursal</th> }
                <th>Presentación</th>
                <th>Stock Actual</th>
                <th>Stock Mínimo</th>
                @if (showCosts()) {
                  <th>Costo por Presentación</th>
                  <th>Valor Total</th>
                }
                <th class="actions-col">Acciones</th>
              </tr>
            </thead>
            <tbody>
              @for (i of filtered(); track i.id) {
                <tr [class.critical]="i.isCritical">
                  <td>
                    <div class="name-cell">
                      @if (i.isCritical) {
                        <mat-icon class="warn-icon" matTooltip="Stock crítico">warning</mat-icon>
                      }
                      <span>{{ i.name }}</span>
                    </div>
                  </td>
                  @if (isGlobalView()) {
                    <td><span class="branch-tag">{{ i.branch?.name ?? '—' }}</span></td>
                  }
                  <td>{{ i.presentationSize | number:'1.0-3' }} {{ unitLabel(i.unit) }}</td>
                  <td>
                    <strong>{{ stockDisplay(i) }}</strong>
                    <div class="muted-small">{{ stockPresentations(i) | number:'1.0-2' }} presentaciones</div>
                  </td>
                  <td>
                    {{ minStockDisplay(i) }}
                    <div class="muted-small">{{ minStockPresentations(i) | number:'1.0-2' }} presentaciones</div>
                  </td>
                  @if (showCosts()) {
                    <td>{{ costPerPresentation(i) | currency:'S/ ':'symbol':'1.2-2' }}</td>
                    <td><strong>{{ i.totalValue | currency:'S/ ':'symbol':'1.2-2' }}</strong></td>
                  }
                  <td class="actions-col">
                    @if (canEdit()) {
                      <button mat-icon-button (click)="openPurchase(i)" matTooltip="Registrar compra (suma stock y actualiza CPP)">
                        <mat-icon style="color: #059669">shopping_cart</mat-icon>
                      </button>
                      <button mat-icon-button (click)="openCount(i)" matTooltip="Conteo físico (genera merma automática si hay faltante)">
                        <mat-icon style="color: #6366F1">fact_check</mat-icon>
                      </button>
                      <button mat-icon-button (click)="openForm(i)" matTooltip="Editar">
                        <mat-icon>edit</mat-icon>
                      </button>
                      <button mat-icon-button (click)="confirmDelete(i)" matTooltip="Eliminar">
                        <mat-icon color="warn">delete</mat-icon>
                      </button>
                    } @else {
                      <span class="muted">—</span>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
  styles: [`
    .toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px;
      margin-bottom: 16px;
    }
    .custom-search {
      display: flex;
      align-items: center;
      gap: 8px;
      background: var(--color-surface);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-sm);
      padding: 8px 16px;
      flex: 1;
      max-width: 360px;
      transition: all 0.2s;
    }
    .custom-search:focus-within {
      border-color: var(--color-primary);
      box-shadow: 0 0 0 2px var(--color-surface-container-high);
    }
    .custom-search mat-icon {
      color: var(--color-on-surface-variant);
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    .custom-search input {
      border: none;
      outline: none;
      background: transparent;
      font-size: 14px;
      width: 100%;
      color: var(--color-on-surface);
    }

    .table-card { padding: 0; overflow: hidden; }
    .table-wrapper { overflow-x: auto; }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .data-table th {
      text-align: left;
      padding: 14px 20px;
      background: var(--color-surface-low);
      color: var(--color-text-secondary);
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-bottom: 1px solid var(--color-border);
    }
    .data-table td {
      padding: 16px 20px;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-text);
      font-size: 14px;
    }
    .data-table tr:hover td { background: var(--color-surface-low); }
    .data-table tr.critical td { background: rgba(220, 38, 38, 0.04); }
    .data-table tr.critical:hover td { background: rgba(220, 38, 38, 0.08); }

    .name-cell { display: flex; align-items: center; gap: 8px; }
    .warn-icon { color: #DC2626; font-size: 18px; width: 18px; height: 18px; }
    .actions-col { text-align: right; width: 200px; white-space: nowrap; }
    .muted { color: #94A3B8; }

    .loading, .empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 64px 16px;
      gap: 12px;
      color: #64748B;
    }
    .empty mat-icon { font-size: 48px; width: 48px; height: 48px; color: #CBD5E1; }
    .empty p { margin: 0; }

    .info-banner {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 16px;
      background: #EEF2FF;
      border: 1px solid #C7D2FE;
      border-radius: 10px;
      margin-bottom: 16px;
      color: #3730A3;
    }
    .info-banner mat-icon { color: #4F46E5; flex-shrink: 0; }
    .info-banner strong { font-size: 14px; color: #1E1B4B; }
    .info-banner p { margin: 4px 0 0 0; font-size: 13px; color: #4338CA; }

    .branch-tag {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      background: #EEF2FF;
      color: #4F46E5;
      font-size: 12px;
      font-weight: 600;
    }

    .unit-tag {
      color: #94A3B8;
      font-size: 12px;
      font-weight: 500;
    }

    .muted-small {
      color: #94A3B8;
      font-size: 11px;
      font-weight: 500;
      margin-top: 2px;
    }

    /* Loading skeleton: simula filas de tabla mientras carga */
    .skeleton-rows {
      display: flex;
      flex-direction: column;
      padding: 0;
    }
    .skeleton-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 18px 20px;
      border-bottom: 1px solid var(--color-border);
    }
    .skeleton-row:last-child { border-bottom: none; }
    .skeleton-row app-skeleton { flex-shrink: 0; }
  `],
})
export class InventoryComponent implements OnInit {
  search = signal('');
  loading = this.inventoryService.loading;
  kpis = this.inventoryService.kpis;

  filtered = computed<IngredientRow[]>(() => {
    const term = this.search().trim().toLowerCase();
    const list = this.inventoryService.ingredients() as IngredientRow[];
    if (!term) return list;
    return list.filter((i) => i.name.toLowerCase().includes(term));
  });

  canEdit = computed(() => {
    const role = this.authService.role();
    // INVENTORY también puede gestionar insumos (es su área).
    return role === 'OWNER' || role === 'MANAGER' || role === 'INVENTORY';
  });

  /** True solo si el OWNER no tiene una sucursal seleccionada (vista global). */
  isGlobalView = computed(
    () => this.authService.role() === 'OWNER' && !this.branchService.selectedBranchId()
  );

  /**
   * Mostrar costos:
   * - OWNER y MANAGER siempre los ven.
   * - SELLER / INVENTORY: solo si la configuración global del negocio NO oculta costos.
   */
  showCosts = computed(() => {
    const role = this.authService.role();
    if (role === 'OWNER' || role === 'MANAGER') return true;
    return !(this.settings.business()?.hideIngredientCosts ?? false);
  });

  private branchInitialized = false;

  constructor(
    private inventoryService: InventoryService,
    private branchService: BranchService,
    private authService: AuthService,
    private settings: SettingsService,
    private dialog: MatDialog,
    private snack: MatSnackBar
  ) {
    // Recargar cuando el OWNER cambia de sucursal en el header.
    // Saltamos el primer fire para no duplicar el load que ya hace ngOnInit.
    effect(() => {
      this.branchService.selectedBranchId(); // tracking
      if (!this.branchInitialized) {
        this.branchInitialized = true;
        return;
      }
      void this.reload();
    }, { allowSignalWrites: true });
  }

  async ngOnInit(): Promise<void> {
    if (this.authService.role() === 'OWNER') {
      await this.branchService.loadBranches();
    }
    if (!this.settings.business()) {
      await this.settings.loadBusiness();
    }
    await this.reload();
  }

  unitLabel(u: MeasureUnit): string {
    return UNIT_LABEL[u];
  }

  /** Convierte el stock interno (en unidad base) a número de presentaciones. */
  stockPresentations(i: IngredientRow): number {
    return i.presentationSize > 0 ? i.stock / i.presentationSize : 0;
  }

  /** Convierte el stock mínimo a presentaciones. */
  minStockPresentations(i: IngredientRow): number {
    return i.presentationSize > 0 ? i.minStock / i.presentationSize : 0;
  }

  /** Convierte el costo unitario (por unidad base) a costo por presentación. */
  costPerPresentation(i: IngredientRow): number {
    return i.unitCost * i.presentationSize;
  }

  /** Stock principal en lenguaje natural: "39 kg y 500 g", "8 kg", "300 ml", etc. */
  stockDisplay(i: IngredientRow): string {
    return formatStockBreakdown(i.stock, i.unit);
  }

  /** Stock mínimo en lenguaje natural — mismo formato que stockDisplay. */
  minStockDisplay(i: IngredientRow): string {
    return formatStockBreakdown(i.minStock, i.unit);
  }

  async reload(): Promise<void> {
    try {
      await this.inventoryService.load();
    } catch (e: unknown) {
      this.snack.open(getErrorMessage(e, 'Error al cargar inventario'), 'OK', { duration: 4000 });
    }
  }

  /**
   * Asegura que haya una sucursal seleccionada antes de operaciones de escritura.
   * - Si ya hay sucursal seleccionada (no global), no hace nada.
   * - Si está en global view, intenta usar la sucursal del recurso (ingredient.branch.id)
   *   o, si no hay, autoselecciona la primera sucursal disponible.
   * Devuelve `true` si quedó lista una sucursal, `false` si no es posible continuar.
   */
  private async ensureBranchSelected(forIngredient?: IngredientRow | null): Promise<boolean> {
    if (!this.isGlobalView()) return true;

    // Preferir la sucursal del propio insumo cuando estamos editando una fila
    const branchId = forIngredient?.branch?.id ?? this.branchService.branches()[0]?.id;
    if (!branchId) {
      this.snack.open('No hay sucursales disponibles. Crea una en Configuración primero.', 'OK', { duration: 4000 });
      return false;
    }
    this.branchService.selectBranch(branchId);
    const branchName = this.branchService.branches().find((b) => b.id === branchId)?.name ?? 'sucursal';
    this.snack.open(`Trabajando en sucursal: ${branchName}`, 'OK', { duration: 2500 });
    return true;
  }

  async openPurchase(ingredient: IngredientRow): Promise<void> {
    if (!(await this.ensureBranchSelected(ingredient))) return;
    const ref = this.dialog.open(PurchaseDialogComponent, {
      data: { ingredient },
      disableClose: true,
    });

    ref.afterClosed().subscribe((registered) => {
      if (registered) {
        // Recargar para reflejar stock y CPP actualizados
        void this.reload();
      }
    });
  }

  async openCount(ingredient: IngredientRow): Promise<void> {
    if (!(await this.ensureBranchSelected(ingredient))) return;
    const ref = this.dialog.open(CountDialogComponent, {
      data: { ingredient },
      disableClose: true,
    });

    ref.afterClosed().subscribe((registered) => {
      if (registered) {
        // Recargar para reflejar el ajuste de stock
        void this.reload();
      }
    });
  }

  async openForm(ingredient: IngredientRow | null): Promise<void> {
    if (!(await this.ensureBranchSelected(ingredient))) return;
    const ref = this.dialog.open(IngredientFormDialogComponent, {
      data: { ingredient },
      disableClose: true,
    });

    ref.afterClosed().subscribe(async (payload: IngredientPayload | undefined) => {
      if (!payload) return;
      try {
        if (ingredient) {
          await this.inventoryService.update(ingredient.id, payload);
          this.snack.open('Insumo actualizado', 'OK', { duration: 2500 });
        } else {
          await this.inventoryService.create(payload);
          this.snack.open('Insumo creado', 'OK', { duration: 2500 });
        }
      } catch (e: unknown) {
        this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
      }
    });
  }

  async confirmDelete(i: IngredientRow): Promise<void> {
    if (!(await this.ensureBranchSelected(i))) return;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar insumo',
        message: `¿Seguro que quieres eliminar "${i.name}"? Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        danger: true,
      },
    });

    ref.afterClosed().subscribe(async (ok: boolean) => {
      if (!ok) return;
      try {
        await this.inventoryService.remove(i.id);
        this.snack.open('Insumo eliminado', 'OK', { duration: 2500 });
      } catch (e: unknown) {
        this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
      }
    });
  }
}
