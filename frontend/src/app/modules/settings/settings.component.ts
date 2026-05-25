import { Component, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule, FormsModule } from '@angular/forms';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { RouterLink } from '@angular/router';
import { SettingsService, BranchPayload, BusinessPayload } from '../../core/services/settings.service';
import { PlanService } from '../../core/services/plan.service';
import { ConfirmDialogComponent } from '../../shared/components/confirm-dialog/confirm-dialog.component';
import { BranchFormDialogComponent } from './branch-form-dialog.component';
import { UserInviteDialogComponent, UserFormResult } from './user-invite-dialog.component';
import { Branch, PlanCode, Role, User } from '../../core/models';
import { getErrorMessage } from '../../core/utils/error-message';

const ROLE_LABELS: Record<Role, string> = {
  OWNER: 'Propietario',
  MANAGER: 'Gerente',
  SELLER: 'Vendedor',
  INVENTORY: 'Inventario',
};

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, FormsModule, RouterLink,
    MatTabsModule, MatButtonModule, MatIconModule, MatFormFieldModule,
    MatInputModule, MatSlideToggleModule, MatTooltipModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <div class="page-header">
      <div>
        <h2>Configuración</h2>
        <p class="page-subtitle">Gestiona los ajustes generales de la plataforma y accesos.</p>
      </div>
    </div>

    <mat-tab-group animationDuration="200ms" class="settings-tabs">
      <!-- ─── Plan SaaS ─────────────────────────────────────────────────── -->
      <mat-tab label="Plan">
        <div class="tab-content">
          <div class="section-header">
            <div>
              <h3>Plan y uso de recursos</h3>
              <p class="muted">Mira cuánto estás usando vs el límite de tu plan actual.</p>
            </div>
            @if (plan.state(); as p) {
              @if (p.plan !== 'BUSINESS') {
                <a routerLink="/app/upgrade" mat-flat-button color="primary">
                  <mat-icon>upgrade</mat-icon> Mejorar plan
                </a>
              }
            }
          </div>

          @if (plan.loading() && !plan.state()) {
            <div class="loading"><mat-spinner diameter="32" /></div>
          }
          @if (plan.state(); as p) {
            <div class="card plan-card">
              <div class="plan-header">
                <div>
                  <span class="plan-current-label">PLAN ACTUAL</span>
                  <h4 class="plan-name">{{ p.label }}</h4>
                </div>
                <div class="plan-price">
                  @if (p.priceMonthlyPen === 0) {
                    <strong>S/ 0</strong><span>gratis</span>
                  } @else {
                    <strong>S/ {{ p.priceMonthlyPen }}</strong><span>/mes</span>
                  }
                </div>
              </div>

              <div class="usage-grid">
                <div class="usage-row" [class.danger]="usagePercent(p.usage.branches, p.limits.branches) >= 90">
                  <div class="usage-label">
                    <mat-icon>store</mat-icon>
                    <span>Sucursales</span>
                  </div>
                  <div class="usage-bar-wrapper">
                    <div class="usage-bar" [style.width.%]="usagePercent(p.usage.branches, p.limits.branches)"></div>
                  </div>
                  <span class="usage-text">{{ p.usage.branches }} / {{ formatLimit(p.limits.branches) }}</span>
                </div>

                <div class="usage-row" [class.danger]="usagePercent(p.usage.ingredients, p.limits.ingredients) >= 90">
                  <div class="usage-label">
                    <mat-icon>inventory_2</mat-icon>
                    <span>Insumos</span>
                  </div>
                  <div class="usage-bar-wrapper">
                    <div class="usage-bar" [style.width.%]="usagePercent(p.usage.ingredients, p.limits.ingredients)"></div>
                  </div>
                  <span class="usage-text">{{ p.usage.ingredients }} / {{ formatLimit(p.limits.ingredients) }}</span>
                </div>

                <div class="usage-row" [class.danger]="usagePercent(p.usage.recipes, p.limits.recipes) >= 90">
                  <div class="usage-label">
                    <mat-icon>menu_book</mat-icon>
                    <span>Productos</span>
                  </div>
                  <div class="usage-bar-wrapper">
                    <div class="usage-bar" [style.width.%]="usagePercent(p.usage.recipes, p.limits.recipes)"></div>
                  </div>
                  <span class="usage-text">{{ p.usage.recipes }} / {{ formatLimit(p.limits.recipes) }}</span>
                </div>

                <div class="usage-row" [class.danger]="usagePercent(p.usage.users, p.limits.users) >= 90">
                  <div class="usage-label">
                    <mat-icon>group</mat-icon>
                    <span>Usuarios</span>
                  </div>
                  <div class="usage-bar-wrapper">
                    <div class="usage-bar" [style.width.%]="usagePercent(p.usage.users, p.limits.users)"></div>
                  </div>
                  <span class="usage-text">{{ p.usage.users }} / {{ formatLimit(p.limits.users) }}</span>
                </div>
              </div>

              @if (p.plan !== 'BUSINESS') {
                <div class="plan-tip">
                  <mat-icon>info</mat-icon>
                  <span>Cuando te acerques al límite (90%), considera mejorar tu plan para no parar tu operación.</span>
                </div>
              }
            </div>
          }
        </div>
      </mat-tab>

      <!-- ─── Sucursales ────────────────────────────────────────────────── -->
      <mat-tab label="Sucursales">
        <div class="tab-content">
          <div class="section-header">
            <div>
              <h3>Sucursales</h3>
              <p class="muted">Gestiona las sucursales activas e inactivas de tu negocio.</p>
            </div>
            <button mat-flat-button color="primary" (click)="openBranchForm(null)">
              <mat-icon>add</mat-icon> Agregar Sucursal
            </button>
          </div>

          <div class="card table-card">
            @if (settings.branches().length === 0) {
              <div class="empty">
                <mat-icon>store</mat-icon>
                <p>Aún no tienes sucursales registradas.</p>
              </div>
            } @else {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Dirección</th>
                    <th>Teléfono</th>
                    <th>Estado</th>
                    <th class="actions-col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (b of settings.branches(); track b.id) {
                    <tr>
                      <td><strong>{{ b.name }}</strong></td>
                      <td>{{ b.address || '—' }}</td>
                      <td>{{ b.phone || '—' }}</td>
                      <td>
                        <span class="badge" [class.active]="b.isActive" [class.inactive]="!b.isActive">
                          {{ b.isActive ? 'Activa' : 'Inactiva' }}
                        </span>
                      </td>
                      <td class="actions-col">
                        <button mat-icon-button (click)="openBranchForm(b)" matTooltip="Editar">
                          <mat-icon>edit</mat-icon>
                        </button>
                        <button mat-icon-button (click)="confirmDeleteBranch(b)" matTooltip="Eliminar">
                          <mat-icon color="warn">delete</mat-icon>
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      </mat-tab>

      <!-- ─── Empresa ──────────────────────────────────────────────────── -->
      <mat-tab label="Empresa">
        <div class="tab-content">
          <div class="section-header">
            <div>
              <h3>Información de la Empresa</h3>
              <p class="muted">Nombre del negocio, RUC y tasa de impuesto aplicada en el POS.</p>
            </div>
          </div>

          <div class="card form-card">
            @if (!settings.business()) {
              <div class="loading"><mat-spinner diameter="32" /></div>
            } @else {
              <form [formGroup]="businessForm" (ngSubmit)="saveBusiness()" class="business-form">
                <!-- Preview del logo + URL -->
                <div class="logo-row">
                  <div class="logo-preview">
                    @if (logoUrlPreview()) {
                      <img [src]="logoUrlPreview()" alt="Logo" (error)="onLogoError()" />
                    } @else {
                      <mat-icon>cake</mat-icon>
                    }
                  </div>
                  <mat-form-field appearance="outline" class="logo-url-field">
                    <mat-label>URL del Logo (opcional)</mat-label>
                    <input matInput formControlName="logoUrl" placeholder="https://misitio.com/logo.png" />
                    <mat-hint>Aparece en la barra lateral y los tickets. Déjalo vacío para usar el ícono por defecto.</mat-hint>
                    @if (logoLoadError()) {
                      <mat-error>No se pudo cargar la imagen. Verifica que la URL sea pública y accesible.</mat-error>
                    }
                  </mat-form-field>
                </div>

                <mat-form-field appearance="outline">
                  <mat-label>Nombre del Sistema</mat-label>
                  <input matInput formControlName="name" />
                  <mat-hint>Aparece en la barra lateral y en los tickets.</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>RUC</mat-label>
                  <input matInput formControlName="ruc" placeholder="20123456789" />
                </mat-form-field>

                <mat-form-field appearance="outline">
                  <mat-label>Tasa de Impuesto / IGV (%)</mat-label>
                  <input matInput type="number" formControlName="taxRate" min="0" max="100" step="0.01" />
                  <mat-hint>Se aplica automáticamente en el POS.</mat-hint>
                </mat-form-field>

                <div class="actions">
                  <button mat-flat-button color="primary" type="submit" [disabled]="businessForm.invalid || savingBusiness()">
                    @if (savingBusiness()) {
                      <mat-spinner diameter="18" />
                    } @else {
                      Guardar cambios
                    }
                  </button>
                </div>
              </form>
            }
          </div>
        </div>
      </mat-tab>

      <!-- ─── Permisos ────────────────────────────────────────────────── -->
      <mat-tab label="Perfil de Permisos">
        <div class="tab-content">
          <div class="section-header">
            <div>
              <h3>Perfil de Permisos</h3>
              <p class="muted">Estas opciones cambian qué pueden ver y hacer los roles no-OWNER.</p>
            </div>
          </div>

          <div class="card">
            <div class="toggle-row">
              <div>
                <strong>Ocultar costos de insumos</strong>
                <p class="muted">Los roles Vendedor e Inventario no verán las columnas de costo en Inventario ni Productos.</p>
              </div>
              <mat-slide-toggle
                [ngModel]="hideIngredientCosts()"
                (ngModelChange)="onTogglePermissions('hideIngredientCosts', $event)"
                [ngModelOptions]="{ standalone: true }"
                [disabled]="savingPermissions()"
              />
            </div>
            <div class="toggle-row">
              <div>
                <strong>Edición masiva de inventario</strong>
                <p class="muted">Si está desactivado, solo Propietario y Gerente pueden hacer edición masiva.</p>
              </div>
              <mat-slide-toggle
                [ngModel]="allowBulkEdit()"
                (ngModelChange)="onTogglePermissions('allowBulkInventoryEdit', $event)"
                [ngModelOptions]="{ standalone: true }"
                [disabled]="savingPermissions()"
              />
            </div>
            @if (savingPermissions()) {
              <p class="muted small">Guardando...</p>
            }
          </div>
        </div>
      </mat-tab>

      <!-- ─── Usuarios ────────────────────────────────────────────────── -->
      <mat-tab label="Usuarios">
        <div class="tab-content">
          <div class="section-header">
            <div>
              <h3>Gestión de Usuarios</h3>
              <p class="muted">Crea, edita y desactiva usuarios del sistema.</p>
            </div>
            <button mat-flat-button color="primary" (click)="openInviteUser()">
              <mat-icon>person_add</mat-icon> Invitar Usuario
            </button>
          </div>

          <div class="card table-card">
            @if (settings.users().length === 0) {
              <div class="empty">
                <mat-icon>group</mat-icon>
                <p>Aún no hay usuarios registrados.</p>
              </div>
            } @else {
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Rol</th>
                    <th>Sucursal</th>
                    <th>Estado</th>
                    <th class="actions-col">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  @for (u of settings.users(); track u.id) {
                    <tr>
                      <td><strong>{{ u.fullName }}</strong></td>
                      <td>{{ u.email }}</td>
                      <td><span class="role-badge">{{ roleLabel(u.role) }}</span></td>
                      <td>{{ u.branch?.name ?? (u.role === 'OWNER' ? 'Global' : '—') }}</td>
                      <td>
                        <span class="badge" [class.active]="u.isActive !== false" [class.inactive]="u.isActive === false">
                          {{ u.isActive === false ? 'Inactivo' : 'Activo' }}
                        </span>
                      </td>
                      <td class="actions-col">
                        <button mat-icon-button (click)="openEditUser(u)" matTooltip="Editar">
                          <mat-icon>edit</mat-icon>
                        </button>
                        @if (u.isActive !== false) {
                          <button mat-icon-button (click)="confirmDeactivate(u)" matTooltip="Desactivar">
                            <mat-icon color="warn">person_off</mat-icon>
                          </button>
                        } @else {
                          <button mat-icon-button (click)="reactivate(u)" matTooltip="Reactivar">
                            <mat-icon style="color:#10B981">person</mat-icon>
                          </button>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>
      </mat-tab>
    </mat-tab-group>
  `,
  styles: [`
    .settings-tabs { background: transparent; }
    .tab-content { padding: 24px 0; }

    /* ─── Tab Plan ─── */
    .plan-card { padding: 28px; }
    .plan-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
      padding-bottom: 20px;
      border-bottom: 1px solid #f1f5f9;
    }
    .plan-current-label {
      font-size: 11px;
      font-weight: 700;
      letter-spacing: 0.1em;
      color: #94a3b8;
      text-transform: uppercase;
    }
    .plan-name {
      margin: 4px 0 0 0;
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      background: linear-gradient(135deg, #4648d4 0%, #645efb 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
    }
    .plan-price { text-align: right; }
    .plan-price strong { font-size: 24px; font-weight: 800; color: #1e293b; }
    .plan-price span { margin-left: 4px; color: #94a3b8; font-size: 13px; }

    .usage-grid { display: flex; flex-direction: column; gap: 14px; }
    .usage-row {
      display: grid;
      grid-template-columns: 180px 1fr 130px;
      gap: 16px;
      align-items: center;
    }
    @media (max-width: 600px) {
      .usage-row {
        grid-template-columns: 1fr;
        gap: 4px;
      }
    }
    .usage-label {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: #1e293b;
      font-size: 14px;
    }
    .usage-label mat-icon { color: #4648d4; font-size: 18px; width: 18px; height: 18px; }
    .usage-bar-wrapper {
      height: 8px;
      background: #f1f5f9;
      border-radius: 4px;
      overflow: hidden;
    }
    .usage-bar {
      height: 100%;
      background: linear-gradient(90deg, #4648d4, #645efb);
      border-radius: 4px;
      transition: width 0.3s ease;
    }
    .usage-row.danger .usage-bar { background: linear-gradient(90deg, #f59e0b, #dc2626); }
    .usage-row.danger .usage-text { color: #dc2626; font-weight: 700; }
    .usage-text {
      text-align: right;
      font-size: 13px;
      color: #64748b;
      font-weight: 500;
    }

    .plan-tip {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-top: 20px;
      padding: 12px 16px;
      background: #eef2ff;
      border: 1px solid #c7d2fe;
      border-radius: 10px;
      font-size: 13px;
      color: #3730a3;
      line-height: 1.4;
    }
    .plan-tip mat-icon { color: #4648d4; flex-shrink: 0; }

    .loading {
      display: flex; justify-content: center;
      padding: 48px 16px;
    }
    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 16px;
      gap: 16px;
    }
    .section-header h3 { margin: 0 0 4px 0; font-size: 18px; font-weight: 700; color: #1E293B; }
    .muted { color: #64748B; font-size: 13px; margin: 0; }
    .muted.small { margin-top: 12px; font-size: 12px; }

    .table-card { padding: 0; overflow: hidden; }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .data-table th {
      text-align: left;
      padding: 14px 20px;
      background: var(--color-surface-low);
      color: var(--color-text-secondary);
      font-weight: 700;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-bottom: 1px solid var(--color-border);
    }
    .data-table td {
      padding: 16px 20px;
      border-bottom: 1px solid var(--color-border);
      color: var(--color-text);
    }
    .data-table tr:hover td { background: var(--color-surface-low); }
    .actions-col { text-align: right; width: 100px; }

    .badge {
      display: inline-block;
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
    }
    .badge.active { background: #D1FAE5; color: #059669; }
    .badge.inactive { background: #FEE2E2; color: #DC2626; }

    .role-badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: var(--radius-full);
      font-size: 11px;
      font-weight: 700;
      background: var(--color-primary-soft);
      color: var(--color-primary);
      letter-spacing: 0.02em;
    }

    .form-card { padding: 24px; }
    .business-form { display: flex; flex-direction: column; gap: 8px; max-width: 480px; }
    mat-form-field { width: 100%; }
    .actions { display: flex; justify-content: flex-end; margin-top: 12px; }

    .toggle-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 0;
      border-bottom: 1px solid #F1F5F9;
      gap: 24px;
    }
    .toggle-row:last-of-type { border-bottom: none; }
    .toggle-row strong { display: block; color: #1E293B; font-size: 14px; }
    .toggle-row p { margin: 4px 0 0 0; font-size: 13px; }

    .empty, .loading {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 48px 16px;
      gap: 12px;
      color: #64748B;
    }
    .empty mat-icon { font-size: 48px; width: 48px; height: 48px; color: #CBD5E1; }
    .empty p { margin: 0; }

    .logo-row {
      display: flex;
      align-items: flex-start;
      gap: 16px;
      margin-bottom: 8px;
    }
    .logo-preview {
      flex-shrink: 0;
      width: 64px;
      height: 64px;
      border-radius: 12px;
      background: var(--color-primary-container, #6063ee);
      color: var(--color-on-primary-container, #fff);
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      border: 1px solid var(--color-outline-variant, #c7c4d7);
    }
    .logo-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .logo-preview mat-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }
    .logo-url-field { flex: 1; }
  `],
})
export class SettingsComponent implements OnInit {
  businessForm: FormGroup;
  savingBusiness = signal(false);
  savingPermissions = signal(false);
  /** URL del logo en vivo desde el form — para mostrar preview al escribir. */
  logoUrlSig = signal<string | null>(null);
  /** True si la imagen falló al cargar (URL inválida o no accesible). */
  logoLoadError = signal(false);

  hideIngredientCosts = computed(() => this.settings.business()?.hideIngredientCosts ?? false);
  allowBulkEdit = computed(() => this.settings.business()?.allowBulkInventoryEdit ?? true);

  /** URL a mostrar en el preview: si está cargando bien, la usa; si falló, null. */
  logoUrlPreview = computed(() => (this.logoLoadError() ? null : this.logoUrlSig()));

  constructor(
    public settings: SettingsService,
    public plan: PlanService,
    private fb: FormBuilder,
    private dialog: MatDialog,
    private snack: MatSnackBar
  ) {
    this.businessForm = this.fb.group({
      name: ['', [Validators.required, Validators.minLength(1)]],
      ruc: [''],
      taxRate: [18, [Validators.required, Validators.min(0), Validators.max(100)]],
      logoUrl: [''],
    });

    // Mantener el signal del preview sincronizado con el input
    this.businessForm.get('logoUrl')?.valueChanges.subscribe((v: string) => {
      const trimmed = (v ?? '').trim();
      this.logoLoadError.set(false);
      this.logoUrlSig.set(trimmed || null);
    });
  }

  async ngOnInit(): Promise<void> {
    // 1 sola request al backend → branches + business + users
    // + plan en paralelo (para la pestaña "Plan")
    await Promise.all([this.settings.loadBootstrap(), this.plan.load(true)]);
    const biz = this.settings.business();
    if (biz) {
      this.businessForm.patchValue({
        name: biz.name,
        ruc: biz.ruc ?? '',
        taxRate: biz.taxRate,
        logoUrl: biz.logoUrl ?? '',
      });
      this.logoUrlSig.set(biz.logoUrl ?? null);
    }
  }

  /** Disparado por <img (error)> cuando la URL no carga. */
  onLogoError(): void {
    this.logoLoadError.set(true);
  }

  async onTogglePermissions(
    field: 'hideIngredientCosts' | 'allowBulkInventoryEdit',
    value: boolean
  ): Promise<void> {
    const biz = this.settings.business();
    if (!biz) return;
    this.savingPermissions.set(true);
    try {
      await this.settings.updateBusiness({
        name: biz.name,
        ruc: biz.ruc,
        taxRate: biz.taxRate,
        logoUrl: biz.logoUrl,
        hideIngredientCosts: field === 'hideIngredientCosts' ? value : biz.hideIngredientCosts,
        allowBulkInventoryEdit: field === 'allowBulkInventoryEdit' ? value : biz.allowBulkInventoryEdit,
      });
      this.snack.open('Permisos actualizados', 'OK', { duration: 2000 });
    } catch (e: unknown) {
      this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
    } finally {
      this.savingPermissions.set(false);
    }
  }

  roleLabel(r: Role): string {
    return ROLE_LABELS[r];
  }

  // ─── Sucursales ──────────────────────────────────────────────────────
  openBranchForm(branch: Branch | null): void {
    const ref = this.dialog.open(BranchFormDialogComponent, {
      data: { branch },
      disableClose: true,
    });

    ref.afterClosed().subscribe(async (payload: BranchPayload | undefined) => {
      if (!payload) return;
      try {
        if (branch) {
          await this.settings.updateBranch(branch.id, payload);
          this.snack.open('Sucursal actualizada', 'OK', { duration: 2500 });
        } else {
          await this.settings.createBranch(payload);
          this.snack.open('Sucursal creada', 'OK', { duration: 2500 });
        }
      } catch (e: unknown) {
        this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
      }
    });
  }

  /** HARD delete de una sucursal — destructivo, borra todo de la DB. */
  confirmDeleteBranch(b: Branch): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: `Eliminar sucursal "${b.name}" permanentemente`,
        message:
          `Esta acción es IRREVERSIBLE. Se borrarán de la base de datos:\n\n` +
          `• Todas las ventas y tickets registrados en esta sucursal\n` +
          `• Todas las mermas y producciones\n` +
          `• Todos los productos (recetas) y sus insumos\n` +
          `• Todo el inventario, compras y conteos\n` +
          `• Todas las reservaciones pendientes y entregadas\n\n` +
          `Los usuarios asignados a esta sucursal NO se eliminarán — quedarán sin sucursal asignada y deberás reasignarlos.\n\n` +
          `¿Estás completamente seguro?`,
        confirmText: 'Sí, eliminar todo',
        danger: true,
      },
    });

    ref.afterClosed().subscribe(async (ok: boolean) => {
      if (!ok) return;
      try {
        await this.settings.removeBranch(b.id);
        this.snack.open(`Sucursal "${b.name}" eliminada permanentemente`, 'OK', { duration: 3000 });
      } catch (e: unknown) {
        this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
      }
    });
  }

  // ─── Empresa ────────────────────────────────────────────────────────
  async saveBusiness(): Promise<void> {
    if (this.businessForm.invalid) return;
    this.savingBusiness.set(true);
    try {
      const v = this.businessForm.value;
      const trimmedLogo = (v.logoUrl ?? '').trim();
      const payload: BusinessPayload = {
        name: v.name,
        ruc: v.ruc || null,
        taxRate: Number(v.taxRate),
        logoUrl: trimmedLogo || null,
      };
      await this.settings.updateBusiness(payload);
      this.snack.open('Configuración guardada', 'OK', { duration: 2500 });
    } catch (e: unknown) {
      this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
    } finally {
      this.savingBusiness.set(false);
    }
  }

  // ─── Usuarios ────────────────────────────────────────────────────────
  openInviteUser(): void {
    const ref = this.dialog.open(UserInviteDialogComponent, {
      data: { mode: 'invite', branches: this.settings.branches() },
      disableClose: true,
    });

    ref.afterClosed().subscribe(async (res: UserFormResult | undefined) => {
      if (!res || res.mode !== 'invite') return;
      try {
        await this.settings.inviteUser(res.payload);
        this.snack.open(`Usuario ${res.payload.fullName} creado`, 'OK', { duration: 3000 });
      } catch (e: unknown) {
        this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
      }
    });
  }

  openEditUser(user: User): void {
    const ref = this.dialog.open(UserInviteDialogComponent, {
      data: { mode: 'edit', branches: this.settings.branches(), user },
      disableClose: true,
    });

    ref.afterClosed().subscribe(async (res: UserFormResult | undefined) => {
      if (!res || res.mode !== 'edit') return;
      try {
        await this.settings.updateUser(user.id, res.payload);
        this.snack.open('Usuario actualizado', 'OK', { duration: 2500 });
      } catch (e: unknown) {
        this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
      }
    });
  }

  confirmDeactivate(u: User): void {
    const ref = this.dialog.open(ConfirmDialogComponent, {
      data: {
        title: 'Desactivar usuario',
        message: `¿Desactivar a "${u.fullName}"? No podrá iniciar sesión hasta que vuelvas a activarlo.`,
        confirmText: 'Desactivar',
        danger: true,
      },
    });

    ref.afterClosed().subscribe(async (ok: boolean) => {
      if (!ok) return;
      try {
        await this.settings.deactivateUser(u.id);
        this.snack.open('Usuario desactivado', 'OK', { duration: 2500 });
      } catch (e: unknown) {
        this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
      }
    });
  }

  async reactivate(u: User): Promise<void> {
    try {
      await this.settings.reactivateUser(u.id);
      this.snack.open('Usuario reactivado', 'OK', { duration: 2500 });
    } catch (e: unknown) {
      this.snack.open(getErrorMessage(e, 'Error'), 'OK', { duration: 4000 });
    }
  }

  // ── Helpers para la tab Plan ─────────────────────────────────────────────
  /** Porcentaje de uso (0-100). Si el límite es ilimitado (null), devuelve 0. */
  usagePercent(used: number, limit: number | null): number {
    if (limit === null || limit <= 0) return 0;
    return Math.min(100, Math.round((used / limit) * 100));
  }

  /** Label legible del límite: número o "∞" para ilimitado. */
  formatLimit(limit: number | null): string {
    return limit === null ? '∞' : String(limit);
  }
}
