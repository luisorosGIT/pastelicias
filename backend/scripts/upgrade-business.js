/**
 * Sube el plan de un business a PRO / BUSINESS / FREE manualmente.
 * También limpia trialEndsAt si subes a un plan pagado.
 *
 *   node scripts/upgrade-business.js <email-del-owner> <plan>
 *
 * Ej.: node scripts/upgrade-business.js oros6822@gmail.com PRO
 */
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || '').toLowerCase().trim();
  const newPlan = (process.argv[3] || '').toUpperCase();
  if (!email || !['FREE', 'PRO', 'BUSINESS'].includes(newPlan)) {
    console.error('Uso: node scripts/upgrade-business.js <email-del-owner> <FREE|PRO|BUSINESS>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { business: true },
  });
  if (!user) {
    console.error(`❌ No existe el user ${email}`);
    process.exit(1);
  }
  if (user.role !== 'OWNER') {
    console.error(`❌ ${email} no es OWNER (rol: ${user.role})`);
    process.exit(1);
  }

  const updated = await prisma.business.update({
    where: { id: user.business.id },
    data: {
      plan: newPlan,
      // PRO/BUSINESS = sin trial. FREE = 30 días nuevos.
      trialEndsAt:
        newPlan === 'FREE'
          ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
          : null,
    },
  });

  console.log(`✅ Business "${updated.name}" cambiado: ${user.business.plan} → ${newPlan}`);
  if (updated.trialEndsAt) {
    console.log(`   Trial expira: ${updated.trialEndsAt.toISOString()}`);
  } else {
    console.log(`   Sin trial (plan pagado).`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
