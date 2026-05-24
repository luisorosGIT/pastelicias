import { Role } from '@prisma/client';
import { Request } from 'express';

// ─── Usuario autenticado (payload del JWT de Supabase) ────────────────────────
export interface AuthUser {
  id: string;          // Supabase Auth UID === User.id en nuestra DB
  email: string;
  role: Role;
  businessId: string;
  branchId: string | null; // null para OWNER
}

// ─── Module augmentation: agregar user/branchId al Request global de Express ──
// Esto hace que AuthRequest sea compatible con RequestHandler de Express,
// requerido por el strict-mode de tsc que usa Vercel al bundlear funciones.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user: AuthUser;
      branchId: string;
    }
  }
}

// ─── Request extendido con usuario autenticado ────────────────────────────────
// AuthRequest ahora es alias directo de Request (que ya tiene user/branchId via
// module augmentation). Mantenemos el nombre para no romper imports existentes.
export type AuthRequest = Request;

// ─── Respuesta estándar de la API ─────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

// ─── Paginación ───────────────────────────────────────────────────────────────
export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  totalPages: number;
}

// ─── Filtros de fecha ─────────────────────────────────────────────────────────
export type DateFilter = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year';

// ─── KPIs del Dashboard ───────────────────────────────────────────────────────
export interface DashboardKpis {
  dailySales: number;
  averageTicket: number;
  wasteIndex: number;         // porcentaje
  criticalIngredients: number;
}

// ─── Ítem de carrito POS ──────────────────────────────────────────────────────
export interface CartItem {
  recipeId: string;
  quantity: number;
  unitPrice: number;
}

// ─── Payload para crear venta ─────────────────────────────────────────────────
export interface CreateSalePayload {
  type: 'SIMPLE' | 'ADVANCED';
  paymentMethod: 'CASH' | 'CARD' | 'YAPE_PLIN';
  items: CartItem[];
  amountReceived?: number;
}

// ─── Payload para crear producción ───────────────────────────────────────────
export interface CreateProductionPayload {
  recipeId: string;
  quantity: number;
  notes?: string;
}

// ─── Merma ────────────────────────────────────────────────────────────────────
export interface CreateWastePayload {
  type: 'INGREDIENT' | 'PRODUCT';
  ingredientId?: string;
  recipeId?: string;
  quantity: number;
  reason: 'EXPIRY' | 'PHYSICAL_DAMAGE' | 'CONTAMINATION' | 'LOST_BROKEN' | 'SPILL' | 'OTHER';
  notes?: string;
}

// ─── Configuración de negocio ─────────────────────────────────────────────────
export interface BusinessConfig {
  name: string;
  ruc: string | null;
  taxRate: number;
  hideIngredientCosts: boolean;   // almacenado fuera de Prisma (settings table o metadata)
  allowBulkInventoryEdit: boolean;
}
