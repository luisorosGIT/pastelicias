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
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:4200',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
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
