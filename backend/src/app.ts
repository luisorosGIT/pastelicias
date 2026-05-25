import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import router from './routes';
import { captureException, sentryRequestHandler, sentryErrorHandler } from './services/sentry.service';

const app = express();

// ─── Sentry request handler ───────────────────────────────────────────────────
// Debe ir PRIMERO para capturar todos los requests. Es no-op si Sentry no
// está activo (no requiere @sentry/node instalado).
app.use(sentryRequestHandler());

// ─── Seguridad y utilidades ───────────────────────────────────────────────────
app.use(helmet());
app.use(morgan('dev'));

// ─── CORS ─────────────────────────────────────────────────────────────────────
// Aceptamos los dominios oficiales del frontend + cualquier URL configurada en
// FRONTEND_URL + cualquier *.vercel.app del proyecto (para preview deployments)
// + localhost para dev. Esto evita el bug de "se renombró el proyecto y CORS
// quedó con la URL vieja".
const ALLOWED_ORIGINS = new Set(
  [
    'https://genimatech.vercel.app',
    'https://pastelicias-vert.vercel.app',
    'http://localhost:4200',
    process.env.FRONTEND_URL,
  ].filter(Boolean) as string[]
);
const ALLOWED_VERCEL_PROJECT_PREFIX = 'https://genimatech-'; // preview URLs como
                                                            // genimatech-xxxxxx-luisorosgits-projects.vercel.app

app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin / curl / server-to-server → sin Origin → permitir.
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.has(origin)) return callback(null, true);
      if (origin.startsWith(ALLOWED_VERCEL_PROJECT_PREFIX)) return callback(null, true);
      // Cualquier otro: rechazar.
      console.warn('[CORS] origen bloqueado:', origin);
      return callback(new Error('CORS not allowed'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Secret'],
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Rutas ────────────────────────────────────────────────────────────────────
app.use('/api', router);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Ruta no encontrada' });
});

// ─── Sentry error handler — debe ir ANTES del handler genérico ────────────────
app.use(sentryErrorHandler());

// ─── Error handler global ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Global Error]', err);
  captureException(err); // reporta a Sentry si está activo
  res.status(500).json({ success: false, error: 'Error interno del servidor' });
});

export default app;
