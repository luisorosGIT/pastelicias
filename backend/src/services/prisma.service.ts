import { PrismaClient } from '@prisma/client';

// Singleton de PrismaClient — reutiliza la conexión entre llamadas.
//
// Notas:
// - El driver usa `pgbouncer=true` en la connection string (ver .env). Eso
//   desactiva prepared statements en Prisma y evita el `DEALLOCATE ALL` que
//   antes producía 4 roundtrips por query simple.
// - El log de queries lo dejamos en 'error'/'warn' para reducir ruido. Activa
//   'query' temporalmente si necesitas depurar SQL.
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log: ['error', 'warn'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export default prisma;
