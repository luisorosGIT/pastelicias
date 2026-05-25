/**
 * Borra completamente un business y todas sus dependencias.
 * Pensado para limpiar cuentas de testing o usuarios que quieren bajarse.
 *
 *   node scripts/delete-business.js <email-del-owner>
 *
 * Borra (en orden, respetando foreign keys):
 *  1. Mensajes y conversaciones de soporte
 *  2. Ventas (sale_items se borran por cascade)
 *  3. Reservaciones
 *  4. Producciones
 *  5. WasteLogs
 *  6. Conteos de inventario
 *  7. Compras (purchases)
 *  8. RecipeItems (ingredientes por receta) — cascade desde Recipe
 *  9. Recipes
 * 10. Ingredients
 * 11. Users (incluyendo el owner) y su entrada en Supabase Auth
 * 12. Branches
 * 13. Business
 */
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const { createClient } = require('@supabase/supabase-js');

const prisma = new PrismaClient();
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const email = (process.argv[2] || '').toLowerCase().trim();
  if (!email) {
    console.error('Uso: node scripts/delete-business.js <email-del-owner>');
    process.exit(1);
  }

  const owner = await prisma.user.findUnique({
    where: { email },
    include: { business: true },
  });
  if (!owner) {
    console.log(`No existe user con email ${email}`);
    process.exit(0);
  }
  if (owner.role !== 'OWNER') {
    console.error(`${email} no es OWNER (rol: ${owner.role}). Cancelado.`);
    process.exit(1);
  }

  const businessId = owner.business.id;
  const businessName = owner.business.name;
  console.log(`\n🗑️  Borrando business "${businessName}" (${businessId})...`);

  // Recolectar IDs de todos los usuarios del business (incluyendo el owner)
  const users = await prisma.user.findMany({
    where: { businessId },
    select: { id: true, email: true },
  });
  const userIds = users.map((u) => u.id);
  const branchIds = (await prisma.branch.findMany({
    where: { businessId },
    select: { id: true },
  })).map((b) => b.id);

  console.log(`  Usuarios: ${users.length}, Sucursales: ${branchIds.length}`);

  // 1. Support conversations + messages
  const convs = await prisma.supportConversation.findMany({
    where: { businessId },
    select: { id: true },
  });
  const convIds = convs.map((c) => c.id);
  if (convIds.length > 0) {
    await prisma.supportMessage.deleteMany({ where: { conversationId: { in: convIds } } });
    await prisma.supportConversation.deleteMany({ where: { businessId } });
    console.log(`  ✓ ${convIds.length} conversación(es) de soporte`);
  }

  // 2. Sales (con cascade de items)
  const salesDel = await prisma.sale.deleteMany({ where: { branchId: { in: branchIds } } });
  console.log(`  ✓ ${salesDel.count} venta(s)`);

  // 3. Reservations
  const resDel = await prisma.reservation.deleteMany({ where: { branchId: { in: branchIds } } });
  console.log(`  ✓ ${resDel.count} reservación(es)`);

  // 4. Productions (si existe el modelo)
  try {
    const prodDel = await prisma.production.deleteMany({ where: { branchId: { in: branchIds } } });
    console.log(`  ✓ ${prodDel.count} producción(es)`);
  } catch (e) { /* tabla puede no tener ese branchId */ }

  // 5. WasteLogs
  try {
    const wasteDel = await prisma.wasteLog.deleteMany({ where: { branchId: { in: branchIds } } });
    console.log(`  ✓ ${wasteDel.count} merma(s)`);
  } catch (e) {}

  // 6. Inventory counts
  try {
    const countDel = await prisma.inventoryCount.deleteMany({ where: { branchId: { in: branchIds } } });
    console.log(`  ✓ ${countDel.count} conteo(s) de inventario`);
  } catch (e) {}

  // 7. Purchases
  try {
    const purchDel = await prisma.purchase.deleteMany({ where: { branchId: { in: branchIds } } });
    console.log(`  ✓ ${purchDel.count} compra(s)`);
  } catch (e) {}

  // 8-9. RecipeItems + Recipes
  const recipes = await prisma.recipe.findMany({
    where: { branchId: { in: branchIds } },
    select: { id: true },
  });
  if (recipes.length > 0) {
    const recipeIds = recipes.map((r) => r.id);
    await prisma.recipeItem.deleteMany({ where: { recipeId: { in: recipeIds } } });
    await prisma.recipe.deleteMany({ where: { id: { in: recipeIds } } });
    console.log(`  ✓ ${recipes.length} receta(s)`);
  }

  // 10. Ingredients
  const ingDel = await prisma.ingredient.deleteMany({ where: { branchId: { in: branchIds } } });
  console.log(`  ✓ ${ingDel.count} insumo(s)`);

  // 11. Users de Prisma
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  console.log(`  ✓ ${userIds.length} usuario(s) Prisma`);

  // 12. Branches
  await prisma.branch.deleteMany({ where: { businessId } });
  console.log(`  ✓ ${branchIds.length} sucursal(es)`);

  // 13. Business
  await prisma.business.delete({ where: { id: businessId } });
  console.log(`  ✓ Business "${businessName}"`);

  // 14. Supabase Auth users (los emails que coincidan)
  console.log(`\n🗑️  Borrando users de Supabase Auth...`);
  for (const u of users) {
    try {
      const { error } = await supabaseAdmin.auth.admin.deleteUser(u.id);
      if (error) {
        console.warn(`  ⚠️ ${u.email}: ${error.message}`);
      } else {
        console.log(`  ✓ ${u.email}`);
      }
    } catch (e) {
      console.warn(`  ⚠️ ${u.email}: ${e.message}`);
    }
  }

  console.log(`\n✅ Done. Business "${businessName}" eliminado completamente.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
