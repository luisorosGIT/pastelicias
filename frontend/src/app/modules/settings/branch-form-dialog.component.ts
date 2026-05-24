import { Component, Inject } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Branch } from '../../core/models';
import { BranchPayload } from '../../core/services/settings.service';

@Component({
  selector: 'app-branch-form-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule,
    MatSlideToggleModule, MatButtonModule, MatIconModule,
  ],
  template: `
    <div class="dialog">
      <h2 class="title">
        <mat-icon>{{ data.branch ? 'edit' : 'add_business' }}</mat-icon>
        {{ data.branch ? 'Editar' : 'Nueva' }} Sucursal
      </h2>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form">
        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="name" placeholder="Sucursal Centro" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Dirección</mat-label>
          <input matInput formControlName="address" placeholder="Av. Principal 123" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Teléfono</mat-label>
          <input matInput formControlName="phone" placeholder="+51 999 999 999" />
        </mat-form-field>

        <mat-slide-toggle formControlName="isActive">Sucursal activa</mat-slide-toggle>

        <div class="actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close()">Cancelar</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid">
            {{ data.branch ? 'Actualizar' : 'Crear' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .dialog { padding: 24px; width: 480px; max-width: calc(100vw - 32px); box-sizing: border-box; }
    @media (max-width: 540px) { .dialog { padding: 16px; } }
    .title { display: flex; align-items: center; gap: 8px; margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: #1E293B; }
    .title mat-icon { color: #6366F1; }
    .form { display: flex; flex-direction: column; gap: 10px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    mat-form-field { width: 100%; }
  `],
})
export class BranchFormDialogComponent {
  form: FormGroup;

  constructor(
    public dialogRef: MatDialogRef<BranchFormDialogComponent, BranchPayload | null>,
    @Inject(MAT_DIALOG_DATA) public data: { branch: Branch | null },
    fb: FormBuilder
  ) {
    const b = data.branch;
    this.form = fb.group({
      name: [b?.name ?? '', [Validators.required, Validators.minLength(1)]],
      address: [b?.address ?? ''],
      phone: [b?.phone ?? ''],
      isActive: [b?.isActive ?? true],
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value as BranchPayload);
  }
}
