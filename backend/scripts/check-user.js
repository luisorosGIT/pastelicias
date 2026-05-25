/**
 * Debug rápido: verifica si un user existe en la tabla `users` de Prisma
 * (NO en supabase.auth.users, que es lo que valida el signup).
 *
 * Si el user está en Supabase Auth pero no en nuestra tabla, el reset password
 * no funciona porque forgot-password busca en prisma.user.
 *
 *   node scripts/check-user.js oros6822@gmail.com
 */
require('dotenv/config');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = (process.argv[2] || '').toLowerCase().trim();
  if (!email) {
    console.error('Uso: node scripts/check-user.js <email>');
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    include: { business: { select: { name: true, plan: true } } },
  });

  if (!user) {
    console.log(`❌ NO existe en tabla prisma.users el email: ${email}`);
  } else {
    console.log(`✅ Existe en prisma.users:`);
    console.log({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      business: user.business,
    });
  }

  // Buscar codigos pendientes
  const codes = await prisma.passwordResetCode.findMany({
    where: { email },
    orderBy: { createdAt: 'desc' },
    take: 5,
  });
  if (codes.length > 0) {
    console.log(`\n📨 ${codes.length} código(s) en historial:`);
    codes.forEach((c) => {
      console.log(`  - ${c.code} | used=${c.used} | expira=${c.expiresAt.toISOString()} | creado=${c.createdAt.toISOString()}`);
    });
  } else {
    console.log(`\n📨 No hay códigos en historial para este email.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
