import { Component, Inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { Branch, Role, User } from '../../core/models';
import { InviteUserPayload, UpdateUserPayload } from '../../core/services/settings.service';

const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Propietario',
  MANAGER: 'Gerente',
  SELLER: 'Vendedor',
  INVENTORY: 'Inventario',
};

export type UserFormMode = 'invite' | 'edit';
export type UserFormResult =
  | { mode: 'invite'; payload: InviteUserPayload }
  | { mode: 'edit'; payload: UpdateUserPayload };

export interface UserFormDialogData {
  mode: UserFormMode;
  branches: Branch[];
  user?: User;
}

@Component({
  selector: 'app-user-invite-dialog',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatSlideToggleModule,
  ],
  template: `
    <div class="dialog">
      <h2 class="title">
        <mat-icon>{{ data.mode === 'edit' ? 'edit' : 'person_add' }}</mat-icon>
        {{ data.mode === 'edit' ? 'Editar Usuario' : 'Invitar Usuario' }}
      </h2>

      <form [formGroup]="form" (ngSubmit)="onSubmit()" class="form">
        <mat-form-field appearance="outline">
          <mat-label>Nombre Completo</mat-label>
          <input matInput formControlName="fullName" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Email</mat-label>
          <input matInput type="email" formControlName="email" [readonly]="data.mode === 'edit'" />
          @if (data.mode === 'edit') {
            <mat-hint>El email no se puede modificar.</mat-hint>
          }
        </mat-form-field>

        @if (data.mode === 'invite') {
          <mat-form-field appearance="outline">
            <mat-label>Contraseña temporal</mat-label>
            <input
              matInput
              [type]="showPassword() ? 'text' : 'password'"
              formControlName="password"
            />
            <button mat-icon-button matSuffix type="button" (click)="showPassword.set(!showPassword())">
              <mat-icon>{{ showPassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
            </button>
            <mat-hint>Mínimo 8 caracteres</mat-hint>
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>Rol</mat-label>
          <mat-select formControlName="role">
            @for (key of roleKeys; track key) {
              <mat-option [value]="key">{{ roleLabels[key] }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (form.value.role !== 'OWNER') {
          <mat-form-field appearance="outline">
            <mat-label>Sucursal</mat-label>
            <mat-select formControlName="branchId">
              @for (b of data.branches; track b.id) {
                <mat-option [value]="b.id">{{ b.name }}</mat-option>
              }
            </mat-select>
            <mat-hint>Obligatorio para Gerente / Vendedor / Inventario</mat-hint>
          </mat-form-field>
        }

        @if (data.mode === 'edit') {
          <div class="toggle-row">
            <div>
              <strong>Usuario activo</strong>
              <p class="muted">Si está apagado, no podrá iniciar sesión.</p>
            </div>
            <mat-slide-toggle formControlName="isActive" />
          </div>
        }

        <div class="actions">
          <button mat-stroked-button type="button" (click)="dialogRef.close()">Cancelar</button>
          <button mat-flat-button color="primary" type="submit" [disabled]="!isValid()">
            {{ data.mode === 'edit' ? 'Guardar cambios' : 'Crear Usuario' }}
          </button>
        </div>
      </form>
    </div>
  `,
  styles: [`
    .dialog { padding: 24px; width: 520px; max-width: calc(100vw - 32px); box-sizing: border-box; }
    @media (max-width: 540px) { .dialog { padding: 16px; } }
    .title { display: flex; align-items: center; gap: 8px; margin: 0 0 20px 0; font-size: 18px; font-weight: 700; color: #1E293B; }
    .title mat-icon { color: #6366F1; }
    .form { display: flex; flex-direction: column; gap: 6px; }
    .actions { display: flex; justify-content: flex-end; gap: 8px; margin-top: 12px; flex-wrap: wrap; }
    mat-form-field { width: 100%; }
    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      gap: 16px;
    }
    .toggle-row strong { color: #1E293B; font-size: 14px; }
    .muted { color: #64748B; font-size: 12px; margin: 2px 0 0 0; }
  `],
})
export class UserInviteDialogComponent {
  form: FormGroup;
  showPassword = signal(false);
  roleKeys: Role[] = ['OWNER', 'MANAGER', 'SELLER', 'INVENTORY'];
  roleLabels = ROLE_LABELS;

  /** Espejo de form.valid en un signal para que computed() reaccione. */
  private formValid = signal(false);
  /** Espejo de form.value para que computed() también vea los cambios de role/branchId. */
  private formValue = signal<{ role?: Role; branchId?: string | null }>({});

  isValid = computed(() => {
    if (!this.formValid()) return false;
    const v = this.formValue();
    if (v.role !== 'OWNER' && !v.branchId) return false;
    return true;
  });

  constructor(
    public dialogRef: MatDialogRef<UserInviteDialogComponent, UserFormResult | null>,
    @Inject(MAT_DIALOG_DATA) public data: UserFormDialogData,
    fb: FormBuilder
  ) {
    const u = data.user;
    this.form = fb.group({
      fullName: [u?.fullName ?? '', [Validators.required, Validators.minLength(2)]],
      email: [u?.email ?? '', [Validators.required, Validators.email]],
      password: ['', data.mode === 'invite' ? [Validators.required, Validators.minLength(8)] : []],
      role: [u?.role ?? 'SELLER' as Role, Validators.required],
      branchId: [u?.branchId ?? ''],
      isActive: [u?.isActive ?? true],
    });

    // Inicializar y mantener los signals sincronizados con el form.
    this.formValid.set(this.form.valid);
    this.formValue.set({ role: this.form.value.role, branchId: this.form.value.branchId });
    this.form.statusChanges.subscribe((status) => this.formValid.set(status === 'VALID'));
    this.form.valueChanges.subscribe((v) =>
      this.formValue.set({ role: v.role, branchId: v.branchId })
    );
  }

  onSubmit(): void {
    if (!this.isValid()) return;
    const v = this.form.value;

    if (this.data.mode === 'invite') {
      const payload: InviteUserPayload = {
        fullName: v.fullName,
        email: v.email,
        password: v.password,
        role: v.role,
        branchId: v.role === 'OWNER' ? null : v.branchId,
      };
      this.dialogRef.close({ mode: 'invite', payload });
      return;
    }

    const payload: UpdateUserPayload = {
      fullName: v.fullName,
      role: v.role,
      branchId: v.role === 'OWNER' ? null : v.branchId,
      isActive: v.isActive,
    };
    this.dialogRef.close({ mode: 'edit', payload });
  }
}
