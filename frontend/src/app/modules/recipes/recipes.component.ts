import { Component, OnInit, computed, effect, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RecipesService, RecipePayload } from '../../core/services/recipes.service';
import { InventoryService } from '../../core/services/inventory.service';
import { AuthService } from '../../core/services/auth.service';
import { BranchService } from '../../core/services/branch.service';
import { SettingsService } from '../../core/services/settings.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { RecipeFormDialogComponent } from './recipe-form-dialog.component';
import { MeasureUnit, Recipe, RecipeCategory } from '../../core/models';

const UNIT_SHORT: Record<MeasureUnit, string> = {
  KG: 'kg', G: 'g', L: 'l', ML: 'ml', UNIT: 'unidad',
};

const CATEGORY_LABELS: Record<RecipeCategory | 'ALL', string> = {
  ALL: 'Todas',
  PANADERIA: 'Panadería',
  PASTELERIA: 'Pastelería',
  BEBIDAS: 'Bebidas',
  OTROS: 'Otros',
};

const CATEGORY_COLORS: Record<RecipeCategory, string> = {
  PANADERIA: '#F59E0B',
  PASTELERIA: '#EC4899',
  BEBIDAS: '#06B6D4',
  OTROS: '#6366F1',
};

@Component({
  selector: 'app-recipes',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CurrencyPipe,
    MatButtonModule, MatIconModule, MatTooltipModule, MatFormFieldModule,
    MatInputModule, MatChipsModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-header">
      <div>
        <h2>
          Productos
          @if (!canEdit()) {
            <span class="readonly-pill" matTooltip="Tu rol no permite crear ni editar productos">
              <mat-icon>visibility</mat-icon> Solo lectura
            </span>
          }
        </h2>
        <p class="page-subtitle">Todo lo que vendes — fabricado o de reventa.</p>
      </div>
      @if (canEdit()) {
        <button
          mat-flat-button
          color="primary"
          (click)="openForm(null)"
          [matTooltip]="isGlobalView() ? 'Se asignará a la primera sucursal disponible' : ''"
        >
          <mat-icon>add</mat-icon> Nuevo Producto
        </button>
      }
    </div>

    @if (isGlobalView()) {
      <div class="info-banner">
        <mat-icon>info</mat-icon>
        <div>
          <strong>Vista global activa</strong>
          <p>Estás viendo productos de todas las sucursales. Al crear o editar, se usará la sucursal del producto (o la primera disponible para nuevos).</p>
        </div>
      </div>
    }

    <!-- Toolbar -->
    <div class="toolbar card">
      <mat-form-field appearance="outline" class="search-field">
        <mat-icon matPrefix>search</mat-icon>
        <mat-label>Buscar producto</mat-label>
        <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" />
      </mat-form-field>

      <div class="chip-row">
        @for (key of categoryKeys; track key) {
          <button
            mat-stroked-button
            class="chip"
            [class.active]="selectedCategory() === key"
            (click)="selectedCategory.set(key)"
          >
            {{ categoryLabels[key] }}
          </button>
        }
      </div>
    </div>

    @if (recipes.loading()) {
      <div class="loading"><mat-spinner diameter="40" /></div>
    } @else if (filtered().length === 0) {
      <div class="empty card">
        <mat-icon>menu_book</mat-icon>
        <p>
          {{ search() || selectedCategory() !== 'ALL'
            ? 'Ningún producto coincide con los filtros.'
            : 'Aún no has creado productos en esta sucursal.' }}
        </p>
        @if (canEdit() && !search() && selectedCategory() === 'ALL') {
          <button mat-flat-button color="primary" (click)="openForm(null)">
            <mat-icon>add</mat-icon> Crear la primera
          </button>
        }
      </div>
    } @else {
      <div class="recipe-grid">
        @for (r of filtered(); track r.id) {
          <div class="recipe-card">
            <div class="recipe-image" [style.background]="r.imageUrl ? 'transparent' : categoryColor(r.category) + '20'">
              @if (r.imageUrl) {
                <img [src]="r.imageUrl" [alt]="r.name" (error)="onImgError($event)" />
              } @else {
                <mat-icon [style.color]="categoryColor(r.category)">restaurant</mat-icon>
              }
              <span class="category-tag" [style.background]="categoryColor(r.category)">
                {{ categoryLabels[r.category] }}
              </span>
              @if (r.isResale) {
                <span class="resale-tag" matTooltip="Producto de reventa: se compra ya hecho">
                  <mat-icon>local_grocery_store</mat-icon>Reventa
                </span>
              }
              @if (r.stock <= 0) {
                <span class="oos-tag" [matTooltip]="r.isResale ? 'Sin stock. Registra una compra de reventa.' : 'Sin stock. Registra una producción.'">Sin stock</span>
              } @else {
                <span class="stock-badge" matTooltip="Unidades disponibles para vender">{{ r.stock }} disp.</span>
              }
            </div>

            <div class="recipe-body">
              <h3 class="recipe-name">{{ r.name }}</h3>
              @if (r.description) {
                <p class="recipe-desc">{{ r.description }}</p>
              }

              <div class="finance-grid" [class.no-costs]="!showCosts()">
                @if (showCosts()) {
                  <div>
                    <span class="label">Costo</span>
                    <strong>{{ (r.bomCost ?? 0) | currency:'S/ ':'symbol':'1.2-2' }}</strong>
                  </div>
                }
                <div>
                  <span class="label">Precio</span>
                  <strong>{{ r.salePrice | currency:'S/ ':'symbol':'1.2-2' }}</strong>
                </div>
                @if (showCosts()) {
                  <div class="margin-cell"
                    [class.positive]="(r.margin ?? 0) >= 30"
                    [class.warning]="(r.margin ?? 0) < 30 && (r.margin ?? 0) >= 0"
                    [class.negative]="(r.margin ?? 0) < 0">
                    <span class="label">Margen</span>
                    <strong>{{ (r.margin ?? 0).toFixed(1) }}%</strong>
                  </div>
                }
              </div>

              @if (!r.isResale) {
                <div class="bom-mini">
                  <span class="bom-count">{{ r.items.length }} insumo{{ r.items.length === 1 ? '' : 's' }}</span>
                  <details class="bom-detail">
                    <summary>Ver BOM</summary>
                    <ul>
                      @for (it of r.items; track it.id) {
                        <li>
                          <span>{{ it.ingredient.name }}</span>
                          @if (showCosts()) {
                            <span class="muted">{{ it.quantity }} × {{ it.ingredient.unitCost | currency:'S/ ':'symbol':'1.2-2' }}</span>
                          } @else {
                            <span class="muted">{{ it.quantity }} {{ unitShort(it.ingredient.unit) }}</span>
                          }
                        </li>
                      }
                    </ul>
                  </details>
                </div>
              } @else if (showCosts()) {
                <div class="bom-mini">
                  <span class="bom-count">Costo de compra: {{ r.purchaseCost | currency:'S/ ':'symbol':'1.2-2' }}</span>
                </div>
              }

              @if (!r.isResale) {
                @if ((r.producible ?? 0) > 0) {
                  <div class="producible-hint">
                    <mat-icon>info</mat-icon>
                    <span>Puedes producir hasta <strong>{{ r.producible }}</strong> unidades más con el stock de insumos actual.</span>
                  </div>
                } @else if (r.items.length > 0) {
                  <div class="producible-hint warning">
                    <mat-icon>warning</mat-icon>
                    <span>No se puede producir: faltan insumos.</span>
                  </div>
                }
              }

              @if (canEdit()) {
                <div class="card-actions">
                  <button mat-stroked-button (click)="openForm(r)">
                    <mat-icon>edit</mat-icon> Editar
                  </button>
                  <button mat-stroked-button color="warn" (click)="confirmDelete(r)">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              }
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: [`
    .toolbar {
      display: flex; align-items: center; flex-wrap: wrap;
      gap: 16px; padding: 12px 16px; margin-bottom: 16px;
    }
    .search-field { flex: 1; max-width: 360px; }
    ::ng-deep .toolbar .mat-mdc-form-field-infix { padding: 8px 0; }

    .chip-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip {
      min-width: 0;
      padding: 4px 14px !important;
      font-size: 13px !important;
      font-weight: 500 !important;
    }
    .chip.active {
      background: #6366F1 !important;
      color: #fff !important;
      border-color: #6366F1 !important;
    }

    .recipe-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }

    .recipe-card {
      background: var(--color-surface);
      border-radius: var(--radius-md);
      overflow: hidden;
      box-shadow: var(--shadow-1);
      display: flex;
      flex-direction: column;
      transition: all 0.2s ease;
      border: 1px solid var(--color-border);
    }
    .recipe-card:hover {
      box-shadow: var(--shadow-hover);
      transform: translateY(-2px);
      border-color: var(--color-primary);
    }

    .recipe-image {
      position: relative;
      height: 140px;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .recipe-image img {
      width: 100%; height: 100%; object-fit: cover;
    }
    .recipe-image mat-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
    }
    .category-tag {
      position: absolute;
      top: 10px;
      left: 10px;
      padding: 4px 10px;
      border-radius: 12px;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .oos-tag {
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 4px 10px;
      border-radius: 12px;
      background: #DC2626;
      color: #fff;
      font-size: 11px;
      font-weight: 700;
    }
    .stock-badge {
      position: absolute;
      top: 10px;
      right: 10px;
      padding: 4px 10px;
      border-radius: 12px;
      background: rgba(16, 185, 129, 0.95);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
    }
    .resale-tag {
      position: absolute;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 12px;
      background: rgba(70, 72, 212, 0.95);
      color: #fff;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .resale-tag mat-icon {
      font-size: 12px !important;
      width: 12px !important;
      height: 12px !important;
    }

    .producible-hint {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: #ECFDF5;
      color: #047857;
      border-radius: 8px;
      font-size: 12px;
    }
    .producible-hint mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #059669;
    }
    .producible-hint.warning {
      background: #FEF3C7;
      color: #92400E;
    }
    .producible-hint.warning mat-icon { color: #D97706; }

    .recipe-body {
      padding: 14px 16px 16px 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .recipe-name { margin: 0; font-size: 16px; font-weight: 700; color: #1E293B; }
    .recipe-desc { margin: 0; font-size: 13px; color: #64748B; line-height: 1.4; }

    .finance-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      padding: 10px;
      background: #F8FAFC;
      border-radius: 8px;
    }
    .finance-grid.no-costs { grid-template-columns: 1fr; }
    .finance-grid > div { display: flex; flex-direction: column; gap: 2px; }
    .finance-grid .label { font-size: 11px; color: #64748B; text-transform: uppercase; letter-spacing: 0.4px; }
    .finance-grid strong { font-size: 14px; color: #1E293B; }
    .margin-cell.positive strong { color: #059669; }
    .margin-cell.warning  strong { color: #D97706; }
    .margin-cell.negative strong { color: #DC2626; }

    .bom-mini {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 12px;
      color: #64748B;
    }
    .bom-detail summary { cursor: pointer; color: #4F46E5; font-weight: 500; }
    .bom-detail ul {
      list-style: none;
      padding: 8px 0 0 0;
      margin: 0;
      font-size: 12px;
    }
    .bom-detail li {
      display: flex;
      justify-content: space-between;
      padding: 3px 0;
    }
    .muted { color: #94A3B8; }

    .card-actions { display: flex; gap: 6px; margin-top: 4px; }
    .card-actions button { flex: 1; min-width: 0; }

    .loading, .empty {
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      padding: 64px 16px;
      gap: 12px;
      color: #64748B;
    }
    .empty mat-icon { font-size: 48px; width: 48px; height: 48px; color: #CBD5E1; }
    .empty p { margin: 0; }

    .readonly-pill {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin-left: 12px;
      padding: 3px 10px;
      background: #F1F5F9;
      color: #64748B;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      vertical-align: middle;
    }
    .readonly-pill mat-icon { font-size: 14px; width: 14px; height: 14px; }

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
  `],
})
export class RecipesComponent implements OnInit {
  search = signal('');
  selectedCategory = signal<RecipeCategory | 'ALL'>('ALL');
  categoryKeys: ('ALL' | RecipeCategory)[] = ['ALL', 'PANADERIA', 'PASTELERIA', 'BEBIDAS', 'OTROS'];
  categoryLabels = CATEGORY_LABELS;

  filtered = computed(() => {
    const term = this.search().trim().toLowerCase();
    const cat = this.selectedCategory();
    return this.recipes.recipes().filter((r) => {
      const matchTerm = !term || r.name.toLowerCase().includes(term);
      const matchCat = cat === 'ALL' || r.category === cat;
      return matchTerm && matchCat;
    });
  });

  canEdit = computed(() => {
    const role = this.authService.role();
    return role === 'OWNER' || role === 'MANAGER';
  });

  /** True solo si el OWNER no tiene una sucursal seleccionada (vista global). */
  isGlobalView = computed(
    () => this.authService.role() === 'OWNER' && !this.branchService.selectedBranchId()
  );

  showCosts = computed(() => {
    const role = this.authService.role();
    if (role === 'OWNER' || role === 'MANAGER') return true;
    return !(this.settings.business()?.hideIngredientCosts ?? false);
  });

  private branchInitialized = false;

  constructor(
    public recipes: RecipesService,
    private inventory: InventoryService,
    private authService: AuthService,
    private branchService: BranchService,
    private settings: SettingsService,
    private dialog: MatDialog,
    private snack: MatSnackBar
  ) {
    // Recargar al cambiar de sucursal en el header. Skip primer fire (ngOnInit ya carga).
    effect(() => {
      this.branchService.selectedBranchId();
      if (!this.branchInitialized) {
        this.branchInitialized = true;
        return;
      }
      void this.recipes.load();
      void this.inventory.load();
    }, { allowSignalWrites: true });
  }

  async ngOnInit(): Promise<void> {
    if (this.authService.role() === 'OWNER') {
      await this.branchService.loadBranches();
    }
    if (!this.settings.business()) {
      await this.settings.loadBusiness();
    }
    await Promise.all([this.recipes.load(), this.inventory.load()]);
  }

  categoryColor(c: RecipeCategory): string {
    return CATEGORY_COLORS[c];
  }

  unitShort(u: MeasureUnit): string {
    return UNIT_SHORT[u];
  }

  onImgError(ev: Event): void {
    (ev.target as HTMLImageElement).style.display = 'none';
  }

  /**
   * Asegura que haya una sucursal seleccionada antes de operaciones de escritura.
   * Si está en vista global usa la sucursal de la receta o autoselecciona la primera.
   */
  private async ensureBranchSelected(forRecipe?: Recipe | null): Promise<boolean> {
    if (!this.isGlobalView()) return true;
    const branchId =
      (forRecipe as Recipe & { branch?: { id: string } } | null | undefined)?.branch?.id ??
      this.branchService.branches()[0]?.id;
    if (!branchId) {
      this.snack.open('No tienes sucursales disponibles. Crea una en Configuración.', 'OK', { duration: 4000 });
      return false;
    }
    this.branchService.selectBranch(branchId);
    const branchName = this.branchService.branches().find((b) => b.id === branchId)?.name ?? 'sucursal';
    this.snack.open(`Trabajando en sucursal: ${branchName}`, 'OK', { duration: 2500 });
    return true;
  }

  async openForm(recipe: Recipe | null): Promise<void> {
    if (!(await this.ensureBranchSelected(recipe))) return;
    const ref = this.dialog.open(RecipeFormDialogComponent, {
      data: { recipe },
      disableClose: true,
    });

    ref.afterClosed().subscribe(async (payload: RecipePayload | undefined) => {
      if (!payload) return;
      try {
        if (recipe) {
          await this.recipes.update(recipe.id, payload);
          this.snack.open('Producto actualizado', 'OK', { duration: 2500 });
        } else {
          await this.recipes.create(payload);
          this.snack.open('Producto creado', 'OK', { duration: 2500 });
        }
      } catch (e: unknown) {
        this.snack.open(e instanceof Error ? e.message : 'Error', 'OK', { duration: 4000 });
      }
    });
  }

  async confirmDelete(r: Recipe): Promise<void> {
    if (!(await this.ensureBranchSelected(r))) return;
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Eliminar producto',
        message: `¿Eliminar "${r.name}"? El producto dejará de estar disponible en el POS.`,
        confirmText: 'Eliminar',
        danger: true,
      },
    });

    ref.afterClosed().subscribe(async (ok: boolean) => {
      if (!ok) return;
      try {
        await this.recipes.remove(r.id);
        this.snack.open('Producto eliminado', 'OK', { duration: 2500 });
      } catch (e: unknown) {
        this.snack.open(e instanceof Error ? e.message : 'Error', 'OK', { duration: 4000 });
      }
    });
  }
}
