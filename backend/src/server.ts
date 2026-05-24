import 'dotenv/config';
import app from './app';
import prisma from './services/prisma.service';
import { initSentry } from './services/sentry.service';

const PORT = Number(process.env.PORT) || 3000;

/**
 * Calienta el pool de Prisma haciendo queries baratas en paralelo. Sin esto, la
 * PRIMERA request real del día paga el costo de abrir TCP+TLS+auth (~600-1000ms).
 * Con esto, ese costo se paga una vez al arrancar el server.
 */
async function warmupPool(): Promise<void> {
  const t0 = Date.now();
  try {
    // Hacer 3 queries paralelas para que el pool abra ~3 conexiones cálidas.
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 1`,
      prisma.$queryRaw`SELECT 1`,
    ]);
    console.log(`🔥 Pool de Prisma calentado en ${Date.now() - t0}ms`);
  } catch (e) {
    console.warn('⚠️  No se pudo calentar el pool de Prisma:', e);
  }
}

async function main() {
  // Sentry primero — para capturar errores incluso del bootstrap
  await initSentry();

  // Verificar conexión a DB
  await prisma.$connect();
  console.log('✅ Conectado a la base de datos');

  // Calentar el pool ANTES de aceptar requests para que el primer usuario no
  // pague el costo de la conexión fría.
  await warmupPool();

  app.listen(PORT, () => {
    console.log(`🚀 Servidor Pastelicias corriendo en http://localhost:${PORT}`);
    console.log(`📋 Ambiente: ${process.env.NODE_ENV}`);
  });
}

// En serverless (Vercel) el entry point es api/index.ts, no este archivo.
// Solo arrancar `main()` cuando estamos en modo standalone (desarrollo local).
if (!process.env.VERCEL) {
  main().catch((err) => {
    console.error('❌ Error al iniciar el servidor:', err);
    process.exit(1);
  });
}
