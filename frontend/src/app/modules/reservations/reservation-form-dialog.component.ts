import { Component, Inject, OnInit, computed, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { provideNativeDateAdapter, MAT_DATE_LOCALE, MAT_DATE_FORMATS } from '@angular/material/core';

// Formato de fecha dd/MM/yyyy para Perú (es-PE).
const ES_PE_DATE_FORMATS = {
  parse: { dateInput: 'DD/MM/YYYY' },
  display: {
    dateInput: 'DD/MM/YYYY',
    monthYearLabel: 'MMM YYYY',
    dateA11yLabel: 'LL',
    monthYearA11yLabel: 'MMMM YYYY',
  },
};
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Recipe } from '../../core/models';
import { RecipesService } from '../../core/services/recipes.service';
import { ReservationPayload } from '../../core/services/reservations.service';

@Component({
  selector: 'app-reservation-form-dialog',
  standalone: true,
  providers: [
    provideNativeDateAdapter(),
    { provide: MAT_DATE_LOCALE, useValue: 'es-PE' },
    { provide: MAT_DATE_FORMATS, useValue: ES_PE_DATE_FORMATS },
  ],
  imports: [
    CommonModule, CurrencyPipe, ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatDatepickerModule, MatButtonModule, MatIconModule,
  ],
  template: `
    <div class="dialog">
      <h2 class="title">
        <mat-icon>event_note</mat-icon> Nueva Reservación
      </h2>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form-grid">
        <h3 class="section-title span-2"><mat-icon>person</mat-icon> Datos del Cliente</h3>

        <mat-form-field appearance="outline">
          <mat-label>Nombre Completo</mat-label>
          <input matInput formControlName="clientName" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Teléfono</mat-label>
          <input matInput formControlName="phone" placeholder="+51 999 999 999" />
        </mat-form-field>

        <h3 class="section-title span-2"><mat-icon>cake</mat-icon> Detalles del Pedido</h3>

        <mat-form-field appearance="outline">
          <mat-label>Fecha de Entrega</mat-label>
          <input matInput [matDatepicker]="picker" formControlName="deliveryDateOnly" />
          <mat-datepicker-toggle matIconSuffix [for]="picker" />
          <mat-datepicker #picker />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Hora de Entrega</mat-label>
          <input matInput type="time" formControlName="deliveryTime" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="span-2">
          <mat-label>Producto del catálogo</mat-label>
          <mat-select formControlName="recipeId">
            <mat-option [value]="null">— Producto personalizado —</mat-option>
            @for (r of recipes.recipes(); track r.id) {
              <mat-option [value]="r.id">{{ r.name }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (!form.value.recipeId) {
          <mat-form-field appearance="outline" class="span-2">
            <mat-label>Producto personalizado</mat-label>
            <input matInput formControlName="customProduct" placeholder="Torta personalizada 3 pisos" />
          </mat-form-field>
        }

        <mat-form-field appearance="outline" class="span-2">
          <mat-label>Especificaciones / Personalización</mat-label>
          <textarea matInput formControlName="details" rows="3" placeholder="Sabor, decoración, mensaje..."></textarea>
        </mat-form-field>

        <h3 class="section-title span-2"><mat-icon>payments</mat-icon> Finanzas</h3>

        <mat-form-field appearance="outline">
          <mat-label>Precio Total</mat-label>
          <span matTextPrefix>S/&nbsp;</span>
          <input matInput type="number" formControlName="totalPrice" min="0" step="0.01" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Anticipo Recibido</mat-label>
          <span matTextPrefix>S/&nbsp;</span>
          <input matInput type="number" formControlName="advance" min="0" step="0.01" />
        </mat-form-field>

        <div class="balance span-2">
          <span>Monto final a cobrar</span>
          <strong [class.positive]="balance() === 0" [class.negative]="balance() < 0">
            {{ balance() | currency:'S/ ':'symbol':'1.2-2' }}
          </strong>
        </div>

        <div class="actions span-2">
          <button mat-stroked-button type="button" (click)="dialogRef.close()">Cancelar</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="!isValid()">Crear Reservación</button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .dialog { padding: 24px; width: 600px; max-width: calc(100vw - 32px); max-height: 90vh; overflow-y: auto; box-sizing: border-box; }
    @media (max-width: 540px) { .dialog { padding: 16px; } }
    .title { display: flex; align-items: center; gap: 8px; margin: 0 0 16px 0; font-size: 18px; font-weight: 700; color: #1E293B; }
    .title mat-icon { color: #6366F1; }
    .section-title {
      display: flex; align-items: center; gap: 6px;
      margin: 8px 0 4px 0; font-size: 13px; font-weight: 700;
      color: #64748B; text-transform: uppercase; letter-spacing: 0.5px;
    }
    .section-title mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .form-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
    .span-2 { grid-column: 1 / -1; }
    @media (max-width: 540px) {
      .form-grid { grid-template-columns: 1fr; }
      .span-2 { grid-column: 1; }
    }
    mat-form-field { width: 100%; }
    .balance {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; background: #F8FAFC; border-radius: 8px;
      font-size: 14px; color: #64748B;
    }
    .balance strong { font-size: 18px; color: #4F46E5; }
    .balance strong.positive { color: #059669; }
    .balance strong.negative { color: #DC2626; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 8px; }
  `],
})
export class ReservationFormDialogComponent implements OnInit {
  form: FormGroup;
  /** Espejo del form en un signal para que `balance` reaccione. */
  private formValue = signal<{ totalPrice?: number; advance?: number }>({});

  balance = computed(() => {
    const v = this.formValue();
    const total = Number(v.totalPrice ?? 0);
    const adv = Number(v.advance ?? 0);
    return total - adv;
  });

  constructor(
    public dialogRef: MatDialogRef<ReservationFormDialogComponent, ReservationPayload | null>,
    @Inject(MAT_DIALOG_DATA) public data: { recipes?: Recipe[] },
    public recipes: RecipesService,
    fb: FormBuilder
  ) {
    const now = new Date();
    const inOneDay = new Date(now.getTime() + 24 * 3600 * 1000);
    this.form = fb.group({
      clientName: ['', [Validators.required, Validators.minLength(1)]],
      phone: ['', [Validators.required, Validators.minLength(6)]],
      deliveryDateOnly: [inOneDay, Validators.required],
      deliveryTime: ['12:00', Validators.required],
      recipeId: [null],
      customProduct: [''],
      details: [''],
      totalPrice: [0, [Validators.required, Validators.min(0.01)]],
      advance: [0, [Validators.min(0)]],
    });
    // Mantener formValue sincronizado para que `balance` reaccione a cambios.
    this.formValue.set(this.form.value);
    this.form.valueChanges.subscribe((v) => this.formValue.set(v));
  }

  async ngOnInit(): Promise<void> {
    if (this.recipes.recipes().length === 0) {
      await this.recipes.load();
    }
  }

  isValid(): boolean {
    if (this.form.invalid) return false;
    const v = this.form.value;
    if (!v.recipeId && !v.customProduct?.trim()) return false;
    return true;
  }

  onSubmit(): void {
    if (!this.isValid()) {
      // Marca todos los campos como touched para que mat-error muestre los errores.
      this.form.markAllAsTouched();
      console.warn('[Reservation form] inválido — campos faltantes o inválidos:', {
        formErrors: this.form.errors,
        controlErrors: Object.fromEntries(
          Object.entries(this.form.controls).map(([k, c]) => [k, c.errors])
        ),
        value: this.form.value,
      });
      return;
    }
    const v = this.form.value;
    const date: Date | null = v.deliveryDateOnly instanceof Date ? v.deliveryDateOnly : new Date(v.deliveryDateOnly);
    if (!date || isNaN(date.getTime())) {
      console.error('[Reservation form] fecha de entrega inválida', v.deliveryDateOnly);
      return;
    }
    const [hh, mm] = String(v.deliveryTime).split(':').map(Number);
    const delivery = new Date(date);
    delivery.setHours(hh || 0, mm || 0, 0, 0);

    const payload: ReservationPayload = {
      clientName: v.clientName,
      phone: v.phone,
      deliveryDate: delivery.toISOString(),
      details: v.details || null,
      recipeId: v.recipeId || null,
      customProduct: v.recipeId ? null : (v.customProduct?.trim() || null),
      totalPrice: Number(v.totalPrice),
      advance: Number(v.advance ?? 0),
    };
    this.dialogRef.close(payload);
  }
}
