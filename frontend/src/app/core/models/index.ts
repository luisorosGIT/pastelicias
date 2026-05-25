// ─── Enums ────────────────────────────────────────────────────────────────────
export type Role = 'OWNER' | 'MANAGER' | 'SELLER' | 'INVENTORY';
export type MeasureUnit = 'KG' | 'G' | 'L' | 'ML' | 'UNIT';
export type RecipeCategory = 'PANADERIA' | 'PASTELERIA' | 'BEBIDAS' | 'OTROS';
export type SaleType = 'SIMPLE' | 'ADVANCED';
export type PaymentMethod = 'CASH' | 'CARD' | 'YAPE_PLIN';
export type ReservationStatus = 'PENDING' | 'CONFIRMED' | 'IN_PROCESS' | 'READY' | 'DELIVERED';
export type WasteType = 'INGREDIENT' | 'PRODUCT';
export type WasteReason = 'EXPIRY' | 'PHYSICAL_DAMAGE' | 'CONTAMINATION' | 'LOST_BROKEN' | 'SPILL' | 'OTHER';
export type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year';

// ─── Entidades ────────────────────────────────────────────────────────────────
export interface Business {
  id: string;
  name: string;
  ruc: string | null;
  taxRate: number;
  hideIngredientCosts: boolean;
  allowBulkInventoryEdit: boolean;
  /** URL del logo del negocio. Mostrado en sidebar y tickets. */
  logoUrl: string | null;
  /** True cuando el OWNER ya completó el wizard inicial post-signup. */
  onboardingCompleted: boolean;
  createdAt: string;
}

export interface Branch {
  id: string;
  businessId: string;
  name: string;
  address: string | null;
  phone: string | null;
  isActive: boolean;
}

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  businessId: string;
  branchId: string | null;
  isActive?: boolean;
  branch?: Pick<Branch, 'id' | 'name'> | null;
}

export interface Ingredient {
  id: string;
  branchId: string;
  name: string;
  unit: MeasureUnit;
  presentationSize: number;
  stock: number;
  minStock: number;
  unitCost: number;
  // Calculados
  totalPresentations?: number;
  isCritical?: boolean;
  totalValue?: number;
}

export interface RecipeItem {
  id: string;
  recipeId: string;
  ingredientId: string;
  quantity: number;
  ingredient: Ingredient;
}

export interface Recipe {
  id: string;
  branchId: string;
  name: string;
  category: RecipeCategory;
  salePrice: number;
  /** Stock de producto terminado disponible para venta. */
  stock: number;
  imageUrl: string | null;
  description: string | null;
  isActive: boolean;
  /** Si true, el producto se compra ya hecho (gaseosa, snacks). Si false, se fabrica desde el BOM. */
  isResale: boolean;
  /** Costo unitario de compra del producto de reventa (CPP). Null para fabricados. */
  purchaseCost: number | null;
  items: RecipeItem[];
  // Calculados
  bomCost?: number;
  margin?: number;
  /** True si stock > 0 (hay producto disponible para vender). */
  isAvailable?: boolean;
  /** Unidades MÁS que se podrían producir con los insumos actuales (BOM). Siempre 0 para reventa. */
  producible?: number;
  branch?: Pick<Branch, 'id' | 'name'> | null;
}

export interface SaleItem {
  id: string;
  saleId: string;
  recipeId: string;
  quantity: number;
  unitPrice: number;
  recipe?: Pick<Recipe, 'name'>;
}

export interface Sale {
  id: string;
  branchId: string;
  userId: string;
  type: SaleType;
  paymentMethod: PaymentMethod;
  subtotal: number;
  taxAmount: number;
  total: number;
  amountReceived: number | null;
  change: number | null;
  ticketCode: string;
  createdAt: string;
  items: SaleItem[];
  /** Vendedor que registró la venta — viene desde el backend cuando se solicita. */
  user?: { id: string; fullName: string; email: string };
}

export interface Reservation {
  id: string;
  branchId: string;
  clientName: string;
  phone: string;
  deliveryDate: string;
  details: string | null;
  recipeId: string | null;
  customProduct: string | null;
  totalPrice: number;
  advance: number;
  status: ReservationStatus;
  createdAt: string;
}

export interface Production {
  id: string;
  branchId: string;
  recipeId: string;
  quantity: number;
  notes: string | null;
  createdAt: string;
  recipe?: Pick<Recipe, 'name' | 'category'>;
}

export interface WasteLog {
  id: string;
  branchId: string;
  type: WasteType;
  ingredientId: string | null;
  recipeId: string | null;
  quantity: number;
  cost: number;
  reason: WasteReason;
  notes: string | null;
  createdAt: string;
  ingredient?: Pick<Ingredient, 'name' | 'unit'> | null;
  recipe?: Pick<Recipe, 'name'> | null;
}

// ─── Respuesta API ────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── Sesión del usuario autenticado ──────────────────────────────────────────
export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  user: User;
  /** Negocio del usuario (incluye onboardingCompleted). Solo viene en login/signup. */
  business?: Pick<Business, 'id' | 'name' | 'onboardingCompleted'>;
}

export interface SignupPayload {
  email: string;
  password: string;
  fullName: string;
  businessName: string;
}

// ─── Plan SaaS ────────────────────────────────────────────────────────────────
export type PlanCode = 'FREE' | 'PRO' | 'BUSINESS';

/** Límites de un plan. `null` significa "ilimitado". */
export interface PlanLimits {
  branches: number | null;
  ingredients: number | null;
  recipes: number | null;
  users: number | null;
}

export interface PlanUsage {
  branches: number;
  ingredients: number;
  recipes: number;
  users: number;
}

export interface PlanInfo {
  plan: PlanCode;
  label: string;
  priceMonthlyPen: number;
  limits: PlanLimits;
}

// ─── Chat de soporte ──────────────────────────────────────────────────────────
export interface SupportMessage {
  id: string;
  conversationId: string;
  senderRole: 'USER' | 'ADMIN';
  senderName: string | null;
  content: string;
  isReadByUser: boolean;
  isReadByAdmin: boolean;
  createdAt: string;
}

export interface SupportConversation {
  id: string;
  businessId: string;
  userId: string;
  status: 'OPEN' | 'CLOSED';
  createdAt: string;
  updatedAt: string;
}

export interface PlanState extends PlanInfo {
  usage: PlanUsage;
  allPlans: PlanInfo[];
  /** ISO date — cuándo termina la prueba gratis. null si ya está en plan pagado. */
  trialEndsAt: string | null;
  /** Días enteros que faltan para que termine el trial. 0 si expiró. */
  trialDaysRemaining: number;
  /** True si el plan es FREE y el trial ya pasó. */
  trialExpired: boolean;
}

// ─── Carrito POS ──────────────────────────────────────────────────────────────
export interface CartItem {
  recipe: Recipe;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────
export interface DashboardKpis {
  dailySales: number;
  averageTicket: number;
  wasteIndex: number;
  criticalIngredients: number;
}

export interface InventoryKpis {
  totalValue: number;
  criticalCount: number;
  total: number;
}

export interface ReportKpis {
  grossSales: number;
  netSales: number;
  wasteImpact: number;
  wastePercent: number;
}
