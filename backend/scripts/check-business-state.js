/**
 * Diagnóstico rápido del estado de un business: branches, recipes con stock,
 * usuarios, sales previas. Útil para debug del POS.
 *
 *   node scripts/check-business-state.js <email-owner>
 */
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || '').toLowerCase().trim();
  if (!email) {
    console.error('Uso: node scripts/check-business-state.js <email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { business: true, branch: true },
  });
  if (!user) {
    console.error(`❌ No existe el user ${email}`);
    process.exit(1);
  }

  console.log('\n👤 Usuario:');
  console.log(`  id: ${user.id}`);
  console.log(`  email: ${user.email}`);
  console.log(`  role: ${user.role}`);
  console.log(`  branchId: ${user.branchId ?? '(null — OWNER global)'}`);
  console.log(`  isActive: ${user.isActive}`);

  console.log('\n🏪 Business:');
  console.log(`  id: ${user.business.id}`);
  console.log(`  name: ${user.business.name}`);
  console.log(`  plan: ${user.business.plan}`);

  // Branches
  const branches = await prisma.branch.findMany({
    where: { businessId: user.business.id },
    select: { id: true, name: true, isActive: true },
  });
  console.log(`\n🏬 Sucursales (${branches.length}):`);
  for (const b of branches) {
    const recipeCount = await prisma.recipe.count({ where: { branchId: b.id, isActive: true } });
    const recipesWithStock = await prisma.recipe.count({
      where: { branchId: b.id, isActive: true, stock: { gt: 0 } },
    });
    const ingredientCount = await prisma.ingredient.count({ where: { branchId: b.id } });
    const userCount = await prisma.user.count({ where: { branchId: b.id, isActive: true } });
    console.log(`  - ${b.name} (${b.id})`);
    console.log(`      isActive: ${b.isActive}`);
    console.log(`      recetas: ${recipeCount} (${recipesWithStock} con stock > 0)`);
    console.log(`      insumos: ${ingredientCount}`);
    console.log(`      empleados (excl. owner): ${userCount}`);
  }

  // Top 5 recetas con stock por sucursal
  console.log('\n🍰 Top 5 recetas con stock:');
  const topRecipes = await prisma.recipe.findMany({
    where: { branch: { businessId: user.business.id }, isActive: true, stock: { gt: 0 } },
    orderBy: { stock: 'desc' },
    take: 5,
    include: { branch: { select: { name: true } } },
  });
  if (topRecipes.length === 0) {
    console.log('  ❌ NO HAY recetas con stock — eso causa "Stock insuficiente" al vender');
  } else {
    for (const r of topRecipes) {
      console.log(`  - ${r.name} (${r.branch.name}): stock=${r.stock}, precio=S/${r.salePrice}`);
    }
  }

  // Ventas previas
  const lastSale = await prisma.sale.findFirst({
    where: { branch: { businessId: user.business.id } },
    orderBy: { createdAt: 'desc' },
    select: { id: true, total: true, createdAt: true, ticketCode: true },
  });
  console.log('\n💰 Última venta:');
  if (!lastSale) console.log('  (ninguna venta aún)');
  else console.log(`  ${lastSale.ticketCode} — S/${lastSale.total} — ${lastSale.createdAt.toISOString()}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
