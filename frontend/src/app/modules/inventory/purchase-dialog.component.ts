import { Component, Inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule, CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDividerModule } from '@angular/material/divider';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Ingredient, MeasureUnit } from '../../core/models';
import {
  PurchasesService,
  PurchasePayload,
  Purchase,
} from '../../core/services/purchases.service';

interface DialogData {
  ingredient: Ingredient;
}

const UNIT_SHORT: Record<MeasureUnit, string> = {
  KG: 'kg', G: 'g', L: 'l', ML: 'ml', UNIT: 'unidad',
};

@Component({
  selector: 'app-purchase-dialog',
  standalone: true,
  imports: [
    CommonModule, CurrencyPipe, DatePipe, DecimalPipe, ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule,
    MatButtonModule, MatIconModule, MatDividerModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog">
      <h2 class="title">
        <mat-icon>shopping_cart</mat-icon> Registrar Compra
      </h2>

      <p class="subtitle">
        <strong>{{ data.ingredient.name }}</strong>
        <span class="muted"> · Stock actual: {{ currentStockPresentations() | number:'1.0-2' }} presentaciones</span>
      </p>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form-grid">
        <mat-form-field appearance="outline">
          <mat-label>Cantidad comprada (presentaciones)</mat-label>
          <input matInput type="number" formControlName="quantityPresentations" min="0" step="any" />
          <mat-hint>{{ quantityHint() }}</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Costo por presentación</mat-label>
          <span matTextPrefix>S/&nbsp;</span>
          <input matInput type="number" formControlName="costPerPresentation" min="0" step="0.01" />
          <mat-hint>Total: {{ totalCost() | currency:'S/ ':'symbol':'1.2-2' }}</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="span-2">
          <mat-label>Proveedor (opcional)</mat-label>
          <input matInput formControlName="supplier" placeholder="Distribuidora ABC" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="span-2">
          <mat-label>Notas (opcional)</mat-label>
          <textarea matInput formControlName="notes" rows="2"></textarea>
        </mat-form-field>

        <!-- Preview de CPP -->
        <div class="cpp-preview span-2">
          <div class="cpp-row">
            <span>Costo Promedio actual</span>
            <strong>S/ {{ currentCostPerPresentation() | number:'1.2-2' }} por presentación</strong>
          </div>
          <div class="cpp-row cpp-new">
            <span>Costo Promedio nuevo (CPP)</span>
            <strong>S/ {{ newCostPerPresentation() | number:'1.2-2' }} por presentación</strong>
          </div>
          <div class="cpp-explanation">
            <mat-icon>info</mat-icon>
            <span>{{ cppExplanation() }}</span>
          </div>
        </div>

        <div class="actions span-2">
          <button mat-stroked-button type="button" (click)="dialogRef.close()" [disabled]="saving()">Cancelar</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="!formValid() || saving()" class="submit-btn">
            @if (saving()) {
              <mat-spinner diameter="18" />
              <span>Procesando...</span>
            } @else {
              <mat-icon>check</mat-icon>
              <span>Confirmar Compra</span>
            }
          </button>
        </div>

      </form>

      <mat-divider class="hist-divider" />

      <!-- Historial -->
      <div class="history">
        <h3><mat-icon>history</mat-icon> Últimas compras</h3>
        @if (loadingHistory()) {
          <div class="loading-mini"><mat-spinner diameter="22" /></div>
        } @else if (history().length === 0) {
          <p class="muted small">Aún no hay compras registradas.</p>
        } @else {
          <ul class="history-list">
            @for (p of history(); track p.id) {
              <li>
                <div>
                  <strong>{{ presentationsOf(p) | number:'1.0-2' }} presentaciones</strong>
                  <span class="muted small">{{ p.createdAt | date:'dd/MM/yyyy HH:mm' }}</span>
                </div>
                <div class="history-cost">
                  <span>S/ {{ costPerPresentationOf(p) | number:'1.2-2' }} c/u</span>
                  <strong>{{ p.totalCost | currency:'S/ ':'symbol':'1.2-2' }}</strong>
                </div>
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
    .title { display: flex; align-items: center; gap: 8px; margin: 0; font-size: 18px; font-weight: 700; color: #1E293B; }
    .title mat-icon { color: #6366F1; }
    .subtitle { margin: 8px 0 16px 0; font-size: 14px; }
    .muted { color: #64748B; }
    .small { font-size: 12px; }

    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
    .span-2 { grid-column: 1 / -1; }
    @media (max-width: 540px) {
      .form-grid { grid-template-columns: 1fr; }
      .span-2 { grid-column: 1; }
    }
    mat-form-field { width: 100%; }
    ::ng-deep .dialog mat-hint { display: block; white-space: normal !important; line-height: 1.3; }

    .cpp-preview {
      background: #F8FAFC;
      border-radius: 10px;
      padding: 14px 16px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .cpp-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
      color: #475569;
    }
    .cpp-row strong { color: #1E293B; }
    .cpp-row.cpp-new { padding-top: 8px; border-top: 1px dashed #CBD5E1; }
    .cpp-row.cpp-new strong { color: #4F46E5; font-size: 15px; }

    .cpp-explanation {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      font-size: 12px;
      color: #4338CA;
      background: #EEF2FF;
      padding: 8px 10px;
      border-radius: 6px;
      margin-top: 4px;
      line-height: 1.4;
    }
    .cpp-explanation mat-icon { font-size: 14px; width: 14px; height: 14px; flex-shrink: 0; margin-top: 2px; }

    .actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      margin-top: 4px;        /* mínimo, el form-grid ya añade 12px de gap */
      flex-wrap: wrap;
    }
    .actions button { height: 40px; }
    .submit-btn { min-width: 180px; }
    /* Material envuelve el contenido en .mdc-button__label — forzar flex ahí
       para que el icono y el texto queden verticalmente alineados. */
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
    /* Separador del historial — un poco de espacio respiratorio */
    .hist-divider { margin: 18px 0 14px 0; }

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
    /* Historial scrolleable: muestra exactamente 2 items y luego scroll suave. */
    .history-list {
      list-style: none;
      padding: 0 4px 0 0;       /* espacio para que el scrollbar no se monte sobre el contenido */
      margin: 0;
      max-height: 108px;        /* ~54px por item × 2 = 108px */
      overflow-y: auto;
      scroll-behavior: smooth;
    }
    .history-list li {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      min-height: 54px;          /* fija altura predecible por item */
      border-bottom: 1px solid #F1F5F9;
      font-size: 13px;
      box-sizing: border-box;
    }
    .history-list li:last-child { border-bottom: none; }
    /* Scrollbar discreto */
    .history-list::-webkit-scrollbar { width: 6px; }
    .history-list::-webkit-scrollbar-track { background: transparent; }
    .history-list::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 3px; }
    .history-list::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
    .history-list strong { display: block; color: #1E293B; }
    .history-cost { text-align: right; display: flex; flex-direction: column; }
    .history-cost span { font-size: 11px; color: #94A3B8; }
    .history-cost strong { color: #1E293B; }

    .loading-mini { display: flex; justify-content: center; padding: 16px 0; }
  `],
})
export class PurchaseDialogComponent implements OnInit {
  form: FormGroup;
  saving = signal(false);
  loadingHistory = signal(false);
  history = signal<Purchase[]>([]);
  formValid = signal(false);

  private quantityP = signal(0);
  private costP = signal(0);

  currentStockPresentations = computed(
    () => this.data.ingredient.stock / this.data.ingredient.presentationSize
  );

  currentCostPerPresentation = computed(
    () => this.data.ingredient.unitCost * this.data.ingredient.presentationSize
  );

  totalCost = computed(() => this.quantityP() * this.costP());

  /** CPP nuevo: ((stock×CPPactual) + (qty×costoCompra)) / (stock+qty). */
  newCostPerPresentation = computed(() => {
    const currentStockBase = this.data.ingredient.stock;
    const currentCostBase = this.data.ingredient.unitCost;
    const newQtyBase = this.quantityP() * this.data.ingredient.presentationSize;
    const newCostBase = this.costP() / this.data.ingredient.presentationSize;

    if (newQtyBase <= 0) return this.currentCostPerPresentation();

    const totalStock = currentStockBase + newQtyBase;
    if (totalStock <= 0) return newCostBase * this.data.ingredient.presentationSize;

    const cppBase =
      (currentStockBase * currentCostBase + newQtyBase * newCostBase) / totalStock;
    return cppBase * this.data.ingredient.presentationSize;
  });

  cppExplanation = computed(() => {
    const oldCost = this.currentCostPerPresentation();
    const newCost = this.newCostPerPresentation();
    if (this.quantityP() <= 0) return 'Ingresa la cantidad comprada para ver el nuevo CPP.';
    const diff = newCost - oldCost;
    if (Math.abs(diff) < 0.01) {
      return 'El costo se mantiene prácticamente igual al promedio actual.';
    }
    const dir = diff > 0 ? 'sube' : 'baja';
    return `El CPP ${dir} S/ ${Math.abs(diff).toFixed(2)} por presentación. Esto afectará el cálculo de márgenes de los productos que usen este insumo.`;
  });

  quantityHint(): string {
    const q = this.quantityP();
    const size = this.data.ingredient.presentationSize;
    if (q <= 0 || size <= 0) return 'Ej: 5 (sacos, bolsas, cajas, etc.)';
    return `Equivale a ${this.round3(q * size)} ${UNIT_SHORT[this.data.ingredient.unit]} en total`;
  }

  constructor(
    public dialogRef: MatDialogRef<PurchaseDialogComponent, boolean | null>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    private purchases: PurchasesService,
    private snack: MatSnackBar,
    fb: FormBuilder
  ) {
    this.form = fb.group({
      quantityPresentations: [0, [Validators.required, Validators.min(0.0001)]],
      costPerPresentation: [
        this.round2(this.data.ingredient.unitCost * this.data.ingredient.presentationSize),
        [Validators.required, Validators.min(0.0001)],
      ],
      supplier: [''],
      notes: [''],
    });
    this.costP.set(Number(this.form.value.costPerPresentation) || 0);
    this.form.valueChanges.subscribe((v) => {
      this.quantityP.set(Number(v.quantityPresentations) || 0);
      this.costP.set(Number(v.costPerPresentation) || 0);
    });

    // Mirror del estado de validez para reactivar el botón Confirmar Compra
    this.formValid.set(this.form.valid);
    this.form.statusChanges.subscribe((status) => {
      this.formValid.set(status === 'VALID');
    });
  }

  async ngOnInit(): Promise<void> {
    await this.loadHistory();
  }

  presentationsOf(p: Purchase): number {
    return p.quantity / this.data.ingredient.presentationSize;
  }

  costPerPresentationOf(p: Purchase): number {
    return p.unitCost * this.data.ingredient.presentationSize;
  }

  private async loadHistory(): Promise<void> {
    this.loadingHistory.set(true);
    try {
      const items = await this.purchases.list(this.data.ingredient.id);
      this.history.set(items);
    } catch {
      // silencioso — historial es informativo
    } finally {
      this.loadingHistory.set(false);
    }
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) return;
    this.saving.set(true);
    try {
      const v = this.form.value;
      const size = this.data.ingredient.presentationSize;
      const payload: PurchasePayload = {
        quantity: Number(v.quantityPresentations) * size,
        unitCost: Number(v.costPerPresentation) / size,
        supplier: v.supplier?.trim() || null,
        notes: v.notes?.trim() || null,
      };
      const result = await this.purchases.create(this.data.ingredient.id, payload);
      const newCpp = (result.cpp.new * size).toFixed(2);
      this.snack.open(`Compra registrada. Nuevo CPP: S/ ${newCpp} por presentación.`, 'OK', { duration: 4000 });
      this.dialogRef.close(true);
    } catch (e: unknown) {
      this.snack.open(e instanceof Error ? e.message : 'Error', 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  private round2(n: number): number { return Math.round(n * 100) / 100; }
  private round3(n: number): number { return Math.round(n * 1000) / 1000; }
}
