-- ============================================================
--  PASTELICIAS — Migración inicial
--  Ejecutar en: Supabase Dashboard → SQL Editor
-- ============================================================

-- ─── ENUMS ───────────────────────────────────────────────────
CREATE TYPE "Role"            AS ENUM ('OWNER', 'MANAGER', 'SELLER', 'INVENTORY');
CREATE TYPE "MeasureUnit"     AS ENUM ('KG', 'G', 'L', 'ML', 'UNIT');
CREATE TYPE "RecipeCategory"  AS ENUM ('PANADERIA', 'PASTELERIA', 'BEBIDAS', 'OTROS');
CREATE TYPE "SaleType"        AS ENUM ('SIMPLE', 'ADVANCED');
CREATE TYPE "PaymentMethod"   AS ENUM ('CASH', 'CARD', 'YAPE_PLIN');
CREATE TYPE "ReservationStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PROCESS', 'READY', 'DELIVERED');
CREATE TYPE "WasteType"       AS ENUM ('INGREDIENT', 'PRODUCT');
CREATE TYPE "WasteReason"     AS ENUM ('EXPIRY', 'PHYSICAL_DAMAGE', 'CONTAMINATION', 'LOST_BROKEN', 'SPILL', 'OTHER');

-- ─── BUSINESSES ──────────────────────────────────────────────
CREATE TABLE businesses (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name       TEXT NOT NULL,
  ruc        TEXT,
  "taxRate"  FLOAT NOT NULL DEFAULT 18,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── BRANCHES ────────────────────────────────────────────────
CREATE TABLE branches (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId" TEXT NOT NULL REFERENCES businesses(id),
  name         TEXT NOT NULL,
  address      TEXT,
  phone        TEXT,
  "isActive"   BOOLEAN NOT NULL DEFAULT true
);

-- ─── USERS ───────────────────────────────────────────────────
CREATE TABLE users (
  id           TEXT PRIMARY KEY,
  "businessId" TEXT NOT NULL REFERENCES businesses(id),
  "branchId"   TEXT REFERENCES branches(id),
  email        TEXT NOT NULL UNIQUE,
  "fullName"   TEXT NOT NULL,
  role         "Role" NOT NULL DEFAULT 'SELLER',
  "isActive"   BOOLEAN NOT NULL DEFAULT true
);

-- ─── INGREDIENTS ─────────────────────────────────────────────
CREATE TABLE ingredients (
  id                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "branchId"         TEXT NOT NULL REFERENCES branches(id),
  name               TEXT NOT NULL,
  unit               "MeasureUnit" NOT NULL,
  "presentationSize" FLOAT NOT NULL,
  stock              FLOAT NOT NULL DEFAULT 0,
  "minStock"         FLOAT NOT NULL,
  "unitCost"         FLOAT NOT NULL,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── RECIPES ─────────────────────────────────────────────────
CREATE TABLE recipes (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "branchId"   TEXT NOT NULL REFERENCES branches(id),
  name         TEXT NOT NULL,
  category     "RecipeCategory" NOT NULL,
  "salePrice"  FLOAT NOT NULL,
  "imageUrl"   TEXT,
  description  TEXT,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── RECIPE ITEMS (BOM) ──────────────────────────────────────
CREATE TABLE recipe_items (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "recipeId"     TEXT NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  "ingredientId" TEXT NOT NULL REFERENCES ingredients(id),
  quantity       FLOAT NOT NULL,
  UNIQUE ("recipeId", "ingredientId")
);

-- ─── SALES ───────────────────────────────────────────────────
CREATE TABLE sales (
  id               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "branchId"       TEXT NOT NULL REFERENCES branches(id),
  "userId"         TEXT NOT NULL REFERENCES users(id),
  type             "SaleType" NOT NULL DEFAULT 'SIMPLE',
  "paymentMethod"  "PaymentMethod" NOT NULL,
  subtotal         FLOAT NOT NULL,
  "taxAmount"      FLOAT NOT NULL,
  total            FLOAT NOT NULL,
  "amountReceived" FLOAT,
  change           FLOAT,
  "ticketCode"     TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── SALE ITEMS ──────────────────────────────────────────────
CREATE TABLE sale_items (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "saleId"    TEXT NOT NULL REFERENCES sales(id) ON DELETE CASCADE,
  "recipeId"  TEXT NOT NULL REFERENCES recipes(id),
  quantity    INT NOT NULL,
  "unitPrice" FLOAT NOT NULL
);

-- ─── RESERVATIONS ────────────────────────────────────────────
CREATE TABLE reservations (
  id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "branchId"      TEXT NOT NULL REFERENCES branches(id),
  "clientName"    TEXT NOT NULL,
  phone           TEXT NOT NULL,
  "deliveryDate"  TIMESTAMPTZ NOT NULL,
  details         TEXT,
  "recipeId"      TEXT,
  "customProduct" TEXT,
  "totalPrice"    FLOAT NOT NULL,
  advance         FLOAT NOT NULL DEFAULT 0,
  status          "ReservationStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── PRODUCTIONS ─────────────────────────────────────────────
CREATE TABLE productions (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "branchId"  TEXT NOT NULL REFERENCES branches(id),
  "recipeId"  TEXT NOT NULL REFERENCES recipes(id),
  quantity    INT NOT NULL,
  notes       TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── WASTE LOGS ──────────────────────────────────────────────
CREATE TABLE waste_logs (
  id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "branchId"     TEXT NOT NULL REFERENCES branches(id),
  type           "WasteType" NOT NULL,
  "ingredientId" TEXT REFERENCES ingredients(id),
  "recipeId"     TEXT REFERENCES recipes(id),
  quantity       FLOAT NOT NULL,
  cost           FLOAT NOT NULL,
  reason         "WasteReason" NOT NULL,
  notes          TEXT,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── ÍNDICES de rendimiento ───────────────────────────────────
CREATE INDEX idx_ingredients_branch ON ingredients("branchId");
CREATE INDEX idx_recipes_branch     ON recipes("branchId");
CREATE INDEX idx_sales_branch       ON sales("branchId");
CREATE INDEX idx_sales_created      ON sales("createdAt");
CREATE INDEX idx_reservations_branch ON reservations("branchId");
CREATE INDEX idx_productions_branch ON productions("branchId");
CREATE INDEX idx_waste_branch       ON waste_logs("branchId");

-- ─── Tabla de _prisma_migrations (para que Prisma reconozca el estado) ───────
CREATE TABLE IF NOT EXISTS "_prisma_migrations" (
  id                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  checksum            TEXT NOT NULL,
  finished_at         TIMESTAMPTZ,
  migration_name      TEXT NOT NULL,
  logs                TEXT,
  rolled_back_at      TIMESTAMPTZ,
  started_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_steps_count INT NOT NULL DEFAULT 0
);

SELECT 'Migración Pastelicias completada exitosamente ✓' AS resultado;
