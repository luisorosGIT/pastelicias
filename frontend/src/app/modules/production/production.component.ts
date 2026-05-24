import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ProductionService, ProductionPayload, WastePayload, ResalePurchasePayload } from '../../core/services/production.service';
import { RecipesService } from '../../core/services/recipes.service';
import { InventoryService } from '../../core/services/inventory.service';
import { BranchService } from '../../core/services/branch.service';
import { AuthService } from '../../core/services/auth.service';
import { KpiCardComponent } from '../../shared/components/kpi-card/kpi-card.component';
import { MeasureUnit, WasteReason, WasteType } from '../../core/models';
import { compatibleUnits, convert, UNIT_SHORT as UNIT_SHORT_UTIL } from '../../core/utils/units';

const WASTE_REASON_LABELS: Record<WasteReason, string> = {
  EXPIRY: 'Caducidad / Vencimiento',
  PHYSICAL_DAMAGE: 'Daño físico / Rotura',
  CONTAMINATION: 'Contaminación',
  LOST_BROKEN: 'Roto / Extraviado',
  SPILL: 'Derrame / Mal pesaje',
  OTHER: 'Otro',
};

const UNIT_SHORT: Record<MeasureUnit, string> = {
  KG: 'kg', G: 'g', L: 'l', ML: 'ml', UNIT: 'unidad',
};

@Component({
  selector: 'app-production',
  standalone: true,
  imports: [
    CommonModule, CurrencyPipe, DatePipe, DecimalPipe, ReactiveFormsModule,
    MatTabsModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSelectModule, MatButtonToggleModule, MatProgressSpinnerModule,
    KpiCardComponent,
  ],
  template: `
    <div class="page-header">
      <div>
        <h2>Producción</h2>
        <p class="page-subtitle">Gestiona órdenes y planifica la jornada de cocina.</p>
      </div>
    </div>

    <mat-tab-group animationDuration="200ms">
      <!-- ─── Tab Horneado y Producción ────────────────────────── -->
      <mat-tab label="Horneado y Producción">
        <div class="tab-content production-grid">
          <!-- Form izquierda -->
          <div class="card form-card">
            <h3><mat-icon>bakery_dining</mat-icon> Registrar Producción</h3>
            <p class="muted">Al confirmar, los insumos del producto se descuentan automáticamente del inventario.</p>

            <form [formGroup]="prodForm" (ngSubmit)="submitProduction()" class="form">
              <mat-form-field appearance="outline">
                <mat-label>Producto (fabricado)</mat-label>
                <mat-select formControlName="recipeId">
                  @for (r of fabricatedRecipes(); track r.id) {
                    <mat-option [value]="r.id">{{ r.name }}</mat-option>
                  }
                </mat-select>
                @if (fabricatedRecipes().length === 0) {
                  <mat-hint>No hay productos fabricados. Crea uno en Productos marcando "Lo fabricamos".</mat-hint>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Cantidad Producida</mat-label>
                <input matInput type="number" formControlName="quantity" min="1" step="1" />
                <span matSuffix>unidades</span>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Notas (opcional)</mat-label>
                <textarea matInput formControlName="notes" rows="2"></textarea>
              </mat-form-field>

              <button mat-flat-button color="primary" type="submit" [disabled]="prodForm.invalid || submittingProd()">
                @if (submittingProd()) {
                  <mat-spinner diameter="20" />
                } @else {
                  <mat-icon>check</mat-icon> Confirmar Producción
                }
              </button>
            </form>
          </div>

          <!-- Historial derecha -->
          <div class="card history-card">
            <h3><mat-icon>history</mat-icon> Actividad Reciente</h3>
            @if (production.productions().length === 0) {
              <p class="muted empty-text">Aún no se han registrado producciones.</p>
            } @else {
              <div class="history-list">
                @for (p of production.productions(); track p.id) {
                  <div class="history-item">
                    <div class="hi-info">
                      <strong>{{ p.recipe?.name ?? 'Producto' }}</strong>
                      <span class="muted">{{ p.createdAt | date:'dd/MM HH:mm' }}</span>
                    </div>
                    <span class="hi-qty">{{ p.quantity }} u.</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </mat-tab>

      <!-- ─── Tab Compra de Reventa ───────────────────────────── -->
      <mat-tab label="Compra de Reventa">
        <div class="tab-content production-grid">
          <div class="card form-card">
            <h3><mat-icon>local_grocery_store</mat-icon> Registrar Compra de Reventa</h3>
            <p class="muted">Sube stock de productos que no fabricas (gaseosas, snacks). Recalcula el costo promedio.</p>

            <form [formGroup]="resaleForm" (ngSubmit)="submitResalePurchase()" class="form">
              <mat-form-field appearance="outline">
                <mat-label>Producto (de reventa)</mat-label>
                <mat-select formControlName="recipeId" (selectionChange)="onResaleProductChange($event.value)">
                  @for (r of resaleRecipes(); track r.id) {
                    <mat-option [value]="r.id">{{ r.name }}</mat-option>
                  }
                </mat-select>
                @if (resaleRecipes().length === 0) {
                  <mat-hint>No hay productos de reventa. Crea uno en Productos marcando "Lo compramos hecho".</mat-hint>
                }
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Cantidad comprada</mat-label>
                <input matInput type="number" formControlName="quantity" min="1" step="1" />
                <span matSuffix>unidades</span>
              </mat-form-field>

              <mat-form-field appearance="outline">
                <mat-label>Costo por unidad</mat-label>
                <span matTextPrefix>S/&nbsp;</span>
                <input matInput type="number" formControlName="unitCost" min="0" step="0.01" />
                <mat-hint>Lo que pagaste al proveedor por cada unidad</mat-hint>
              </mat-form-field>

              @if (resalePreviewCpp() > 0) {
                <div class="cpp-preview">
                  <div class="cpp-row">
                    <span>CPP actual</span>
                    <strong>S/ {{ resaleCurrentCpp() | number:'1.2-2' }}</strong>
                  </div>
                  <div class="cpp-row new">
                    <span>CPP nuevo</span>
                    <strong>S/ {{ resalePreviewCpp() | number:'1.2-2' }}</strong>
                  </div>
                </div>
              }

              <mat-form-field appearance="outline">
                <mat-label>Notas (opcional)</mat-label>
                <textarea matInput formControlName="notes" rows="2"></textarea>
              </mat-form-field>

              <button mat-flat-button color="primary" type="submit" [disabled]="!resaleFormValid() || submittingResale()">
                @if (submittingResale()) {
                  <mat-spinner diameter="20" />
                } @else {
                  <mat-icon>shopping_cart</mat-icon> Confirmar Compra
                }
              </button>
            </form>
          </div>

          <div class="card history-card">
            <h3><mat-icon>inventory</mat-icon> Productos de Reventa</h3>
            @if (resaleRecipes().length === 0) {
              <p class="muted empty-text">Aún no hay productos de reventa registrados.</p>
            } @else {
              <div class="history-list">
                @for (r of resaleRecipes(); track r.id) {
                  <div class="history-item">
                    <div class="hi-info">
                      <strong>{{ r.name }}</strong>
                      <span class="muted">CPP: S/ {{ (r.purchaseCost ?? 0) | number:'1.2-2' }} · Venta: S/ {{ r.salePrice | number:'1.2-2' }}</span>
                    </div>
                    <span class="hi-qty" [class.low]="r.stock <= 0">{{ r.stock }} u.</span>
                  </div>
                }
              </div>
            }
          </div>
        </div>
      </mat-tab>

      <!-- ─── Tab Mermas y Desperdicios ─────────────────────────── -->
      <mat-tab label="Mermas y Desperdicios">
        <div class="tab-content">
          <!-- Período KPIs -->
          <div class="period-bar">
            <span class="period-label">Período de análisis</span>
            <mat-button-toggle-group [value]="kpiFilter()" (change)="setKpiFilter($event.value)" class="modern-toggle">
              <mat-button-toggle value="today">Hoy</mat-button-toggle>
              <mat-button-toggle value="week">Esta Semana</mat-button-toggle>
              <mat-button-toggle value="month">Este Mes</mat-button-toggle>
              <mat-button-toggle value="quarter">Trimestre</mat-button-toggle>
              <mat-button-toggle value="year">Año</mat-button-toggle>
            </mat-button-toggle-group>
          </div>

          <!-- KPIs profesionales -->
          <div class="kpi-grid">
            <app-kpi-card
              label="Merma de Insumos"
              [value]="production.wasteKpis()?.kpis?.ingredientWasteCost ?? 0"
              format="currency"
              icon="inventory_2"
              accentColor="#EF4444"
              subtitle="Materia prima (valorada al CPP)"
            />
            <app-kpi-card
              label="Merma de Producto Terminado"
              [value]="production.wasteKpis()?.kpis?.productWasteCost ?? 0"
              format="currency"
              icon="restaurant"
              accentColor="#EC4899"
              subtitle="Pasteles dañados (valorado al costo de producción)"
            />
            <app-kpi-card
              label="Variación Monetaria (Invisible)"
              [value]="production.wasteKpis()?.kpis?.invisibleLoss ?? 0"
              format="currency"
              icon="visibility_off"
              accentColor="#7C3AED"
              subtitle="Derrames, robos, mal pesaje"
            />
            <app-kpi-card
              label="% Desperdicio sobre Ventas"
              [value]="production.wasteKpis()?.kpis?.wastePercent ?? 0"
              format="percent"
              icon="percent"
              accentColor="#F59E0B"
              [subtitle]="'Total merma: S/ ' + ((production.wasteKpis()?.kpis?.totalWasteCost ?? 0) | number:'1.2-2')"
            />
          </div>

          <!-- Top 5 Insumos con mayor merma -->
          @if ((production.wasteKpis()?.topIngredients?.length ?? 0) > 0) {
            <div class="card top5-card">
              <h3><mat-icon>leaderboard</mat-icon> Top 5 Insumos con Mayor Merma</h3>
              <table class="data-table">
                <thead>
                  <tr>
                    <th class="rank-col">#</th>
                    <th>Insumo</th>
                    <th>Cantidad Perdida</th>
                    <th>Motivo Principal</th>
                    <th class="right">Valor Perdido</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of production.wasteKpis()!.topIngredients; track item.name; let i = $index) {
                    <tr>
                      <td class="rank-col">
                        <span class="rank" [class.gold]="i === 0" [class.silver]="i === 1" [class.bronze]="i === 2">#{{ i + 1 }}</span>
                      </td>
                      <td><strong>{{ item.name }}</strong></td>
                      <td>{{ item.quantity | number:'1.0-2' }}</td>
                      <td><span class="reason-badge">{{ reasonLabel(item.mainReason) }}</span></td>
                      <td class="right warn-color"><strong>-{{ item.cost | currency:'S/ ':'symbol':'1.2-2' }}</strong></td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <div class="production-grid">
            <!-- Form izquierda -->
            <div class="card form-card">
              <h3><mat-icon>delete</mat-icon> Registrar Merma</h3>

              <form [formGroup]="wasteForm" (ngSubmit)="submitWaste()" class="form">
                <mat-button-toggle-group formControlName="type" class="type-toggle modern-toggle">
                  <mat-button-toggle value="INGREDIENT">
                    <mat-icon>inventory_2</mat-icon> Insumo
                  </mat-button-toggle>
                  <mat-button-toggle value="PRODUCT">
                    <mat-icon>restaurant</mat-icon> Producto Terminado
                  </mat-button-toggle>
                </mat-button-toggle-group>

                @if (wasteForm.value.type === 'INGREDIENT') {
                  <mat-form-field appearance="outline">
                    <mat-label>Insumo Afectado</mat-label>
                    <mat-select formControlName="ingredientId" (selectionChange)="onIngredientChange($event.value)">
                      @for (i of inventory.ingredients(); track i.id) {
                        <mat-option [value]="i.id">{{ i.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <div class="qty-row">
                    <mat-form-field appearance="outline" class="qty-input">
                      <mat-label>Cantidad perdida</mat-label>
                      <input matInput type="number" formControlName="quantity" min="0" step="any" />
                    </mat-form-field>

                    <mat-form-field appearance="outline" class="qty-unit">
                      <mat-label>Unidad</mat-label>
                      <mat-select formControlName="quantityUnit">
                        @for (u of availableWasteUnits(); track u) {
                          <mat-option [value]="u">{{ unitShortLabel(u) }}</mat-option>
                        }
                      </mat-select>
                    </mat-form-field>
                  </div>
                } @else {
                  <mat-form-field appearance="outline">
                    <mat-label>Producto</mat-label>
                    <mat-select formControlName="recipeId">
                      @for (r of recipes.recipes(); track r.id) {
                        <mat-option [value]="r.id">{{ r.name }}</mat-option>
                      }
                    </mat-select>
                  </mat-form-field>

                  <mat-form-field appearance="outline">
                    <mat-label>Unidades desechadas</mat-label>
                    <input matInput type="number" formControlName="quantity" min="1" step="1" />
                    <span matSuffix>u.</span>
                  </mat-form-field>
                }

                <mat-form-field appearance="outline">
                  <mat-label>Motivo</mat-label>
                  <mat-select formControlName="reason">
                    @for (key of reasonKeys; track key) {
                      <mat-option [value]="key">{{ reasonLabels[key] }}</mat-option>
                    }
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Notas (opcional)</mat-label>
                  <textarea matInput formControlName="notes" rows="2"></textarea>
                </mat-form-field>

                <div class="cost-preview">
                  <span>Costo estimado de la merma</span>
                  <strong>{{ estimatedWasteCost() | currency:'S/ ':'symbol':'1.2-2' }}</strong>
                </div>

                <button mat-flat-button color="warn" type="submit" [disabled]="!wasteFormValid() || submittingWaste()">
                  @if (submittingWaste()) {
                    <mat-spinner diameter="20" />
                  } @else {
                    <mat-icon>delete</mat-icon> Registrar Merma
                  }
                </button>
              </form>
            </div>

            <!-- Historial derecha -->
            <div class="card history-card">
              <h3><mat-icon>list</mat-icon> Historial de Mermas</h3>
              @if (production.wastes().length === 0) {
                <p class="muted empty-text">No hay mermas registradas.</p>
              } @else {
                <div class="waste-list">
                  @for (w of production.wastes(); track w.id) {
                    <div class="waste-row">
                      <div class="waste-info">
                        <strong>{{ w.ingredient?.name ?? w.recipe?.name ?? '—' }}</strong>
                        <span class="muted">
                          {{ w.quantity | number:'1.0-3' }}
                          {{ w.ingredient?.unit ? unitShort(w.ingredient?.unit) : 'u.' }}
                          • {{ reasonLabels[w.reason] }}
                        </span>
                        <span class="muted small">{{ w.createdAt | date:'dd/MM HH:mm' }}</span>
                      </div>
                      <strong class="waste-cost">-{{ w.cost | currency:'S/ ':'symbol':'1.2-2' }}</strong>
                    </div>
                  }
                </div>
              }
            </div>
          </div>
        </div>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: [`
    .tab-content { padding: 24px 0; }
    .production-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .card { padding: 20px; background: var(--color-surface); border-radius: var(--radius-xl); border: 1px solid var(--color-outline-variant); box-shadow: var(--shadow-sm); }
    .card h3 {
      margin: 0 0 16px 0;
      font-size: 18px;
      font-weight: 600;
      color: var(--color-on-surface);
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .card h3 mat-icon { color: var(--color-primary); font-size: 24px; width: 24px; height: 24px; }
    .muted { color: var(--color-on-surface-variant); font-size: 13px; margin: 0 0 16px 0; }
    .empty-text { padding: 24px 0; text-align: center; }

    .form { display: flex; flex-direction: column; gap: 12px; }
    mat-form-field { width: 100%; }

    .type-toggle { width: 100%; margin-bottom: 8px; }
    .modern-toggle {
      background: var(--color-surface);
      border-radius: var(--radius-sm);
      border: 1px solid var(--color-outline-variant);
    }
    ::ng-deep .modern-toggle .mat-button-toggle {
      border: none;
      background: transparent;
      flex: 1;
    }
    ::ng-deep .modern-toggle .mat-button-toggle-checked {
      background: var(--color-primary-fixed) !important;
      color: var(--color-primary) !important;
    }
    ::ng-deep .modern-toggle .mat-button-toggle-label-content {
      font-weight: 600;
      font-size: 13px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    .cost-preview {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: var(--color-error-container);
      border-radius: var(--radius-sm);
      font-size: 14px;
      font-weight: 600;
      color: var(--color-on-error-container);
      margin-bottom: 8px;
    }
    .cost-preview strong { font-size: 18px; }

    /* Historial scrolleable: muestra exactamente 2 items y luego scroll suave. */
    .history-list {
      display: flex;
      flex-direction: column;
      max-height: 128px;          /* ~64px por item × 2 */
      overflow-y: auto;
      scroll-behavior: smooth;
      padding-right: 4px;
    }
    .history-list::-webkit-scrollbar { width: 6px; }
    .history-list::-webkit-scrollbar-track { background: transparent; }
    .history-list::-webkit-scrollbar-thumb { background: var(--color-outline-variant); border-radius: 3px; }
    .history-list::-webkit-scrollbar-thumb:hover { background: var(--color-on-surface-variant); }
    .history-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      min-height: 64px;
      border-bottom: 1px solid var(--color-outline-variant);
      box-sizing: border-box;
      flex-shrink: 0;             /* evita que el flex parent reduzca su altura */
    }
    .history-item:last-child { border-bottom: none; }
    .hi-info { display: flex; flex-direction: column; gap: 2px; }
    .hi-info strong { font-size: 14px; color: var(--color-on-surface); }
    .hi-info .muted { font-size: 12px; margin: 0; }
    .hi-qty {
      background: var(--color-surface-container-high);
      color: var(--color-primary);
      padding: 4px 12px;
      border-radius: var(--radius-full);
      font-weight: 700;
      font-size: 13px;
    }
    .hi-qty.low { background: #FEE2E2; color: #DC2626; }

    .cpp-preview {
      background: var(--color-surface-container-low);
      border-radius: var(--radius-sm);
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      margin: 4px 0;
    }
    .cpp-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: var(--color-on-surface-variant);
    }
    .cpp-row.new { padding-top: 6px; border-top: 1px dashed var(--color-outline-variant); }
    .cpp-row.new strong { color: var(--color-primary); font-size: 15px; }

    .waste-list {
      display: flex;
      flex-direction: column;
      max-height: 140px;          /* ~70px por item × 2 (waste rows tienen 3 líneas) */
      overflow-y: auto;
      scroll-behavior: smooth;
      padding-right: 4px;
    }
    .waste-list::-webkit-scrollbar { width: 6px; }
    .waste-list::-webkit-scrollbar-track { background: transparent; }
    .waste-list::-webkit-scrollbar-thumb { background: var(--color-outline-variant); border-radius: 3px; }
    .waste-list::-webkit-scrollbar-thumb:hover { background: var(--color-on-surface-variant); }
    .waste-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 0;
      min-height: 70px;
      flex-shrink: 0;
      box-sizing: border-box;
      border-bottom: 1px solid var(--color-outline-variant);
    }
    .waste-row:last-child { border-bottom: none; }
    .waste-info { display: flex; flex-direction: column; gap: 2px; }
    .waste-info strong { font-size: 14px; color: var(--color-on-surface); }
    .waste-info .muted { font-size: 12px; margin: 0; }
    .waste-info .muted.small { font-size: 11px; }
    .waste-cost { color: var(--color-error); font-size: 15px; font-weight: 700; }

    .period-bar {
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
      margin-bottom: 24px;
      padding: 12px 16px;
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      border: 1px solid var(--color-outline-variant);
      box-shadow: var(--shadow-sm);
    }
    .period-label {
      font-size: 12px;
      font-weight: 700;
      color: var(--color-on-surface-variant);
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }

    .top5-card {
      margin-top: 24px;
    }

    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .data-table th {
      text-align: left;
      padding: 12px 16px;
      background: var(--color-surface-container-low);
      color: var(--color-on-surface-variant);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid var(--color-outline-variant);
    }
    .data-table td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--color-outline-variant);
      color: var(--color-on-surface);
    }
    .data-table .right { text-align: right; }
    .data-table .rank-col { width: 60px; }
    .warn-color { color: var(--color-error); }

    .rank {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: var(--color-surface-container-high);
      color: var(--color-on-surface-variant);
      font-size: 12px;
      font-weight: 700;
    }
    .rank.gold   { background: #fef3c7; color: #d97706; }
    .rank.silver { background: #e5e7eb; color: #475569; }
    .rank.bronze { background: #fed7aa; color: #c2410c; }

    .reason-badge {
      display: inline-block;
      padding: 4px 10px;
      border-radius: var(--radius-sm);
      background: var(--color-surface-container-high);
      color: var(--color-on-surface);
      font-size: 12px;
      font-weight: 600;
    }

    .qty-row { display: grid; grid-template-columns: 1fr 120px; gap: 12px; }
    .qty-input, .qty-unit { margin: 0; }

    button[type="submit"] {
      height: 48px;
      font-size: 15px;
      font-weight: 600;
      border-radius: var(--radius-sm);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    button[type="submit"] mat-icon {
      margin: 0;
      font-size: 20px;
      width: 20px;
      height: 20px;
    }
    ::ng-deep button[type="submit"] .mdc-button__label {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      width: 100%;
    }
    button[type="submit"]:disabled {
      background: var(--color-primary-fixed) !important;
      color: var(--color-primary) !important;
      border: none !important;
      opacity: 0.7;
    }
  `],
})
export class ProductionComponent implements OnInit {
  prodForm: FormGroup;
  wasteForm: FormGroup;
  resaleForm: FormGroup;
  submittingProd = signal(false);
  submittingWaste = signal(false);
  submittingResale = signal(false);
  kpiFilter = signal<'today' | 'week' | 'month' | 'quarter' | 'year'>('month');

  /** Recetas fabricadas (con BOM) — para el form de Producción. */
  fabricatedRecipes = computed(() => this.recipes.recipes().filter((r) => !r.isResale));
  /** Recetas de reventa — para el form de Compra de Reventa. */
  resaleRecipes = computed(() => this.recipes.recipes().filter((r) => r.isResale));

  // Espejo del form de reventa para reactivar el preview de CPP
  private resaleFormValue = signal<{ recipeId?: string; quantity?: number; unitCost?: number }>({});

  resaleCurrentCpp = computed(() => {
    const id = this.resaleFormValue().recipeId;
    if (!id) return 0;
    const r = this.recipes.recipes().find((rr) => rr.id === id);
    return r?.purchaseCost ?? 0;
  });

  /** CPP nuevo proyectado tras la compra: ((stock × CPPactual) + (qty × precio)) / (stock + qty). */
  resalePreviewCpp = computed(() => {
    const v = this.resaleFormValue();
    const id = v.recipeId;
    const qty = Number(v.quantity ?? 0);
    const cost = Number(v.unitCost ?? 0);
    if (!id || qty <= 0 || cost <= 0) return 0;
    const r = this.recipes.recipes().find((rr) => rr.id === id);
    if (!r) return 0;
    const currentCpp = r.purchaseCost ?? 0;
    const total = r.stock + qty;
    return total > 0 ? (r.stock * currentCpp + qty * cost) / total : cost;
  });

  resaleFormValid(): boolean {
    if (this.resaleForm.invalid) return false;
    const v = this.resaleForm.value;
    return !!v.recipeId && Number(v.quantity) > 0 && Number(v.unitCost) >= 0;
  }

  reasonKeys: WasteReason[] = ['EXPIRY', 'PHYSICAL_DAMAGE', 'CONTAMINATION', 'LOST_BROKEN', 'SPILL', 'OTHER'];
  reasonLabels = WASTE_REASON_LABELS;

  /** OWNER sin sucursal seleccionada (vista global). */
  isGlobalView = computed(
    () => this.authService.role() === 'OWNER' && !this.branchService.selectedBranchId()
  );

  /**
   * Asegura que haya una sucursal seleccionada antes de enviar al backend.
   * En vista global autoselecciona la primera disponible y avisa con snack.
   */
  private async ensureBranchSelected(): Promise<boolean> {
    if (!this.isGlobalView()) return true;
    const firstBranch = this.branchService.branches()[0];
    if (!firstBranch) {
      this.snack.open('No tienes sucursales disponibles. Crea una en Configuración.', 'OK', { duration: 4000 });
      return false;
    }
    this.branchService.selectBranch(firstBranch.id);
    this.snack.open(`Trabajando en sucursal: ${firstBranch.name}`, 'OK', { duration: 2500 });
    return true;
  }

  /**
   * Espejo del valor del waste form en un signal. Necesario porque los
   * `computed()` no pueden observar `wasteForm.value` directamente (no es signal).
   * Se actualiza desde la suscripción a `valueChanges` en el constructor.
   */
  private wasteFormValue = signal<{
    type?: WasteType;
    ingredientId?: string;
    recipeId?: string;
    quantity?: number;
    quantityUnit?: MeasureUnit;
    reason?: WasteReason;
    notes?: string;
  }>({});

  estimatedWasteCost = computed(() => {
    const v = this.wasteFormValue();
    const qty = Number(v.quantity ?? 0);
    if (qty <= 0) return 0;

    if (v.type === 'INGREDIENT' && v.ingredientId) {
      const ing = this.inventory.ingredients().find((i) => i.id === v.ingredientId);
      if (!ing) return 0;
      const qtyBase = this.toBaseFromForm(qty, v.quantityUnit ?? ing.unit, ing.unit);
      return qtyBase * ing.unitCost;
    }
    if (v.type === 'PRODUCT' && v.recipeId) {
      const r = this.recipes.recipes().find((rr) => rr.id === v.recipeId);
      return r ? qty * (r.bomCost ?? 0) : 0;
    }
    return 0;
  });

  selectedIngredientUnit = computed(() => {
    const id = this.wasteFormValue().ingredientId;
    if (!id) return '';
    const ing = this.inventory.ingredients().find((i) => i.id === id);
    return ing ? UNIT_SHORT[ing.unit] : '';
  });

  /** Unidades compatibles con el insumo seleccionado en el form de merma. */
  availableWasteUnits = computed<MeasureUnit[]>(() => {
    const id = this.wasteFormValue().ingredientId;
    if (!id) return [];
    const ing = this.inventory.ingredients().find((i) => i.id === id);
    return ing ? compatibleUnits(ing.unit) : [];
  });

  unitShortLabel(u: MeasureUnit): string {
    return UNIT_SHORT_UTIL[u];
  }

  /** Convierte cantidad+unidad del form a la unidad base del insumo. */
  private toBaseFromForm(qty: number, fromUnit: MeasureUnit, baseUnit: MeasureUnit): number {
    if (!fromUnit) return qty;
    try {
      return convert(qty, fromUnit, baseUnit);
    } catch {
      return qty;
    }
  }

  /** Cuando el usuario cambia de insumo en el form de merma, reseteamos la unidad
   *  a la unidad base del nuevo insumo. */
  onIngredientChange(ingredientId: string): void {
    const ing = this.inventory.ingredients().find((i) => i.id === ingredientId);
    if (!ing) return;
    this.wasteForm.patchValue({ quantityUnit: ing.unit });
  }

  constructor(
    public production: ProductionService,
    public recipes: RecipesService,
    public inventory: InventoryService,
    private branchService: BranchService,
    private authService: AuthService,
    private fb: FormBuilder,
    private snack: MatSnackBar
  ) {
    this.prodForm = this.fb.group({
      recipeId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      notes: [''],
    });

    this.wasteForm = this.fb.group({
      type: ['INGREDIENT' as WasteType, Validators.required],
      ingredientId: [''],
      recipeId: [''],
      quantity: [1, [Validators.required, Validators.min(0.0001)]],
      // Unidad en la que el usuario escribe la cantidad. Se convierte a la base
      // del insumo antes de enviar al backend.
      quantityUnit: ['UNIT' as MeasureUnit],
      reason: ['EXPIRY' as WasteReason, Validators.required],
      notes: [''],
    });

    this.resaleForm = this.fb.group({
      recipeId: ['', Validators.required],
      quantity: [1, [Validators.required, Validators.min(1)]],
      unitCost: [0, [Validators.required, Validators.min(0)]],
      notes: [''],
    });
    this.resaleFormValue.set(this.resaleForm.value);
    this.resaleForm.valueChanges.subscribe((v) => this.resaleFormValue.set(v));

    // Espejo del form en un signal para que los computed() reaccionen.
    this.wasteFormValue.set(this.wasteForm.value);
    this.wasteForm.valueChanges.subscribe((v) => this.wasteFormValue.set(v));
  }

  async ngOnInit(): Promise<void> {
    if (this.authService.role() === 'OWNER') {
      await this.branchService.loadBranches();
    }
    await Promise.all([
      this.production.loadProductions(),
      this.production.loadWastes(),
      this.production.loadWasteKpis(this.kpiFilter()),
      this.recipes.load(),
      this.inventory.load(),
    ]);
  }

  async setKpiFilter(filter: 'today' | 'week' | 'month' | 'quarter' | 'year'): Promise<void> {
    this.kpiFilter.set(filter);
    await this.production.loadWasteKpis(filter);
  }

  reasonLabel(reason: string): string {
    return WASTE_REASON_LABELS[reason as WasteReason] ?? reason;
  }

  unitShort(u?: MeasureUnit): string {
    return u ? UNIT_SHORT[u] : '';
  }

  wasteFormValid(): boolean {
    if (this.wasteForm.invalid) return false;
    const v = this.wasteForm.value;
    if (v.type === 'INGREDIENT' && !v.ingredientId) return false;
    if (v.type === 'PRODUCT' && !v.recipeId) return false;
    return true;
  }

  async submitProduction(): Promise<void> {
    if (this.prodForm.invalid) return;
    if (!(await this.ensureBranchSelected())) return;
    this.submittingProd.set(true);
    try {
      const v = this.prodForm.value;
      const quantity = Number(v.quantity);
      const recipe = this.recipes.recipes().find((r) => r.id === v.recipeId);
      const payload: ProductionPayload = {
        recipeId: v.recipeId,
        quantity,
        notes: v.notes || null,
      };
      await this.production.createProduction(payload);

      // Actualización local instantánea: sabemos exactamente qué insumos consumió
      // la receta. Evita un GET /api/inventory de ~2s post-producción.
      if (recipe) {
        const deltas = new Map<string, number>();
        for (const it of recipe.items) {
          deltas.set(it.ingredient.id, -it.quantity * quantity);
        }
        this.inventory.applyStockDeltas(deltas);
      }

      this.snack.open('Producción registrada con éxito.', 'OK', { duration: 3000 });
      this.prodForm.reset({ recipeId: '', quantity: 1, notes: '' });
    } catch (e: unknown) {
      this.snack.open(e instanceof Error ? e.message : 'Error', 'OK', { duration: 4000 });
    } finally {
      this.submittingProd.set(false);
    }
  }

  /** Cuando el usuario elige el producto de reventa, pre-llenamos el costo
   *  unitario con el CPP actual (es una sugerencia, puede editarlo). */
  onResaleProductChange(recipeId: string): void {
    const r = this.recipes.recipes().find((rr) => rr.id === recipeId);
    if (r?.purchaseCost) {
      this.resaleForm.patchValue({ unitCost: Math.round(r.purchaseCost * 100) / 100 });
    }
  }

  async submitResalePurchase(): Promise<void> {
    if (!this.resaleFormValid()) return;
    if (!(await this.ensureBranchSelected())) return;
    this.submittingResale.set(true);
    try {
      const v = this.resaleForm.value;
      const payload: ResalePurchasePayload = {
        recipeId: v.recipeId,
        quantity: Number(v.quantity),
        unitCost: Number(v.unitCost),
        notes: v.notes || null,
      };
      const result = await this.production.createResalePurchase(payload);
      // Refrescar recetas para que stock y CPP se actualicen en la lista
      await this.recipes.load();
      this.snack.open(
        `Compra registrada. Stock: ${result.recipe.stock} u. CPP: S/ ${result.cpp.new.toFixed(2)}.`,
        'OK',
        { duration: 3500 }
      );
      this.resaleForm.patchValue({ quantity: 1, unitCost: 0, notes: '' });
    } catch (e: unknown) {
      this.snack.open(e instanceof Error ? e.message : 'Error', 'OK', { duration: 4000 });
    } finally {
      this.submittingResale.set(false);
    }
  }

  async submitWaste(): Promise<void> {
    if (!this.wasteFormValid()) return;
    if (!(await this.ensureBranchSelected())) return;
    this.submittingWaste.set(true);
    try {
      const v = this.wasteForm.value;
      const qty = Number(v.quantity);

      // Para merma de INSUMO, convertir desde la unidad escogida a la unidad base.
      // Para merma de PRODUCTO, la cantidad es número de unidades (sin conversión).
      let qtyToSend = qty;
      if (v.type === 'INGREDIENT' && v.ingredientId) {
        const ing = this.inventory.ingredients().find((i) => i.id === v.ingredientId);
        if (ing) qtyToSend = this.toBaseFromForm(qty, v.quantityUnit, ing.unit);
      }

      const payload: WastePayload = {
        type: v.type,
        ingredientId: v.type === 'INGREDIENT' ? v.ingredientId : null,
        recipeId: v.type === 'PRODUCT' ? v.recipeId : null,
        quantity: qtyToSend,
        reason: v.reason,
        notes: v.notes || null,
      };
      await this.production.createWaste(payload);

      // Actualización local instantánea del inventario si es merma de insumo:
      // evita GET /api/inventory de ~2s post-merma.
      if (v.type === 'INGREDIENT' && v.ingredientId) {
        const deltas = new Map<string, number>([[v.ingredientId, -qtyToSend]]);
        this.inventory.applyStockDeltas(deltas);
      }

      this.snack.open('Merma registrada', 'OK', { duration: 2500 });
      this.wasteForm.patchValue({ quantity: 1, notes: '' });
      // KPIs de merma sí los pedimos al backend porque dependen de cálculos del servidor.
      await this.production.loadWasteKpis(this.kpiFilter());
    } catch (e: unknown) {
      this.snack.open(e instanceof Error ? e.message : 'Error', 'OK', { duration: 4000 });
    } finally {
      this.submittingWaste.set(false);
    }
  }
}
