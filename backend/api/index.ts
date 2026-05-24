/**
 * Entry point para Vercel serverless functions.
 *
 * Vercel detecta automáticamente la carpeta `/api/` y trata cada archivo
 * como una función serverless. Este archivo importa el Express app completo
 * (con todas sus rutas) y lo exporta como handler — así Vercel enruta CUALQUIER
 * request a `/api/*` a través de Express, sin tener que partir el código en
 * múltiples archivos.
 *
 * El secreto: Express implementa la interfaz `(req, res) => void` que es
 * EXACTAMENTE lo que espera Vercel. No necesitamos `@vercel/node` adapter
 * para Express — es nativo.
 *
 * Flujo de un request:
 *   Browser → Vercel Edge → función serverless → Express router → handler
 */
import 'dotenv/config';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import app from '../src/app';
import { initSentry } from '../src/services/sentry.service';

// Inicializar Sentry de forma idempotente — solo la primera invocación lo
// configura, las siguientes son no-op. En warm starts Vercel reutiliza el
// proceso así que esto solo afecta el primer request del container.
let sentryInitialized = false;
const initOnce = async (): Promise<void> => {
  if (sentryInitialized) return;
  sentryInitialized = true;
  await initSentry();
};

/**
 * Handler de Vercel serverless. Express tiene la firma `(req, res) => void`
 * que coincide exactamente con la que Vercel espera, así que podemos
 * delegarle TODO el routing al Express app sin partir el código.
 */
export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  await initOnce();
  return (app as unknown as (req: VercelRequest, res: VercelResponse) => void)(req, res);
}
