import { Component, OnInit, computed, effect, signal } from '@angular/core';
import { CommonModule, CurrencyPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatTabsModule } from '@angular/material/tabs';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatDialog } from '@angular/material/dialog';
import { MatSnackBar } from '@angular/material/snack-bar';
import { RecipesService } from '../../core/services/recipes.service';
import { SettingsService } from '../../core/services/settings.service';
import { SalesService, SalePayload } from '../../core/services/sales.service';
import { BranchService } from '../../core/services/branch.service';
import { AuthService } from '../../core/services/auth.service';
import { TicketDialogComponent } from './ticket-dialog.component';
import { Recipe, RecipeCategory, PaymentMethod, SaleType } from '../../core/models';
import { getErrorMessage } from '../../core/utils/error-message';

interface CartLine {
  recipe: Recipe;
  quantity: number;
}

const CATEGORY_LABELS: Record<RecipeCategory | 'ALL', string> = {
  ALL: 'Todas',
  PANADERIA: 'Panadería',
  PASTELERIA: 'Pastelería',
  BEBIDAS: 'Bebidas',
  OTROS: 'Otros',
};

const CATEGORY_COLORS: Record<RecipeCategory, string> = {
  PANADERIA: '#F59E0B',
  PASTELERIA: '#EC4899',
  BEBIDAS: '#06B6D4',
  OTROS: '#6366F1',
};

@Component({
  selector: 'app-pos',
  standalone: true,
  imports: [
    CommonModule, FormsModule, CurrencyPipe,
    MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule,
    MatTooltipModule, MatTabsModule, MatButtonToggleModule, MatProgressSpinnerModule,
  ],
  template: `
    <div class="pos-layout">
      <!-- ═══════ Catálogo (izquierda) ═══════ -->
      <section class="catalog">
        <div class="catalog-header">
          <h2>Punto de Venta</h2>
          <p class="page-subtitle">Selecciona productos para registrar una venta rápida.</p>
        </div>

        <div class="catalog-toolbar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-icon matPrefix>search</mat-icon>
            <mat-label>Buscar producto</mat-label>
            <input matInput [ngModel]="search()" (ngModelChange)="search.set($event)" />
          </mat-form-field>

          <div class="chip-row">
            @for (key of categoryKeys; track key) {
              <button
                mat-stroked-button
                class="chip"
                [class.active]="selectedCategory() === key"
                (click)="selectedCategory.set(key)"
              >
                {{ categoryLabels[key] }}
              </button>
            }
          </div>
        </div>

        @if (recipes.loading()) {
          <div class="loading"><mat-spinner diameter="40" /></div>
        } @else if (filteredRecipes().length === 0) {
          <div class="empty">
            <mat-icon>menu_book</mat-icon>
            <p>No hay productos disponibles con esos filtros.</p>
          </div>
        } @else {
          <div class="product-grid">
            @for (r of filteredRecipes(); track r.id) {
              <button
                class="product-card"
                [class.disabled]="remainingStock(r) <= 0"
                [disabled]="remainingStock(r) <= 0"
                (click)="addToCart(r)"
                [matTooltip]="outOfStockTooltip(r)"
              >
                <div class="product-image" [style.background]="r.imageUrl ? 'transparent' : categoryColor(r.category) + '20'">
                  @if (r.imageUrl) {
                    <img [src]="r.imageUrl" [alt]="r.name" (error)="onImgError($event)" />
                  } @else {
                    <mat-icon [style.color]="categoryColor(r.category)">restaurant</mat-icon>
                  }
                  @if (r.stock <= 0) {
                    <span class="oos-tag">Sin stock</span>
                  } @else {
                    <span class="stock-tag">{{ r.stock }} disp.</span>
                  }
                </div>
                <div class="product-info">
                  <span class="product-name">{{ r.name }}</span>
                  <div class="product-info-bottom">
                    <span class="product-price">{{ r.salePrice | currency:'S/ ':'symbol':'1.2-2' }}</span>
                    @if (r.stock > 0) {
                      <span class="stock-pill">{{ remainingStock(r) }}</span>
                    }
                  </div>
                </div>
              </button>
            }
          </div>
        }
      </section>

      <!-- ═══════ Orden (derecha) ═══════ -->
      <aside class="order-panel">
        <div class="order-header">
          <h3><mat-icon>shopping_cart</mat-icon> Orden Actual</h3>
          @if (cart().length > 0) {
            <button mat-icon-button (click)="clearCart()" matTooltip="Vaciar carrito">
              <mat-icon>delete_sweep</mat-icon>
            </button>
          }
        </div>

        <div class="order-items">
          @if (cart().length === 0) {
            <div class="empty-cart">
              <mat-icon>shopping_basket</mat-icon>
              <p>Aún no hay productos en la orden</p>
              <span class="muted">Haz clic en un producto del catálogo para agregarlo.</span>
            </div>
          } @else {
            @for (line of cart(); track line.recipe.id) {
              <div class="cart-line">
                <div class="cart-line-info">
                  <strong>{{ line.recipe.name }}</strong>
                  <span class="muted">{{ line.recipe.salePrice | currency:'S/ ':'symbol':'1.2-2' }} c/u</span>
                </div>
                <div class="qty-control">
                  <button mat-icon-button (click)="decrement(line.recipe.id)">
                    <mat-icon>remove</mat-icon>
                  </button>
                  <span class="qty">{{ line.quantity }}</span>
                  <button mat-icon-button (click)="increment(line.recipe.id)">
                    <mat-icon>add</mat-icon>
                  </button>
                </div>
                <div class="line-total">
                  {{ line.recipe.salePrice * line.quantity | currency:'S/ ':'symbol':'1.2-2' }}
                </div>
                <button mat-icon-button (click)="removeLine(line.recipe.id)" matTooltip="Quitar">
                  <mat-icon color="warn">close</mat-icon>
                </button>
              </div>
            }
          }
        </div>

        @if (cart().length > 0) {
          <div class="order-summary">
            <div class="row"><span>Subtotal</span><strong>{{ subtotal() | currency:'S/ ':'symbol':'1.2-2' }}</strong></div>
            <div class="row"><span>IGV ({{ taxRate() }}%)</span><strong>{{ taxAmount() | currency:'S/ ':'symbol':'1.2-2' }}</strong></div>
            @if (showInternalCosts()) {
              <div class="row"><span>Costo de Producción</span><strong class="muted">{{ productionCost() | currency:'S/ ':'symbol':'1.2-2' }}</strong></div>
              <div class="row"><span>Margen Bruto</span><strong class="positive">{{ grossMargin() | currency:'S/ ':'symbol':'1.2-2' }}</strong></div>
            }
            <div class="row total"><span>TOTAL</span><strong>{{ total() | currency:'S/ ':'symbol':'1.2-2' }}</strong></div>

            <div class="pay-method">
              <span class="label">Método de pago</span>
              <mat-button-toggle-group [value]="paymentMethod()" (change)="paymentMethod.set($event.value)">
                <mat-button-toggle value="CASH"><mat-icon>payments</mat-icon> Efectivo</mat-button-toggle>
                <!-- Tarjeta y Yape solo se ocultan si está activo "Con vuelto"
                     (sale type ADVANCED), ya que esos métodos no permiten vuelto. -->
                @if (saleType() !== 'ADVANCED') {
                  <mat-button-toggle value="CARD"><mat-icon>credit_card</mat-icon> Tarjeta</mat-button-toggle>
                  <mat-button-toggle value="YAPE_PLIN"><mat-icon>qr_code_2</mat-icon> Yape/Plin</mat-button-toggle>
                }
              </mat-button-toggle-group>
            </div>

            <!-- "Con vuelto" solo aplica a pagos en EFECTIVO. En tarjeta/Yape
                 el cliente paga el monto exacto, no hay vuelto que dar. -->
            @if (paymentMethod() === 'CASH') {
              <div class="pay-method">
                <span class="label">Tipo de venta</span>
                <mat-button-toggle-group [value]="saleType()" (change)="saleType.set($event.value)">
                  <mat-button-toggle value="SIMPLE">Simple</mat-button-toggle>
                  <mat-button-toggle value="ADVANCED">Con vuelto</mat-button-toggle>
                </mat-button-toggle-group>
              </div>
            }

            @if (paymentMethod() === 'CASH' && saleType() === 'ADVANCED') {
              <mat-form-field appearance="outline" class="received-field">
                <mat-label>Monto Recibido</mat-label>
                <span matTextPrefix>S/&nbsp;</span>
                <input
                  matInput
                  type="number"
                  [ngModel]="amountReceived()"
                  (ngModelChange)="amountReceived.set(+$event || 0)"
                  min="0"
                  step="0.01"
                />
                <mat-hint>Vuelto: {{ change() | currency:'S/ ':'symbol':'1.2-2' }}</mat-hint>
              </mat-form-field>
            }

            <button
              mat-flat-button
              color="primary"
              class="checkout-btn"
              [disabled]="!canCheckout() || processing()"
              (click)="checkout()"
            >
              @if (processing()) {
                <mat-spinner diameter="20" />
              } @else {
                <mat-icon>point_of_sale</mat-icon>
                Cobrar {{ total() | currency:'S/ ':'symbol':'1.2-2' }}
              }
            </button>
          </div>
        }
      </aside>
    </div>
  `,
  styles: [`
    .pos-layout {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 16px;
      height: calc(100vh - 64px - 48px);
    }

    /* ── Catálogo ── */
    .catalog {
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .catalog-header {
      margin-bottom: 16px;
    }
    .catalog-header h2 {
      margin: 0;
      font-size: 28px;
      line-height: 36px;
      font-weight: 700;
      color: var(--color-text);
      letter-spacing: -0.02em;
    }
    .catalog-toolbar {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .search-field { flex: 1; max-width: 320px; }
    ::ng-deep .catalog-toolbar .mat-mdc-form-field-infix { padding: 8px 0; }

    .chip-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .chip {
      min-width: 0;
      padding: 2px 12px !important;
      font-size: 12px !important;
    }
    .chip.active {
      background: #6366F1 !important;
      color: #fff !important;
      border-color: #6366F1 !important;
    }

    .product-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
      overflow-y: auto;
      align-content: start;
      padding-right: 4px;
    }

    .product-card {
      background: var(--color-surface);
      border: 1px solid var(--color-outline-variant);
      border-radius: var(--radius-md);
      overflow: hidden;
      cursor: pointer;
      transition: all 0.2s ease;
      padding: 0;
      text-align: left;
      font-family: inherit;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-sm);
    }
    .product-card:not(.disabled):hover {
      box-shadow: var(--shadow-md);
      border-color: var(--color-outline);
      background: var(--color-surface-container-low);
    }
    .product-card.disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .product-image {
      position: relative;
      aspect-ratio: 1.6 / 1;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .product-image img { width: 100%; height: 100%; object-fit: cover; }
    .product-image mat-icon { font-size: 40px; width: 40px; height: 40px; }

    .oos-tag {
      position: absolute;
      bottom: 6px;
      right: 6px;
      background: #DC2626;
      color: #fff;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }

    .product-info {
      padding: 8px 10px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .product-name {
      font-size: 13px;
      font-weight: 600;
      color: #1E293B;
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
    .product-price {
      font-size: 15px;
      font-weight: 800;
      color: var(--color-primary);
      letter-spacing: -0.01em;
    }

    /* ── Order Panel ── */
    .order-panel {
      background: var(--color-surface);
      border-radius: var(--radius-lg);
      box-shadow: var(--shadow-1);
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .order-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 18px;
      border-bottom: 1px solid #F1F5F9;
    }
    .order-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 700;
      color: #1E293B;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .order-header mat-icon { color: #6366F1; }

    .order-items {
      flex: 1;
      overflow-y: auto;
      padding: 8px 12px;
    }

    .empty-cart {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      gap: 8px;
      color: #94A3B8;
      text-align: center;
      padding: 24px;
    }
    .empty-cart mat-icon { font-size: 48px; width: 48px; height: 48px; color: #CBD5E1; }
    .empty-cart p { margin: 0; color: #64748B; font-size: 14px; font-weight: 500; }
    .empty-cart span { font-size: 12px; }

    .cart-line {
      display: grid;
      grid-template-columns: 1fr auto auto 32px;
      align-items: center;
      gap: 6px;
      padding: 8px 4px;
      border-bottom: 1px solid #F1F5F9;
    }
    .cart-line:last-child { border-bottom: none; }
    .cart-line-info { display: flex; flex-direction: column; min-width: 0; }
    .cart-line-info strong {
      font-size: 13px;
      color: #1E293B;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .cart-line-info .muted { font-size: 11px; color: #94A3B8; }

    .qty-control {
      display: flex;
      align-items: center;
      gap: 0;
      background: #F1F5F9;
      border-radius: 8px;
      padding: 0 2px;
    }
    .qty-control button.mat-mdc-icon-button {
      width: 28px;
      height: 28px;
      padding: 0;
      line-height: 28px;
    }
    ::ng-deep .qty-control button .mat-mdc-button-touch-target { display: none; }
    ::ng-deep .qty-control button .mat-mdc-button-persistent-ripple { display: none; }
    .qty-control mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .qty { font-weight: 600; min-width: 22px; text-align: center; font-size: 13px; }
    .line-total { font-weight: 700; font-size: 13px; color: #1E293B; min-width: 70px; text-align: right; }

    .order-summary {
      padding: 14px 18px 16px 18px;
      border-top: 1px solid #F1F5F9;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .order-summary .row {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #475569;
    }
    .order-summary .row strong { color: #1E293B; }
    .order-summary .row .muted { color: #94A3B8; font-weight: 500; }
    .order-summary .row .positive { color: #059669; }
    .order-summary .row.total {
      font-size: 16px;
      padding-top: 6px;
      margin-top: 2px;
      border-top: 1px dashed #E2E8F0;
    }
    .order-summary .row.total strong { font-size: 20px; color: #4F46E5; }

    .pay-method { display: flex; flex-direction: column; gap: 6px; margin-top: 10px; }
    .pay-method .label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.5px; color: #64748B; font-weight: 600; }
    mat-button-toggle-group { width: 100%; }
    ::ng-deep .pay-method mat-button-toggle { flex: 1; font-size: 12px; }
    ::ng-deep .pay-method mat-button-toggle .mat-button-toggle-label-content { padding: 0 8px; line-height: 36px; display: flex; align-items: center; gap: 4px; }
    ::ng-deep .pay-method mat-button-toggle mat-icon { font-size: 16px; width: 16px; height: 16px; }

    .received-field { margin-top: 10px; width: 100%; }
    ::ng-deep .received-field .mat-mdc-form-field-infix { padding: 8px 0; }

    .checkout-btn {
      margin-top: 12px;
      height: 52px !important;
      font-size: 15px !important;
      font-weight: 700 !important;
      background: var(--color-primary) !important;
      border-radius: var(--radius-sm) !important;
    }
    .checkout-btn mat-icon { margin-right: 6px; }

    .loading, .empty {
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

    .stock-tag {
      position: absolute;
      bottom: 6px;
      right: 6px;
      background: rgba(16, 185, 129, 0.92);
      color: #fff;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 700;
    }

    .product-info-bottom {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 6px;
    }
    .stock-pill {
      background: #ECFDF5;
      color: #059669;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 700;
    }
  `],
})
export class PosComponent implements OnInit {
  search = signal('');
  selectedCategory = signal<RecipeCategory | 'ALL'>('ALL');
  categoryKeys: ('ALL' | RecipeCategory)[] = ['ALL', 'PANADERIA', 'PASTELERIA', 'BEBIDAS', 'OTROS'];
  categoryLabels = CATEGORY_LABELS;

  cart = signal<CartLine[]>([]);
  paymentMethod = signal<PaymentMethod>('CASH');
  saleType = signal<SaleType>('SIMPLE');
  amountReceived = signal(0);
  processing = signal(false);

  taxRate = computed(() => this.settings.business()?.taxRate ?? 18);

  total = computed(() =>
    this.cart().reduce((sum, l) => sum + l.recipe.salePrice * l.quantity, 0)
  );

  /** El precio ya incluye IGV: extraemos los netos. */
  subtotal = computed(() => {
    const rate = this.taxRate() / 100;
    return this.total() / (1 + rate);
  });

  taxAmount = computed(() => this.total() - this.subtotal());

  productionCost = computed(() =>
    this.cart().reduce((sum, l) => sum + (l.recipe.bomCost ?? 0) * l.quantity, 0)
  );

  grossMargin = computed(() => this.subtotal() - this.productionCost());

  change = computed(() => {
    if (this.saleType() !== 'ADVANCED') return 0;
    return Math.max(0, this.amountReceived() - this.total());
  });

  canCheckout = computed(() => {
    if (this.cart().length === 0) return false;
    if (this.saleType() === 'ADVANCED' && this.amountReceived() < this.total()) return false;
    return true;
  });

  /** El SELLER no ve datos internos de margen y costo de producción —
   *  son información sensible para gerencia. */
  showInternalCosts = computed(() => {
    const role = this.authService.role();
    return role === 'OWNER' || role === 'MANAGER';
  });

  filteredRecipes = computed(() => {
    const term = this.search().trim().toLowerCase();
    const cat = this.selectedCategory();
    return this.recipes.recipes().filter((r) => {
      const matchTerm = !term || r.name.toLowerCase().includes(term);
      const matchCat = cat === 'ALL' || r.category === cat;
      return matchTerm && matchCat;
    });
  });

  constructor(
    public recipes: RecipesService,
    public settings: SettingsService,
    private sales: SalesService,
    private branchService: BranchService,
    private authService: AuthService,
    private dialog: MatDialog,
    private snack: MatSnackBar
  ) {
    // Si el usuario cambia el método de pago a algo distinto de EFECTIVO,
    // resetear "Con vuelto" → "Simple" (los demás métodos no permiten vuelto).
    effect(() => {
      if (this.paymentMethod() !== 'CASH' && this.saleType() === 'ADVANCED') {
        this.saleType.set('SIMPLE');
        this.amountReceived.set(0);
      }
    }, { allowSignalWrites: true });
  }

  async ngOnInit(): Promise<void> {
    if (this.authService.role() === 'OWNER') {
      await this.branchService.loadBranches();
    }
    await Promise.all([this.recipes.load(), this.settings.loadBusiness()]);
  }

  categoryColor(c: RecipeCategory): string {
    return CATEGORY_COLORS[c];
  }

  onImgError(ev: Event): void {
    (ev.target as HTMLImageElement).style.display = 'none';
  }

  /**
   * Cuántas unidades quedan disponibles para agregar al carrito de un producto:
   * stock total − lo que ya hay en el carrito.
   */
  /** Tooltip que aparece sobre el producto cuando no se puede agregar al carrito. */
  outOfStockTooltip(r: Recipe): string {
    if (this.remainingStock(r) > 0) return '';
    if (r.stock === 0) {
      return r.isResale
        ? 'Sin stock. Registra una "Compra de Reventa" en Producción.'
        : 'Sin stock. Registra una producción para vender.';
    }
    return 'Ya agregaste todo el stock disponible al carrito';
  }

  remainingStock(r: Recipe): number {
    // Leer el stock ACTUAL desde la lista de recetas (no del snapshot del carrito),
    // así reflejamos producciones nuevas que el usuario haga durante la venta.
    const current = this.recipes.recipes().find((x) => x.id === r.id);
    const stock = current?.stock ?? r.stock;
    const inCart = this.cart().find((l) => l.recipe.id === r.id)?.quantity ?? 0;
    return Math.max(0, stock - inCart);
  }

  // ─── Cart ops ──────────────────────────────────────────────────────
  addToCart(r: Recipe): void {
    if (this.remainingStock(r) <= 0) {
      const noStockMsg = r.isResale
        ? `"${r.name}" no tiene stock. Registra una compra de reventa en Producción.`
        : `"${r.name}" no tiene stock. Registra una producción primero.`;
      this.snack.open(
        r.stock === 0 ? noStockMsg : `Ya tienes todas las ${r.stock} unidades de "${r.name}" en el carrito.`,
        'OK',
        { duration: 3500 }
      );
      return;
    }
    this.cart.update((lines) => {
      const existing = lines.find((l) => l.recipe.id === r.id);
      if (existing) {
        return lines.map((l) => l.recipe.id === r.id ? { ...l, quantity: l.quantity + 1 } : l);
      }
      return [...lines, { recipe: r, quantity: 1 }];
    });
  }

  increment(id: string): void {
    const line = this.cart().find((l) => l.recipe.id === id);
    if (!line) return;
    if (this.remainingStock(line.recipe) <= 0) {
      this.snack.open(
        `Solo hay ${line.recipe.stock} unidades de "${line.recipe.name}" disponibles.`,
        'OK',
        { duration: 3000 }
      );
      return;
    }
    this.cart.update((lines) =>
      lines.map((l) => l.recipe.id === id ? { ...l, quantity: l.quantity + 1 } : l)
    );
  }

  decrement(id: string): void {
    this.cart.update((lines) =>
      lines
        .map((l) => l.recipe.id === id ? { ...l, quantity: l.quantity - 1 } : l)
        .filter((l) => l.quantity > 0)
    );
  }

  removeLine(id: string): void {
    this.cart.update((lines) => lines.filter((l) => l.recipe.id !== id));
  }

  clearCart(): void {
    this.cart.set([]);
    this.amountReceived.set(0);
    this.saleType.set('SIMPLE');
  }

  // ─── Checkout ──────────────────────────────────────────────────────
  async checkout(): Promise<void> {
    if (!this.canCheckout()) return;
    // Si OWNER está en vista global, autoseleccionar la primera sucursal disponible
    // antes de enviar — si no, el backend rechaza con 400.
    if (this.authService.role() === 'OWNER' && !this.branchService.selectedBranchId()) {
      const first = this.branchService.branches()[0];
      if (!first) {
        this.snack.open('No tienes sucursales disponibles. Crea una en Configuración.', 'OK', { duration: 4000 });
        return;
      }
      this.branchService.selectBranch(first.id);
      this.snack.open(`Trabajando en sucursal: ${first.name}`, 'OK', { duration: 2500 });
    }
    this.processing.set(true);
    try {
      const payload: SalePayload = {
        type: this.saleType(),
        paymentMethod: this.paymentMethod(),
        items: this.cart().map((l) => ({
          recipeId: l.recipe.id,
          quantity: l.quantity,
          unitPrice: l.recipe.salePrice,
        })),
        ...(this.saleType() === 'ADVANCED' ? { amountReceived: this.amountReceived() } : {}),
      };

      const sale = await this.sales.create(payload);

      // Recuperar ticket completo con info de productos
      const full = await this.sales.getTicket(sale.id);
      const biz = this.settings.business();

      this.dialog.open(TicketDialogComponent, {
        data: {
          sale: full,
          business: biz ?? { name: 'Genimatech', ruc: null, taxRate: this.taxRate() },
        },
      });

      this.clearCart();
      // Recargar recetas para refrescar disponibilidad
      await this.recipes.load();
    } catch (e: unknown) {
      this.snack.open(getErrorMessage(e, 'Error en la venta'), 'OK', { duration: 4000 });
    } finally {
      this.processing.set(false);
    }
  }
}
