/**
 * One-off: backfillea trialEndsAt = now() + 30 días para todos los
 * businesses FREE existentes que aún no tienen trial seteado.
 *
 * Correr UNA vez después de aplicar el schema:
 *   node scripts/backfill-trial.js
 */
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const result = await prisma.business.updateMany({
    where: { trialEndsAt: null, plan: 'FREE' },
    data: { trialEndsAt: thirtyDaysFromNow },
  });
  console.log(
    'Backfilled',
    result.count,
    'businesses with trialEndsAt =',
    thirtyDaysFromNow.toISOString()
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
