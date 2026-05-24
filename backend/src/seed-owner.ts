import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import prisma from './services/prisma.service';

/**
 * Crea el primer usuario OWNER del sistema:
 *  1. Lo registra en Supabase Auth (vía service_role)
 *  2. Crea el Business
 *  3. Crea una Branch inicial
 *  4. Crea la fila User vinculada (con el mismo id que Supabase Auth)
 *
 * Edita las constantes de abajo antes de ejecutar:
 *   npx ts-node src/seed-owner.ts
 */

// ─── EDITA ESTOS VALORES ──────────────────────────────────────────────────────
const OWNER_EMAIL    = 'owner@pastelicias.com';
const OWNER_PASSWORD = 'Pastelicias123!';
const OWNER_NAME     = 'Propietario Principal';
const BUSINESS_NAME  = 'Pastelicias';
const BUSINESS_RUC   = '20123456789';
const TAX_RATE       = 18;
const BRANCH_NAME    = 'Sucursal Principal';
const BRANCH_ADDRESS = 'Av. Principal 123, Lima';
const BRANCH_PHONE   = '+51 999 999 999';
// ──────────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  console.log('1/4 — Creando usuario en Supabase Auth…');
  const { data: existingList } = await supabase.auth.admin.listUsers();
  const existing = existingList?.users?.find((u) => u.email === OWNER_EMAIL);

  let authUserId: string;
  if (existing) {
    console.log(`   ↪ Usuario ya existe en Auth (id=${existing.id}). Reutilizando.`);
    authUserId = existing.id;
  } else {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email: OWNER_EMAIL,
      password: OWNER_PASSWORD,
      email_confirm: true,
    });
    if (error || !created.user) throw new Error(`Auth: ${error?.message ?? 'sin datos'}`);
    authUserId = created.user.id;
    console.log(`   ✓ Creado en Auth (id=${authUserId})`);
  }

  console.log('2/4 — Creando Business…');
  let business = await prisma.business.findFirst({ where: { name: BUSINESS_NAME } });
  if (!business) {
    business = await prisma.business.create({
      data: { name: BUSINESS_NAME, ruc: BUSINESS_RUC, taxRate: TAX_RATE },
    });
    console.log(`   ✓ Business creado (id=${business.id})`);
  } else {
    console.log(`   ↪ Business ya existe (id=${business.id})`);
  }

  console.log('3/4 — Creando Branch inicial…');
  let branch = await prisma.branch.findFirst({
    where: { businessId: business.id, name: BRANCH_NAME },
  });
  if (!branch) {
    branch = await prisma.branch.create({
      data: {
        businessId: business.id,
        name: BRANCH_NAME,
        address: BRANCH_ADDRESS,
        phone: BRANCH_PHONE,
        isActive: true,
      },
    });
    console.log(`   ✓ Branch creada (id=${branch.id})`);
  } else {
    console.log(`   ↪ Branch ya existe (id=${branch.id})`);
  }

  console.log('4/4 — Creando fila User (OWNER)…');
  const user = await prisma.user.upsert({
    where: { id: authUserId },
    update: {
      email: OWNER_EMAIL,
      fullName: OWNER_NAME,
      role: 'OWNER',
      businessId: business.id,
      branchId: null, // OWNER tiene acceso global
      isActive: true,
    },
    create: {
      id: authUserId,
      email: OWNER_EMAIL,
      fullName: OWNER_NAME,
      role: 'OWNER',
      businessId: business.id,
      branchId: null,
      isActive: true,
    },
  });
  console.log(`   ✓ User OWNER listo (id=${user.id})`);

  console.log('\n✅ Listo. Credenciales:');
  console.log(`   Email:    ${OWNER_EMAIL}`);
  console.log(`   Password: ${OWNER_PASSWORD}`);
}

main()
  .catch((err) => {
    console.error('❌ Falló el seed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
