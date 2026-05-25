import { Component, Inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Ingredient, MeasureUnit } from '../../core/models';
import { compatibleUnits, convert, UNIT_SHORT as UNIT_SHORT_UTIL, UNIT_LONG } from '../../core/utils/units';
import { getErrorMessage } from '../../core/utils/error-message';
import {
  InventoryCountsService,
  CountPayload,
  InventoryCount,
} from '../../core/services/inventory-counts.service';

/** "Unidad" virtual para indicar que la cantidad se ingresa en presentaciones. */
const PRESENTATION_UNIT = 'PRESENTACION' as const;
type CountUnit = MeasureUnit | typeof PRESENTATION_UNIT;

interface DialogData {
  ingredient: Ingredient;
}

@Component({
  selector: 'app-count-dialog',
  standalone: true,
  imports: [
    CommonModule, CurrencyPipe, DatePipe, DecimalPipe, ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatDividerModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog">
      <h2 class="title">
        <mat-icon>fact_check</mat-icon> Conteo Físico
      </h2>

      <p class="subtitle">
        <strong>{{ data.ingredient.name }}</strong>
      </p>

      <div class="stock-comparison">
        <div class="stock-box theoretical">
          <span class="label">Stock teórico (sistema)</span>
          <strong>{{ expectedDisplay() | number:'1.0-2' }}</strong>
          <span class="unit">{{ unitLabelLong() }}</span>
        </div>
        <mat-icon class="vs-icon">compare_arrows</mat-icon>
        <div class="stock-box actual">
          <span class="label">Stock real (contado)</span>
          <strong>{{ actualDisplay() | number:'1.0-2' }}</strong>
          <span class="unit">{{ unitLabelLong() }}</span>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form">
        <div class="qty-row">
          <mat-form-field appearance="outline" class="qty-input">
            <mat-label>Cantidad real contada</mat-label>
            <input matInput type="number" formControlName="actualQty" min="0" step="any" />
            <mat-hint>{{ actualHint() }}</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline" class="qty-unit">
            <mat-label>Unidad</mat-label>
            <mat-select formControlName="actualUnit">
              <mat-option [value]="PRESENTATION_UNIT">presentación ({{ data.ingredient.presentationSize }} {{ baseUnitShort() }})</mat-option>
              @for (u of availableUnits; track u) {
                <mat-option [value]="u">{{ unitLong(u) }} ({{ unitShort(u) }})</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>Notas / Observaciones</mat-label>
          <textarea matInput formControlName="notes" rows="2" placeholder="Detalles del conteo, dónde se hizo, quién lo hizo..."></textarea>
        </mat-form-field>

        <!-- Resumen de la varianza -->
        <div class="variance-summary" [class.merma]="varianceQty() < 0" [class.exceso]="varianceQty() > 0" [class.cuadra]="varianceQty() === 0">
          <div class="variance-header">
            <mat-icon>{{ varianceIcon() }}</mat-icon>
            <strong>{{ varianceTitle() }}</strong>
          </div>
          <div class="variance-row">
            <span>Diferencia</span>
            <strong>
              {{ varianceDisplay() > 0 ? '+' : '' }}{{ varianceDisplay() | number:'1.0-2' }} {{ unitLabelLong() }}
            </strong>
          </div>
          <div class="variance-row">
            <span>Impacto monetario</span>
            <strong>{{ varianceCost() | currency:'S/ ':'symbol':'1.2-2' }}</strong>
          </div>
          @if (varianceQty() < 0) {
            <p class="variance-note">
              Al confirmar, se generará automáticamente una merma por el faltante
              y el stock se ajustará al valor real contado.
            </p>
          } @else if (varianceQty() > 0) {
            <p class="variance-note">
              Hay más stock del esperado. ¿Falta registrar alguna compra?
              Al confirmar, el stock se ajustará al alza.
            </p>
          }
        </div>

        <div class="actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close()" [disabled]="saving()">Cancelar</button>
          <button mat-flat-button [color]="varianceQty() < 0 ? 'warn' : 'primary'" type="submit" [disabled]="!formValid() || saving()" class="submit-btn">
            @if (saving()) {
              <mat-spinner diameter="18" />
              <span>Procesando...</span>
            } @else {
              <span>{{ varianceQty() < 0 ? 'Confirmar y registrar merma' : 'Confirmar conteo' }}</span>
            }
          </button>
        </div>
      </form>

      <mat-divider />

      <!-- Historial -->
      <div class="history">
        <h3><mat-icon>history</mat-icon> Últimos conteos</h3>
        @if (loadingHistory()) {
          <div class="loading-mini"><mat-spinner diameter="22" /></div>
        } @else if (history().length === 0) {
          <p class="muted small">Aún no hay conteos registrados.</p>
        } @else {
          <ul class="history-list">
            @for (c of history(); track c.id) {
              <li>
                <div>
                  <strong>{{ c.createdAt | date:'dd/MM/yyyy HH:mm' }}</strong>
                  <span class="muted small">
                    Esperado: {{ presentationsOf(c.expectedStock) | number:'1.0-2' }} · Real: {{ presentationsOf(c.actualStock) | number:'1.0-2' }}
                  </span>
                </div>
                <strong [class.bad]="c.varianceCost < 0" [class.good]="c.varianceCost >= 0">
                  {{ c.varianceCost | currency:'S/ ':'symbol':'1.2-2' }}
                </strong>
              </li>
            }
          </ul>
        }
      </div>
    </div>
  `,
  styles: [`
    .dialog { padding: 24px; width: 600px; max-width: calc(100vw - 32px); max-height: 90vh; overflow-y: auto; box-sizing: border-box; }
    @media (max-width: 540px) { .dialog { padding: 16px; } }
    ::ng-deep .dialog mat-hint { display: block; white-space: normal !important; line-height: 1.3; }
    .title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 18px; font-weight: 700; color: #1E293B; }
    .title mat-icon { color: #6366F1; }
    .subtitle { margin: 8px 0 16px 0; font-size: 14px; }
    .muted { color: #64748B; }
    .small { font-size: 12px; }

    .stock-comparison {
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      gap: 12px;
      margin-bottom: 16px;
      align-items: center;
    }
    @media (max-width: 540px) {
      .stock-comparison { grid-template-columns: 1fr; }
      .stock-comparison .vs-icon { display: none; }
    }
    .stock-box {
      padding: 12px 16px;
      border-radius: 10px;
      background: #F8FAFC;
      display: flex;
      flex-direction: column;
      gap: 2px;
      text-align: center;
    }
    .stock-box.theoretical { border: 1px solid #E2E8F0; }
    .stock-box.actual { background: #EEF2FF; border: 1px solid #C7D2FE; }
    .stock-box .label { font-size: 11px; color: #64748B; text-transform: uppercase; font-weight: 600; letter-spacing: 0.5px; }
    .stock-box strong { font-size: 22px; color: #1E293B; }
    .stock-box .unit { font-size: 12px; color: #64748B; }
    .vs-icon { color: #94A3B8; }

    .form { display: flex; flex-direction: column; gap: 10px; }
    mat-form-field { width: 100%; }
    .qty-row { display: grid; grid-template-columns: 1fr 180px; gap: 12px; }
    @media (max-width: 540px) {
      .qty-row { grid-template-columns: 1fr; }
    }
    .qty-input, .qty-unit { margin: 0; }

    .variance-summary {
      padding: 14px 16px;
      border-radius: 10px;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .variance-summary.merma { background: #FEF2F2; border: 1px solid #FCA5A5; }
    .variance-summary.exceso { background: #FEF3C7; border: 1px solid #FCD34D; }
    .variance-summary.cuadra { background: #D1FAE5; border: 1px solid #6EE7B7; }
    .variance-header { display: flex; align-items: center; gap: 6px; }
    .variance-header strong { font-size: 14px; }
    .variance-summary.merma .variance-header strong, .variance-summary.merma mat-icon { color: #DC2626; }
    .variance-summary.exceso .variance-header strong, .variance-summary.exceso mat-icon { color: #D97706; }
    .variance-summary.cuadra .variance-header strong, .variance-summary.cuadra mat-icon { color: #059669; }
    .variance-row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #475569;
    }
    .variance-row strong { color: #1E293B; }
    .variance-note { margin: 8px 0 0 0; font-size: 12px; color: #64748B; line-height: 1.4; }

    .actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      flex-wrap: wrap;
    }
    .actions button { height: 40px; }
    .submit-btn { min-width: 220px; }
    ::ng-deep .submit-btn .mdc-button__label {
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
      gap: 8px;
      line-height: 1;
    }
    ::ng-deep .submit-btn mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      margin: 0 !important;
      line-height: 18px;
    }
    ::ng-deep .submit-btn mat-spinner circle { stroke: #fff !important; }

    .history { padding-top: 16px; }
    .history h3 {
      margin: 0 0 8px 0;
      font-size: 14px;
      font-weight: 700;
      color: #1E293B;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .history h3 mat-icon { color: #6366F1; font-size: 18px; width: 18px; height: 18px; }
    .history-list {
      list-style: none;
      padding: 0 4px 0 0;
      margin: 0;
      max-height: 108px;        /* ~54px por item × 2 = 108px */
      overflow-y: auto;
      scroll-behavior: smooth;
    }
    .history-list::-webkit-scrollbar { width: 6px; }
    .history-list::-webkit-scrollbar-track { background: transparent; }
    .history-list::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
    .history-list::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
    .history-list li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      min-height: 54px;
      border-bottom: 1px solid #F1F5F9;
      font-size: 13px;
      box-sizing: border-box;
    }
    .history-list li:last-child { border-bottom: none; }
    .history-list strong { display: block; color: #1E293B; }
    .history-list strong.bad { color: #DC2626; }
    .history-list strong.good { color: #059669; }
    .loading-mini { display: flex; justify-content: center; padding: 16px 0; }
  `],
})
export class CountDialogComponent implements OnInit {
  form: FormGroup;
  saving = signal(false);
  loadingHistory = signal(false);
  history = signal<InventoryCount[]>([]);
  formValid = signal(false);

  /** Constante expuesta al template para el option "presentación". */
  readonly PRESENTATION_UNIT = PRESENTATION_UNIT;

  /** Unidades compatibles (kg/g, l/ml, unit) según la unidad base del insumo. */
  readonly availableUnits: MeasureUnit[] = compatibleUnits(this.data.ingredient.unit);

  /** Espejo de los valores del form en signals para que los computed reaccionen. */
  private actualQtySig = signal(0);
  private actualUnitSig = signal<CountUnit>(PRESENTATION_UNIT);

  /** Convierte cantidad+unidad seleccionada → unidad BASE del insumo (kg, g, l, ml, unit). */
  private toBase(qty: number, unit: CountUnit): number {
    if (unit === PRESENTATION_UNIT) {
      return qty * this.data.ingredient.presentationSize;
    }
    try {
      return convert(qty, unit, this.data.ingredient.unit);
    } catch {
      return 0;
    }
  }

  /** Convierte un valor en unidad BASE → cantidad en la unidad seleccionada actualmente. */
  private fromBase(qtyBase: number, unit: CountUnit): number {
    if (unit === PRESENTATION_UNIT) {
      const size = this.data.ingredient.presentationSize;
      return size > 0 ? qtyBase / size : 0;
    }
    try {
      return convert(qtyBase, this.data.ingredient.unit, unit);
    } catch {
      return 0;
    }
  }

  /** Stock teórico en la unidad seleccionada (para mostrar en el stock-box). */
  expectedDisplay = computed(() =>
    this.fromBase(this.data.ingredient.stock, this.actualUnitSig())
  );

  /** Stock real (lo que tipeó el usuario) — ya está en la unidad seleccionada. */
  actualDisplay = computed(() => this.actualQtySig());

  /** Diferencia en la unidad seleccionada (lo que se muestra al usuario). */
  varianceDisplay = computed(() => this.actualDisplay() - this.expectedDisplay());

  /** Diferencia en unidad BASE — para enviar al backend y calcular costo. */
  private varianceInBase = computed(() =>
    this.toBase(this.actualQtySig(), this.actualUnitSig()) - this.data.ingredient.stock
  );

  /** Solo necesario para los class bindings (merma/exceso/cuadra) y el botón. */
  varianceQty = computed(() => this.varianceInBase());

  varianceCost = computed(
    () => this.varianceInBase() * this.data.ingredient.unitCost
  );

  varianceTitle = computed(() => {
    const v = this.varianceQty();
    if (v < 0) return 'Merma detectada';
    if (v > 0) return 'Stock en exceso';
    return 'Stock cuadra exactamente';
  });

  varianceIcon = computed(() => {
    const v = this.varianceQty();
    if (v < 0) return 'warning';
    if (v > 0) return 'trending_up';
    return 'check_circle';
  });

  /** Label largo de la unidad actual para mostrar bajo el número. */
  unitLabelLong = computed(() => {
    const u = this.actualUnitSig();
    return u === PRESENTATION_UNIT ? 'presentaciones' : UNIT_LONG[u].toLowerCase();
  });

  baseUnitShort(): string {
    return UNIT_SHORT_UTIL[this.data.ingredient.unit];
  }

  unitShort(u: MeasureUnit): string { return UNIT_SHORT_UTIL[u]; }
  unitLong(u: MeasureUnit): string { return UNIT_LONG[u]; }

  constructor(
    public dialogRef: MatDialogRef<CountDialogComponent, boolean | null>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private counts: InventoryCountsService,
    private snack: MatSnackBar,
    fb: FormBuilder
  ) {
    // El form arranca con el stock teórico en presentaciones (default).
    const startQty = this.round3(this.data.ingredient.stock / this.data.ingredient.presentationSize);

    this.form = fb.group({
      actualQty: [startQty, [Validators.required, Validators.min(0)]],
      actualUnit: [PRESENTATION_UNIT as CountUnit, Validators.required],
      notes: [''],
    });

    // Mirror form → signals
    this.actualQtySig.set(Number(this.form.value.actualQty) || 0);
    this.actualUnitSig.set(this.form.value.actualUnit as CountUnit);

    this.form.valueChanges.subscribe((v) => {
      this.actualQtySig.set(Number(v.actualQty) || 0);
      this.actualUnitSig.set(v.actualUnit as CountUnit);
    });

    // Cuando el usuario cambia de unidad, convertir el valor actual a la nueva
    // unidad para que el número visible siga representando lo mismo. Ej:
    // tipea "2 presentaciones" (= 100 kg) y cambia a "kg" → el input pasa a 100.
    this.form.get('actualUnit')?.valueChanges.subscribe((newUnit: CountUnit) => {
      const oldUnit = this.actualUnitSig();
      if (newUnit === oldUnit) return;
      const currentQty = Number(this.form.value.actualQty) || 0;
      const inBase = this.toBase(currentQty, oldUnit);
      const newQty = this.fromBase(inBase, newUnit);
      // patchValue no dispara valueChanges en el mismo control (con emitEvent: false)
      this.form.patchValue({ actualQty: this.round3(newQty) }, { emitEvent: true });
    });

    this.formValid.set(this.form.valid);
    this.form.statusChanges.subscribe((status) => {
      this.formValid.set(status === 'VALID');
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadHistory();
  }

  /** Hint dinámico bajo el input — muestra la equivalencia en otras unidades. */
  actualHint(): string {
    const qty = this.actualQtySig();
    const unit = this.actualUnitSig();
    if (qty <= 0) return 'Cuenta físicamente lo que tienes en almacén';

    const inBase = this.toBase(qty, unit);
    const baseUnitShort = UNIT_SHORT_UTIL[this.data.ingredient.unit];
    const size = this.data.ingredient.presentationSize;

    if (unit === PRESENTATION_UNIT) {
      return `Equivale a ${this.round3(inBase)} ${baseUnitShort} en total`;
    }
    // Mostrar equivalencia en presentaciones cuando el usuario tipea en kg/g/etc.
    const presentations = size > 0 ? this.round3(inBase / size) : 0;
    return `Equivale a ${presentations} presentaci${presentations === 1 ? 'ón' : 'ones'} (${size} ${baseUnitShort} c/u)`;
  }

  presentationsOf(stockBase: number): number {
    return stockBase / this.data.ingredient.presentationSize;
  }

  private async loadHistory(): Promise<void> {
    this.loadingHistory.set(true);
    try {
      const items = await this.counts.list(this.data.ingredient.id);
      this.history.set(items);
    } catch {
      // silencioso
    } finally {
      this.loadingHistory.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const v = this.form.value;
      const inBase = this.toBase(Number(v.actualQty), v.actualUnit as CountUnit);
      const payload: CountPayload = {
        actualStock: inBase,
        notes: v.notes?.trim() || null,
      };
      await this.counts.create(this.data.ingredient.id, payload);

      const varCost = this.varianceCost();
      const msg =
        varCost < 0
          ? `Conteo registrado. Merma de S/ ${Math.abs(varCost).toFixed(2)} generada.`
          : 'Conteo registrado. Stock ajustado.';
      this.snack.open(msg, 'OK', { duration: 3500 });
      this.dialogRef.close(true);
    } catch (e: unknown) {
      this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  private round3(n: number): number { return Math.round(n * 1000) / 1000; }
}
