import { Component, Inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Ingredient, MeasureUnit } from '../../core/models';
import { IngredientPayload } from '../../core/services/inventory.service';

interface DialogData {
  ingredient: Ingredient | null;
}

const UNIT_LABELS: Record<MeasureUnit, string> = {
  KG: 'Kilogramos (kg)',
  G: 'Gramos (g)',
  L: 'Litros (l)',
  ML: 'Mililitros (ml)',
  UNIT: 'Unidades',
};

const BASE_UNIT_SHORT: Record<MeasureUnit, string> = {
  KG: 'kg', G: 'g', L: 'l', ML: 'ml', UNIT: 'unidades',
};

@Component({
  selector: 'app-ingredient-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="dialog">
      <h2 class="title">
        <mat-icon>{{ data.ingredient ? 'edit' : 'add' }}</mat-icon>
        {{ data.ingredient ? 'Editar' : 'Nuevo' }} Insumo
      </h2>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form-grid">
        <mat-form-field appearance="outline" class="span-2">
          <mat-label>Nombre del Insumo</mat-label>
          <input matInput formControlName="name" placeholder="Harina de trigo" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Unidad de Medida</mat-label>
          <mat-select formControlName="unit">
            @for (key of unitKeys; track key) {
              <mat-option [value]="key">{{ unitLabels[key] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Tamaño de Presentación</mat-label>
          <input matInput type="number" formControlName="presentationSize" min="0" step="any" />
          <mat-hint>1 presentación = {{ form.value.presentationSize || 0 }} {{ currentUnitShort() }}</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Cantidad en Stock (presentaciones)</mat-label>
          <input matInput type="number" formControlName="stockPresentations" min="0" step="any" />
          <mat-hint>{{ stockHint() }}</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Stock Mínimo (presentaciones)</mat-label>
          <input matInput type="number" formControlName="minStockPresentations" min="0" step="any" />
          <mat-hint>Cantidad por debajo de la cual se marca como crítico</mat-hint>
        </mat-form-field>

        <mat-form-field appearance="outline" class="span-2">
          <mat-label>Costo por Presentación</mat-label>
          <span matTextPrefix>S/&nbsp;</span>
          <input matInput type="number" formControlName="costPerPresentation" min="0" step="0.01" />
          <mat-hint>Lo que pagas por 1 presentación completa (1 bolsa, 1 kg, 1 caja, etc.)</mat-hint>
        </mat-form-field>

        @if (errorMessage()) {
          <div class="error span-2">
            <mat-icon>error_outline</mat-icon>
            {{ errorMessage() }}
          </div>
        }

        <div class="actions span-2">
          <button mat-stroked-button type="button" (click)="dialogRef.close()" [disabled]="loading()">Cancelar</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="loading() || !formValid()" class="submit-btn">
            @if (loading()) {
              <mat-spinner diameter="18" />
              <span>Procesando...</span>
            } @else {
              <span>{{ data.ingredient ? 'Actualizar' : 'Crear Insumo' }}</span>
            }
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    /* Responsive: en desktop usa 600px, en pantallas chicas se adapta al ancho disponible */
    .dialog {
      padding: 24px;
      width: 600px;
      max-width: calc(100vw - 32px);
      box-sizing: border-box;
    }
    .title { display: flex; align-items: center; gap: 8px; margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: #1E293B; }
    .title mat-icon { color: #6366F1; }
    /* Grid de 2 columnas en desktop, 1 sola en mobile */
    .form-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .span-2 { grid-column: 1 / -1; }
    /* Cuando el viewport es estrecho, colapsar a una columna para evitar
       que los hints largos compriman los inputs y generen scroll horizontal. */
    @media (max-width: 540px) {
      .dialog { padding: 16px; }
      .form-grid { grid-template-columns: 1fr; }
      .span-2 { grid-column: 1; }
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 8px;
      margin-top: 4px;
      flex-wrap: wrap;
    }
    .actions button { height: 40px; }
    .submit-btn { min-width: 160px; }
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
    .error { display: flex; align-items: center; gap: 8px; background: #FEE2E2; color: #DC2626; padding: 10px 12px; border-radius: 8px; font-size: 13px; }
    mat-form-field { width: 100%; }
    /* Hints largos que se desborden — wrap natural en lugar de truncar */
    ::ng-deep .dialog .mat-mdc-form-field-hint-wrapper { padding: 0 12px; }
    ::ng-deep .dialog mat-hint {
      display: block;
      white-space: normal !important;
      line-height: 1.3;
    }
  `],
})
export class IngredientFormDialogComponent {
  form: FormGroup;
  loading = signal(false);
  errorMessage = signal('');
  formValid = signal(false);
  unitKeys: MeasureUnit[] = ['KG', 'G', 'L', 'ML', 'UNIT'];
  unitLabels = UNIT_LABELS;

  constructor(
    public dialogRef: MatDialogRef<IngredientFormDialogComponent, IngredientPayload | null>,
    @Inject(MAT_DIALOG_DATA) public data: DialogData,
    fb: FormBuilder
  ) {
    const i = data.ingredient;
    const presentationSize = i?.presentationSize ?? 1;

    // Convertir de unidad base (DB) a presentaciones (UI)
    const stockPresentations = i ? this.round4(i.stock / presentationSize) : 0;
    const minStockPresentations = i ? this.round4(i.minStock / presentationSize) : 0;
    const costPerPresentation = i ? this.round4(i.unitCost * presentationSize) : 0;

    this.form = fb.group({
      name: [i?.name ?? '', [Validators.required, Validators.minLength(1)]],
      unit: [i?.unit ?? 'UNIT', Validators.required],
      presentationSize: [presentationSize, [Validators.required, Validators.min(0.0001)]],
      stockPresentations: [stockPresentations, [Validators.required, Validators.min(0)]],
      minStockPresentations: [minStockPresentations, [Validators.required, Validators.min(0)]],
      costPerPresentation: [costPerPresentation, [Validators.required, Validators.min(0.0001)]],
    });

    // Mirror del estado de validez para que el botón reactive correctamente
    this.formValid.set(this.form.valid);
    this.form.statusChanges.subscribe((status) => {
      this.formValid.set(status === 'VALID');
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const v = this.form.value;
    const presentationSize = Number(v.presentationSize);
    const stockPresentations = Number(v.stockPresentations);
    const minStockPresentations = Number(v.minStockPresentations);
    const costPerPresentation = Number(v.costPerPresentation);

    // Convertir de presentaciones (UI) a unidad base (DB) antes de enviar
    const payload: IngredientPayload = {
      name: v.name,
      unit: v.unit,
      presentationSize,
      stock: stockPresentations * presentationSize,
      minStock: minStockPresentations * presentationSize,
      unitCost: costPerPresentation / presentationSize,
    };
    this.dialogRef.close(payload);
  }

  currentUnitShort(): string {
    const u = this.form.value.unit as MeasureUnit | undefined;
    return BASE_UNIT_SHORT[u ?? 'UNIT'];
  }

  stockHint(): string {
    const v = this.form.value;
    const stockP = Number(v.stockPresentations) || 0;
    const size = Number(v.presentationSize) || 0;
    if (stockP <= 0 || size <= 0) return 'Ej: 10 (bolsas, kilos, cajas, etc.)';
    return `Equivale a ${this.round4(stockP * size)} ${this.currentUnitShort()} en total`;
  }

  private round4(n: number): number {
    return Math.round(n * 10000) / 10000;
  }
}
