import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar } from '@angular/material/snack-bar';
import { environment } from '@env/environment';
import { AuthService } from '../../core/services/auth.service';
import { SettingsService, BusinessPayload, BranchPayload } from '../../core/services/settings.service';
import { InventoryService, IngredientPayload } from '../../core/services/inventory.service';
import { BranchService } from '../../core/services/branch.service';
import { ApiResponse, MeasureUnit } from '../../core/models';
import { homePathForRole } from '../../core/utils/home-path';
import { getErrorMessage } from '../../core/utils/error-message';

/**
 * Wizard de onboarding en 3 pasos. Se muestra al OWNER después del signup hasta
 * que termine. Marca onboardingCompleted=true al finalizar.
 */
@Component({
  selector: 'app-onboarding',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule,
    MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="onboarding-page">
      <div class="onboarding-card">
        <!-- Header con progreso -->
        <div class="header">
          <div class="brand">
            <img src="assets/branding/logo.png" alt="Genimatech" class="brand-logo-img" />
            <span>Genimatech</span>
          </div>
          <div class="progress">
            <div class="step-dot" [class.active]="step() >= 1" [class.completed]="step() > 1">1</div>
            <div class="step-line" [class.active]="step() > 1"></div>
            <div class="step-dot" [class.active]="step() >= 2" [class.completed]="step() > 2">2</div>
            <div class="step-line" [class.active]="step() > 2"></div>
            <div class="step-dot" [class.active]="step() >= 3" [class.completed]="step() > 3">3</div>
          </div>
        </div>

        <!-- Paso 1: Información del negocio -->
        @if (step() === 1) {
          <div class="step-content">
            <h2>👋 Bienvenido a Genimatech</h2>
            <p class="step-sub">Empecemos configurando los datos básicos de tu negocio.</p>

            <form [formGroup]="businessForm" class="form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Nombre del negocio</mat-label>
                <input matInput formControlName="name" />
                <mat-icon matPrefix>storefront</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>RUC (opcional)</mat-label>
                <input matInput formControlName="ruc" placeholder="20123456789" />
                <mat-icon matPrefix>badge</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Tasa de impuesto (IGV) %</mat-label>
                <input matInput type="number" formControlName="taxRate" min="0" max="100" step="0.01" />
                <mat-icon matPrefix>percent</mat-icon>
                <mat-hint>Por defecto 18% (Perú)</mat-hint>
              </mat-form-field>
            </form>

            <div class="actions">
              <button mat-stroked-button type="button" (click)="skipAll()">Saltar todo</button>
              <button mat-flat-button color="primary" type="button"
                      [disabled]="businessForm.invalid || saving()"
                      (click)="goToStep2()">
                Siguiente <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </div>
        }

        <!-- Paso 2: Primera sucursal -->
        @if (step() === 2) {
          <div class="step-content">
            <h2>🏪 Tu primera sucursal</h2>
            <p class="step-sub">Ya creamos "Sucursal Principal" para ti. Completa sus datos.</p>

            <form [formGroup]="branchForm" class="form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Nombre de la sucursal</mat-label>
                <input matInput formControlName="name" />
                <mat-icon matPrefix>store</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Dirección (opcional)</mat-label>
                <input matInput formControlName="address" placeholder="Av. Principal 123, Lima" />
                <mat-icon matPrefix>place</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Teléfono (opcional)</mat-label>
                <input matInput formControlName="phone" placeholder="+51 999 999 999" />
                <mat-icon matPrefix>phone</mat-icon>
              </mat-form-field>
            </form>

            <div class="actions">
              <button mat-stroked-button type="button" (click)="step.set(1)">
                <mat-icon>arrow_back</mat-icon> Atrás
              </button>
              <button mat-flat-button color="primary" type="button"
                      [disabled]="branchForm.invalid || saving()"
                      (click)="goToStep3()">
                Siguiente <mat-icon>arrow_forward</mat-icon>
              </button>
            </div>
          </div>
        }

        <!-- Paso 3: Primer insumo -->
        @if (step() === 3) {
          <div class="step-content">
            <h2>📦 Tu primer insumo</h2>
            <p class="step-sub">
              Los <strong>insumos</strong> son la materia prima de tus recetas
              (harina, azúcar, leche, etc.). Crea uno como ejemplo.
            </p>

            <form [formGroup]="ingredientForm" class="form">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Nombre del insumo</mat-label>
                <input matInput formControlName="name" placeholder="Harina de trigo" />
              </mat-form-field>

              <div class="two-col">
                <mat-form-field appearance="outline">
                  <mat-label>Unidad</mat-label>
                  <mat-select formControlName="unit">
                    <mat-option value="KG">Kilogramos (kg)</mat-option>
                    <mat-option value="G">Gramos (g)</mat-option>
                    <mat-option value="L">Litros (l)</mat-option>
                    <mat-option value="ML">Mililitros (ml)</mat-option>
                    <mat-option value="UNIT">Unidades</mat-option>
                  </mat-select>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Tamaño de presentación</mat-label>
                  <input matInput type="number" formControlName="presentationSize" min="0" step="any" />
                  <mat-hint>Ej: 1 (1 kg por bolsa)</mat-hint>
                </mat-form-field>
              </div>

              <div class="two-col">
                <mat-form-field appearance="outline">
                  <mat-label>Stock inicial</mat-label>
                  <input matInput type="number" formControlName="stockPresentations" min="0" step="any" />
                  <mat-hint>presentaciones</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Costo por presentación</mat-label>
                  <span matTextPrefix>S/&nbsp;</span>
                  <input matInput type="number" formControlName="costPerPresentation" min="0" step="0.01" />
                </mat-form-field>
              </div>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Stock mínimo (alerta)</mat-label>
                <input matInput type="number" formControlName="minStockPresentations" min="0" step="any" />
                <mat-hint>Cuando bajes de aquí te avisamos</mat-hint>
              </mat-form-field>
            </form>

            <div class="actions">
              <button mat-stroked-button type="button" (click)="step.set(2)">
                <mat-icon>arrow_back</mat-icon> Atrás
              </button>
              <button mat-stroked-button type="button" (click)="skipIngredient()" [disabled]="saving()">
                Saltar este paso
              </button>
              <button mat-flat-button color="primary" type="button"
                      [disabled]="ingredientForm.invalid || saving()"
                      (click)="finish()">
                @if (saving()) {
                  <mat-spinner diameter="18" />
                } @else {
                  Finalizar <mat-icon>check</mat-icon>
                }
              </button>
            </div>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .onboarding-page {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background:
        radial-gradient(at 20% 30%, rgba(70, 72, 212, 0.10) 0px, transparent 50%),
        radial-gradient(at 80% 70%, rgba(100, 94, 251, 0.08) 0px, transparent 50%),
        #f8f9ff;
    }
    .onboarding-card {
      width: 100%;
      max-width: 580px;
      padding: 40px;
      background: #fff;
      border-radius: 20px;
      box-shadow: 0 24px 60px -16px rgba(70, 72, 212, 0.15);
    }
    @media (max-width: 600px) {
      .onboarding-card { padding: 24px; }
    }

    .header { display: flex; flex-direction: column; align-items: center; gap: 20px; margin-bottom: 32px; }
    .brand { display: flex; align-items: center; gap: 10px; font-weight: 800; color: #4648d4; }
    .brand-logo-img {
      width: 36px; height: 36px; border-radius: 10px;
      display: block; object-fit: cover;
    }
    .progress { display: flex; align-items: center; gap: 8px; }
    .step-dot {
      width: 32px; height: 32px; border-radius: 50%;
      background: #f1f5f9; color: #94a3b8;
      display: flex; align-items: center; justify-content: center;
      font-size: 13px; font-weight: 700;
      transition: all 0.2s;
    }
    .step-dot.active { background: #4648d4; color: #fff; }
    .step-dot.completed { background: #10b981; color: #fff; }
    .step-line {
      width: 40px; height: 2px;
      background: #f1f5f9; border-radius: 1px;
      transition: background 0.2s;
    }
    .step-line.active { background: #10b981; }

    .step-content h2 {
      font-size: 22px; font-weight: 800;
      letter-spacing: -0.01em; color: #0b1c30;
      margin: 0 0 6px 0; text-align: center;
    }
    .step-sub {
      text-align: center; color: #64748b;
      font-size: 14px; line-height: 1.5;
      margin: 0 0 24px 0;
    }
    .step-sub strong { color: #0b1c30; }

    .form { display: flex; flex-direction: column; gap: 8px; }
    .full-width { width: 100%; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
    @media (max-width: 500px) { .two-col { grid-template-columns: 1fr; } }
    mat-form-field { width: 100%; }

    .actions {
      display: flex; gap: 8px; justify-content: flex-end;
      margin-top: 20px; padding-top: 16px;
      border-top: 1px solid #f1f5f9;
      flex-wrap: wrap;
    }
    .actions button { height: 42px; }
    /* Alineación icono+texto dentro de los botones del wizard.
       Material envuelve el contenido en .mdc-button__label; ahí hacemos flex. */
    .actions button ::ng-deep .mdc-button__label {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      line-height: 1;
    }
    .actions button mat-icon {
      margin: 0 !important;
      font-size: 18px;
      width: 18px;
      height: 18px;
      line-height: 18px;
    }
    .actions button mat-spinner {
      display: inline-block;
    }
  `],
})
export class OnboardingComponent implements OnInit {
  step = signal<1 | 2 | 3>(1);
  saving = signal(false);

  businessForm: FormGroup;
  branchForm: FormGroup;
  ingredientForm: FormGroup;

  constructor(
    private fb: FormBuilder,
    private http: HttpClient,
    private settings: SettingsService,
    private inventory: InventoryService,
    private branchService: BranchService,
    private authService: AuthService,
    private snack: MatSnackBar,
    private router: Router
  ) {
    this.businessForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(2)]],
      ruc: [''],
      taxRate: [18, [Validators.required, Validators.min(0), Validators.max(100)]],
    });

    this.branchForm = this.fb.group({
      name: ['Sucursal Principal', [Validators.required, Validators.minLength(2)]],
      address: [''],
      phone: [''],
    });

    this.ingredientForm = this.fb.group({
      name: ['Harina de trigo', [Validators.required]],
      unit: ['KG' as MeasureUnit, Validators.required],
      presentationSize: [1, [Validators.required, Validators.min(0.0001)]],
      stockPresentations: [10, [Validators.required, Validators.min(0)]],
      minStockPresentations: [2, [Validators.required, Validators.min(0)]],
      costPerPresentation: [4.5, [Validators.required, Validators.min(0.0001)]],
    });
  }

  async ngOnInit(): Promise<void> {
    // Pre-cargar datos del business y la primera branch si ya existen
    await Promise.all([this.settings.loadBusiness(), this.branchService.loadBranches(true)]);
    const biz = this.settings.business();
    if (biz) {
      this.businessForm.patchValue({
        name: biz.name,
        ruc: biz.ruc ?? '',
        taxRate: biz.taxRate,
      });
    }
    const firstBranch = this.branchService.branches()[0];
    if (firstBranch) {
      this.branchForm.patchValue({
        name: firstBranch.name,
        address: firstBranch.address ?? '',
        phone: firstBranch.phone ?? '',
      });
      this.branchService.selectBranch(firstBranch.id);
    }
  }

  async goToStep2(): Promise<void> {
    this.saving.set(true);
    try {
      const v = this.businessForm.value;
      const payload: BusinessPayload = {
        name: v.name,
        ruc: v.ruc?.trim() || null,
        taxRate: Number(v.taxRate),
      };
      await this.settings.updateBusiness(payload);
      this.step.set(2);
    } catch (e: unknown) {
      this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  async goToStep3(): Promise<void> {
    this.saving.set(true);
    try {
      const v = this.branchForm.value;
      const branchId = this.branchService.branches()[0]?.id;
      if (!branchId) throw new Error('No se encontró la sucursal');
      const payload: BranchPayload = {
        name: v.name,
        address: v.address?.trim() || null,
        phone: v.phone?.trim() || null,
      };
      await this.settings.updateBranch(branchId, payload);
      this.step.set(3);
    } catch (e: unknown) {
      this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  async finish(): Promise<void> {
    this.saving.set(true);
    try {
      const v = this.ingredientForm.value;
      const size = Number(v.presentationSize);
      const stockP = Number(v.stockPresentations);
      const minP = Number(v.minStockPresentations);
      const costP = Number(v.costPerPresentation);
      const payload: IngredientPayload = {
        name: v.name,
        unit: v.unit,
        presentationSize: size,
        stock: stockP * size,
        minStock: minP * size,
        unitCost: costP / size,
      };
      await this.inventory.create(payload);
      await this.completeAndRedirect();
    } catch (e: unknown) {
      this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  /** Saltar el paso del insumo y terminar el wizard. */
  async skipIngredient(): Promise<void> {
    this.saving.set(true);
    try {
      await this.completeAndRedirect();
    } catch (e: unknown) {
      this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  /** Saltar TODO el wizard. Solo marca completado y sale. */
  async skipAll(): Promise<void> {
    this.saving.set(true);
    try {
      await this.completeAndRedirect();
    } catch (e: unknown) {
      this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
    } finally {
      this.saving.set(false);
    }
  }

  private async completeAndRedirect(): Promise<void> {
    await firstValueFrom(
      this.http.post<ApiResponse>(`${environment.apiUrl}/settings/complete-onboarding`, {})
    );
    this.authService.markOnboardingCompleted();
    this.snack.open('🎉 ¡Listo! Bienvenido a Genimatech', 'OK', { duration: 3000 });
    const role = this.authService.role();
    this.router.navigate([homePathForRole(role ?? 'OWNER')]);
  }
}
