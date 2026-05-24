import { Component, Inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { Ingredient, MeasureUnit, Recipe, RecipeCategory } from '../../core/models';
import { RecipePayload } from '../../core/services/recipes.service';
import { InventoryService } from '../../core/services/inventory.service';
import {
  bestDisplayUnit,
  bomUnitLabel,
  bomUnitShort,
  bomUnitsFor,
  type BomUnit,
  convert,
  convertToBase,
  isApproximate,
  UNIT_SHORT as UNIT_SHORT_UTIL,
} from '../../core/utils/units';

interface DialogData {
  recipe: Recipe | null;
}

interface BomRow {
  rowId: string;
  ingredientId: string;
  inputQuantity: number;
  /** Puede ser una MeasureUnit real (KG/G/L/ML/UNIT) o una unidad de cocina
   *  (CUCHARADA, TAZA_HALF, etc.) cuando el insumo es líquido. */
  inputUnit: BomUnit;
}

const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  PANADERIA: 'Panadería',
  PASTELERIA: 'Pastelería',
  BEBIDAS: 'Bebidas',
  OTROS: 'Otros',
};

@Component({
  selector: 'app-recipe-form-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, CurrencyPipe, DecimalPipe,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatDividerModule, MatTooltipModule,
    MatButtonToggleModule,
  ],
  template: `
    <div class="dialog">
      <h2 class="title">
        <mat-icon>{{ data.recipe ? 'edit' : 'menu_book' }}</mat-icon>
        {{ data.recipe ? 'Editar' : 'Nuevo' }} Producto
      </h2>

      <div class="body">
        <!-- ─── Toggle tipo de producto ─── -->
        <div class="type-toggle-wrapper">
          <span class="type-label">¿Cómo se obtiene este producto?</span>
          <mat-button-toggle-group
            [value]="isResale() ? 'resale' : 'made'"
            (change)="setIsResale($event.value === 'resale')"
            class="type-toggle"
          >
            <mat-button-toggle value="made">
              <mat-icon>bakery_dining</mat-icon> Lo fabricamos (con receta)
            </mat-button-toggle>
            <mat-button-toggle value="resale">
              <mat-icon>local_grocery_store</mat-icon> Lo compramos hecho
            </mat-button-toggle>
          </mat-button-toggle-group>
          <p class="type-hint">
            @if (isResale()) {
              Ej: gaseosas, snacks, productos terminados que compras a un proveedor.
              El stock se incrementa con "Compra de reventa", no con producción.
            } @else {
              Ej: tortas, panes, lo que tu pastelería fabrica desde insumos.
              El stock se incrementa al registrar producción.
            }
          </p>
        </div>

        <mat-divider />

        <!-- ─── Datos generales ─── -->
        <form [formGroup]="form" class="form-grid">
          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Nombre del producto</mat-label>
            <input matInput formControlName="name" [placeholder]="isResale() ? 'Coca Cola 500ml' : 'Croissant clásico'" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Categoría</mat-label>
            <mat-select formControlName="category">
              @for (key of categoryKeys; track key) {
                <mat-option [value]="key">{{ categoryLabels[key] }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Precio de Venta</mat-label>
            <span matTextPrefix>S/&nbsp;</span>
            <input matInput type="number" formControlName="salePrice" min="0" step="0.01" />
          </mat-form-field>

          <!-- Campos extra para reventa -->
          @if (isResale()) {
            <mat-form-field appearance="outline">
              <mat-label>Costo de compra (por unidad)</mat-label>
              <span matTextPrefix>S/&nbsp;</span>
              <input matInput type="number" formControlName="purchaseCost" min="0" step="0.01" />
              <mat-hint>Lo que pagas al proveedor por 1 unidad</mat-hint>
            </mat-form-field>

            @if (!data.recipe) {
              <mat-form-field appearance="outline">
                <mat-label>Stock inicial</mat-label>
                <input matInput type="number" formControlName="initialStock" min="0" step="1" />
                <mat-hint>Cuántas unidades tienes ahora mismo</mat-hint>
              </mat-form-field>
            }
          }

          <mat-form-field appearance="outline" class="span-2">
            <mat-label>URL de Imagen (opcional)</mat-label>
            <input matInput formControlName="imageUrl" placeholder="https://..." />
          </mat-form-field>

          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Descripción</mat-label>
            <textarea matInput formControlName="description" rows="2"></textarea>
          </mat-form-field>
        </form>

        <!-- ─── BOM: SOLO si NO es reventa ─── -->
        @if (!isResale()) {
          <mat-divider />

          <div class="bom-section">
            <div class="bom-header">
              <h3>Insumos de la receta (BOM)</h3>
              <button mat-stroked-button color="primary" type="button" (click)="addItem()" [disabled]="availableIngredients().length === 0">
                <mat-icon>add</mat-icon> Agregar Insumo
              </button>
            </div>

            @if (inventory.ingredients().length === 0) {
              <div class="warning-banner">
                <mat-icon>warning</mat-icon>
                <span>No tienes insumos en el inventario de esta sucursal. Crea insumos antes de crear productos fabricados.</span>
              </div>
            } @else if (items().length === 0) {
              <div class="empty-bom">
                <mat-icon>science</mat-icon>
                <p>Agrega al menos un insumo para calcular el costo de producción.</p>
              </div>
            } @else {
              <div class="bom-list">
                @for (row of items(); track row.rowId) {
                  <div class="bom-row-wrapper">
                    <div class="bom-row">
                      <!-- Línea 1: insumo (full width) + delete -->
                      <mat-form-field appearance="outline" class="bom-ingredient">
                        <mat-label>Insumo</mat-label>
                        <mat-select [ngModel]="row.ingredientId" (ngModelChange)="updateItem(row.rowId, 'ingredientId', $event)">
                          @for (ing of inventory.ingredients(); track ing.id) {
                            <mat-option [value]="ing.id">{{ ing.name }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>

                      <button mat-icon-button type="button" (click)="removeItem(row.rowId)" matTooltip="Quitar" class="bom-delete-btn">
                        <mat-icon color="warn">delete</mat-icon>
                      </button>

                      <!-- Línea 2: cantidad + unidad (anchas) + costo -->
                      <mat-form-field appearance="outline" class="bom-qty">
                        <mat-label>Cantidad</mat-label>
                        <input
                          matInput
                          type="number"
                          [ngModel]="row.inputQuantity"
                          (ngModelChange)="updateItem(row.rowId, 'inputQuantity', $event)"
                          min="0"
                          step="any"
                        />
                      </mat-form-field>

                      <mat-form-field appearance="outline" class="bom-unit">
                        <mat-label>Unidad</mat-label>
                        <mat-select
                          [ngModel]="row.inputUnit"
                          (ngModelChange)="updateItem(row.rowId, 'inputUnit', $event)"
                          panelClass="bom-unit-panel"
                        >
                          @for (u of unitsForRow(row); track u) {
                            <mat-option [value]="u">{{ unitLabel(u) }}</mat-option>
                          }
                        </mat-select>
                      </mat-form-field>

                      <div class="bom-cost">
                        {{ rowCost(row) | currency:'S/ ':'symbol':'1.2-2' }}
                      </div>
                    </div>
                    @if (rowDescription(row); as desc) {
                      <div class="bom-hint">{{ desc }}</div>
                    }
                  </div>
                }
              </div>
            }
          </div>
        }

        <mat-divider />

        <!-- ─── Resumen financiero en vivo ─── -->
        <div class="summary card">
          <div class="summary-row">
            <span>{{ isResale() ? 'Costo de compra (CPP)' : 'Costo Total de Producción' }}</span>
            <strong>{{ effectiveCost() | currency:'S/ ':'symbol':'1.2-2' }}</strong>
          </div>
          <div class="summary-row">
            <span>Precio de Venta</span>
            <strong>{{ salePrice() | currency:'S/ ':'symbol':'1.2-2' }}</strong>
          </div>
          <div class="summary-row margin" [class.positive]="margin() >= 30" [class.warning]="margin() < 30 && margin() >= 0" [class.negative]="margin() < 0">
            <span>Margen de Ganancia</span>
            <strong>{{ margin() | number:'1.1-1' }}%</strong>
          </div>
        </div>

        @if (errorMessage()) {
          <div class="error">
            <mat-icon>error_outline</mat-icon> {{ errorMessage() }}
          </div>
        }
      </div>

      <div class="actions">
        <button mat-stroked-button type="button" (click)="dialogRef.close()">Cancelar</button>
        <button
          mat-flat-button
          color="primary"
          (click)="onSubmit()"
          [disabled]="!canSubmit()"
        >
          {{ data.recipe ? 'Actualizar Producto' : 'Crear Producto' }}
        </button>
      </div>
    </div>
  `,
  styles: [`
    .dialog {
      padding: 0;
      width: 720px;
      max-width: 95vw;
      max-height: 90vh;
      display: flex;
      flex-direction: column;
    }
    .title {
      display: flex; align-items: center; gap: 8px;
      margin: 0; padding: 20px 24px;
      font-size: 18px; font-weight: 700; color: #1E293B;
      border-bottom: 1px solid #F1F5F9;
    }
    .title mat-icon { color: #6366F1; }

    .body {
      padding: 20px 24px;
      overflow-y: auto;
      flex: 1;
    }

    .type-toggle-wrapper {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 16px;
      padding: 14px 16px;
      background: #F8FAFC;
      border-radius: 10px;
      border: 1px solid #E2E8F0;
    }
    .type-label {
      font-size: 13px;
      font-weight: 600;
      color: #1E293B;
    }
    .type-toggle { width: 100%; }
    ::ng-deep .type-toggle .mat-button-toggle { flex: 1; }
    ::ng-deep .type-toggle .mat-button-toggle-label-content {
      display: flex !important;
      align-items: center;
      justify-content: center;
      gap: 6px;
      font-weight: 600;
      font-size: 13px;
    }
    ::ng-deep .type-toggle .mat-button-toggle-checked {
      background: var(--color-primary-fixed) !important;
      color: var(--color-primary) !important;
    }
    .type-hint {
      margin: 4px 0 0 0;
      font-size: 12px;
      color: #64748B;
      line-height: 1.4;
    }

    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin: 16px 0; }
    .span-2 { grid-column: 1 / -1; }
    @media (max-width: 600px) {
      .form-grid { grid-template-columns: 1fr; }
      .span-2 { grid-column: 1; }
    }
    mat-form-field { width: 100%; }
    ::ng-deep .dialog mat-hint { display: block; white-space: normal !important; line-height: 1.3; }

    .bom-section { padding: 16px 0; }
    .bom-header {
      display: flex; justify-content: space-between; align-items: center;
      margin-bottom: 12px;
    }
    .bom-header h3 { margin: 0; font-size: 15px; font-weight: 600; color: #1E293B; }

    .bom-list { display: flex; flex-direction: column; gap: 12px; }
    .bom-row-wrapper {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 10px 12px;
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      transition: border-color 0.15s, background 0.15s;
    }
    .bom-row-wrapper:hover {
      background: #fff;
      border-color: #C7D2FE;
    }
    .bom-hint {
      font-size: 12px;
      color: #64748B;
      padding: 0 4px;
      line-height: 1.4;
    }

    /* ─── Layout 2-line: insumo arriba, qty+unidad+costo abajo ─── */
    .bom-row {
      display: grid;
      grid-template-columns: 90px 1fr auto 36px;
      grid-template-areas:
        "ingredient ingredient ingredient delete"
        "qty unit cost cost";
      gap: 8px;
      align-items: start;
    }
    .bom-ingredient { grid-area: ingredient; }
    .bom-delete-btn { grid-area: delete; justify-self: end; align-self: center; }
    .bom-qty { grid-area: qty; }
    .bom-unit { grid-area: unit; min-width: 0; }
    .bom-cost {
      grid-area: cost;
      padding: 10px 4px 10px 12px;
      font-weight: 700;
      color: #1E293B;
      text-align: right;
      font-size: 14px;
      white-space: nowrap;
      align-self: center;
    }
    .bom-ingredient, .bom-qty, .bom-unit { margin: 0; }
    ::ng-deep .bom-row .mat-mdc-form-field-infix { padding: 8px 0; min-height: auto; }
    /* El trigger de mat-select debe permitir truncate elegante si el label es muy largo */
    ::ng-deep .bom-unit .mat-mdc-select-value {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    /* Mobile: la línea 2 colapsa para no apretar inputs */
    @media (max-width: 480px) {
      .bom-row {
        grid-template-columns: 1fr 36px;
        grid-template-areas:
          "ingredient delete"
          "qty qty"
          "unit unit"
          "cost cost";
      }
      .bom-cost { text-align: right; padding: 4px 8px; }
    }

    /* Panel del dropdown de unidad: que sea más ancho que el trigger (~240px)
       para mostrar labels largos como "1/4 cucharadita (1.25 ml)" sin envolver. */
    ::ng-deep .bom-unit-panel.mat-mdc-select-panel {
      min-width: 260px !important;
      max-width: 320px !important;
    }
    ::ng-deep .bom-unit-panel .mat-mdc-option {
      min-height: 36px !important;
    }
    ::ng-deep .bom-unit-panel .mat-mdc-option .mdc-list-item__primary-text {
      white-space: nowrap !important;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .warning-banner, .empty-bom {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 16px;
      background: #FEF3C7;
      color: #92400E;
      border-radius: 8px;
      font-size: 14px;
    }
    .empty-bom {
      background: #F8FAFC;
      color: #64748B;
      flex-direction: column;
      padding: 32px 16px;
      gap: 8px;
    }
    .empty-bom mat-icon { font-size: 36px; width: 36px; height: 36px; color: #CBD5E1; }
    .empty-bom p { margin: 0; }

    .summary {
      margin-top: 16px;
      padding: 16px 20px;
      background: #F8FAFC;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .summary-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 14px;
      color: #475569;
    }
    .summary-row strong { color: #1E293B; font-size: 15px; }
    .summary-row.margin strong { font-size: 18px; }
    .summary-row.margin.positive strong { color: #059669; }
    .summary-row.margin.warning  strong { color: #D97706; }
    .summary-row.margin.negative strong { color: #DC2626; }

    .error {
      display: flex; align-items: center; gap: 8px;
      background: #FEE2E2; color: #DC2626;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 13px;
      margin-top: 12px;
    }

    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      padding: 16px 24px;
      border-top: 1px solid #F1F5F9;
    }
  `],
})
export class RecipeFormDialogComponent implements OnInit {
  form: FormGroup;
  items = signal<BomRow[]>([]);
  errorMessage = signal('');
  isResale = signal(false);
  private formValid = signal(false);
  private purchaseCostSig = signal(0);

  categoryKeys: RecipeCategory[] = ['PANADERIA', 'PASTELERIA', 'BEBIDAS', 'OTROS'];
  categoryLabels = CATEGORY_LABELS;

  bomCost = computed(() =>
    this.items().reduce((sum, row) => sum + this.rowCost(row), 0)
  );

  /** Costo efectivo: si es reventa, es purchaseCost; si no, es la suma del BOM. */
  effectiveCost = computed(() => {
    if (this.isResale()) return this.purchaseCostSig();
    return this.bomCost();
  });

  salePrice = signal(0);

  margin = computed(() => {
    const price = this.salePrice();
    const cost = this.effectiveCost();
    if (price <= 0) return 0;
    return ((price - cost) / price) * 100;
  });

  availableIngredients = computed(() => this.inventory.ingredients());

  canSubmit = computed(() => {
    if (!this.formValid()) return false;
    if (this.isResale()) {
      // Reventa: solo necesita purchaseCost > 0
      return this.purchaseCostSig() > 0;
    }
    // Fabricado: BOM con todas las filas válidas
    const rows = this.items();
    if (rows.length === 0) return false;
    return rows.every((r) => r.ingredientId && r.inputQuantity > 0);
  });

  constructor(
    public dialogRef: MatDialogRef<RecipeFormDialogComponent, RecipePayload | null>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    public inventory: InventoryService,
    fb: FormBuilder
  ) {
    const r = data.recipe;
    this.isResale.set(r?.isResale ?? false);

    this.form = fb.group({
      name: [r?.name ?? '', [Validators.required, Validators.minLength(1)]],
      category: [r?.category ?? 'PASTELERIA' as RecipeCategory, Validators.required],
      salePrice: [r?.salePrice ?? 0, [Validators.required, Validators.min(0.01)]],
      purchaseCost: [r?.purchaseCost ?? 0, [Validators.min(0)]],
      initialStock: [0, [Validators.min(0)]],
      imageUrl: [r?.imageUrl ?? ''],
      description: [r?.description ?? ''],
    });

    // Reactividad: mantener salePrice y purchaseCost como signals sincronizados.
    this.form.get('salePrice')?.valueChanges.subscribe((v) => this.salePrice.set(Number(v) || 0));
    this.salePrice.set(Number(r?.salePrice ?? 0));

    this.form.get('purchaseCost')?.valueChanges.subscribe((v) => this.purchaseCostSig.set(Number(v) || 0));
    this.purchaseCostSig.set(Number(r?.purchaseCost ?? 0));

    this.formValid.set(this.form.valid);
    this.form.statusChanges.subscribe((status) => {
      this.formValid.set(status === 'VALID');
    });

    if (r?.items?.length && !r.isResale) {
      this.items.set(
        r.items.map((it) => {
          const ing = it.ingredient;
          const baseUnit = ing.unit;
          const displayUnit = bestDisplayUnit(it.quantity, baseUnit);
          const displayQty = convert(it.quantity, baseUnit, displayUnit);
          return {
            rowId: this.newRowId(),
            ingredientId: it.ingredientId,
            inputQuantity: this.round3(displayQty),
            inputUnit: displayUnit,
          };
        })
      );
    }
  }

  /** Cuando el usuario cambia el toggle de tipo de producto. */
  setIsResale(value: boolean): void {
    this.isResale.set(value);
    this.errorMessage.set('');
  }

  private rowCounter = 0;
  private newRowId(): string {
    this.rowCounter += 1;
    return `row-${this.rowCounter}`;
  }

  async ngOnInit(): Promise<void> {
    if (this.inventory.ingredients().length === 0) {
      await this.inventory.load();
    }
  }

  unitShort(u: MeasureUnit): string {
    return UNIT_SHORT_UTIL[u];
  }

  /** Label para el dropdown — para unidades de cocina muestra "1 cucharada (15 ml)". */
  unitLabel(u: BomUnit): string {
    return bomUnitLabel(u);
  }

  /** Unidades disponibles en el selector según el insumo (incluye cucharadas/
   *  tazas si el insumo es líquido). */
  unitsForRow(row: BomRow): BomUnit[] {
    const ing = this.inventory.ingredients().find((i: Ingredient) => i.id === row.ingredientId);
    return ing ? bomUnitsFor(ing.unit) : [row.inputUnit];
  }

  /** Cantidad de la fila convertida a la unidad base del insumo.
   *  Acepta tanto unidades reales (kg/g/l/ml) como de cocina (cucharada, taza, etc.). */
  private quantityInBase(row: BomRow): number {
    const ing = this.inventory.ingredients().find((i: Ingredient) => i.id === row.ingredientId);
    if (!ing) return 0;
    try {
      return convertToBase(row.inputQuantity, row.inputUnit, ing.unit);
    } catch {
      return 0;
    }
  }

  rowCost(row: BomRow): number {
    const ing = this.inventory.ingredients().find((i: Ingredient) => i.id === row.ingredientId);
    if (!ing) return 0;
    return this.quantityInBase(row) * ing.unitCost;
  }

  /**
   * Texto explicativo bajo cada fila del BOM, con conversión a unidad base
   * y equivalencia en presentaciones:
   *   "800 g = 0.8 kg · 0.8 presentación de 1 kg · Costo: S/ 4.50 por presentación"
   */
  rowDescription(row: BomRow): string {
    const ing = this.inventory.ingredients().find((i: Ingredient) => i.id === row.ingredientId);
    if (!ing || !row.inputQuantity || ing.presentationSize <= 0) return '';

    const qtyBase = this.quantityInBase(row);
    const presentationsUsed = qtyBase / ing.presentationSize;
    const costPerPresentation = ing.unitCost * ing.presentationSize;
    const baseUnitShort = UNIT_SHORT_UTIL[ing.unit];

    const equiv =
      presentationsUsed < 1
        ? `${this.round3(presentationsUsed)} presentación`
        : `${this.round3(presentationsUsed)} presentaciones`;

    const inputUnitShort = bomUnitShort(row.inputUnit);
    const approx = isApproximate(row.inputUnit, ing.unit);
    const eqSym = approx ? '≈' : '=';
    const conversionText =
      row.inputUnit === ing.unit
        ? `${row.inputQuantity} ${inputUnitShort}`
        : `${row.inputQuantity} ${inputUnitShort} ${eqSym} ${this.round3(qtyBase)} ${baseUnitShort}`;

    // Para conversiones aproximadas de cocina → sólido, agregar nota.
    const approxNote = approx
      ? ' · ⚠️ Aproximado (densidad estimada 1 g/ml — usar gramos exactos para precisión)'
      : '';

    return `${conversionText} · ${equiv} de ${ing.presentationSize} ${baseUnitShort} · Costo: S/ ${this.round2(costPerPresentation)} por presentación${approxNote}`;
  }

  private round2(n: number): number { return Math.round(n * 100) / 100; }
  private round3(n: number): number { return Math.round(n * 1000) / 1000; }

  addItem(): void {
    const first = this.inventory.ingredients()[0];
    if (!first) return;
    this.items.update((rows) => [
      ...rows,
      {
        rowId: this.newRowId(),
        ingredientId: first.id,
        inputQuantity: 0,
        inputUnit: first.unit,
      },
    ]);
  }

  updateItem(
    rowId: string,
    field: 'ingredientId' | 'inputQuantity' | 'inputUnit',
    value: string | number
  ): void {
    this.items.update((rows) =>
      rows.map((r) => {
        if (r.rowId !== rowId) return r;
        if (field === 'inputQuantity') {
          return { ...r, inputQuantity: Number(value) || 0 };
        }
        if (field === 'inputUnit') {
          return { ...r, inputUnit: value as BomUnit };
        }
        const newId = String(value);
        const ing = this.inventory.ingredients().find((i: Ingredient) => i.id === newId);
        return {
          ...r,
          ingredientId: newId,
          // Al cambiar de insumo, resetear la unidad a la base (real, no cocina)
          // para que el dropdown muestre algo válido inmediatamente.
          inputUnit: ing ? ing.unit : r.inputUnit,
        };
      })
    );
  }

  removeItem(rowId: string): void {
    this.items.update((rows) => rows.filter((r) => r.rowId !== rowId));
  }

  onSubmit(): void {
    this.errorMessage.set('');
    if (!this.canSubmit()) {
      this.errorMessage.set(
        this.isResale()
          ? 'Verifica nombre, precio de venta y costo de compra.'
          : 'Verifica que todos los insumos tengan cantidad mayor a 0.'
      );
      return;
    }
    const v = this.form.value;
    const isResale = this.isResale();

    const payload: RecipePayload = {
      name: v.name,
      category: v.category,
      salePrice: Number(v.salePrice),
      imageUrl: v.imageUrl || null,
      description: v.description || null,
      isResale,
      items: isResale
        ? []
        : this.items().map((r) => ({
            ingredientId: r.ingredientId,
            quantity: this.quantityInBase(r),
          })),
      ...(isResale && {
        purchaseCost: Number(v.purchaseCost ?? 0),
        ...(!this.data.recipe && { initialStock: Number(v.initialStock ?? 0) }),
      }),
    };
    this.dialogRef.close(payload);
  }
}
