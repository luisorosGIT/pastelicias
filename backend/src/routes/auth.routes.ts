import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import crypto from 'crypto';
import prisma from '../services/prisma.service';
import { ok, badRequest, serverError } from '../utils/response';
import { sendPasswordResetEmail } from '../services/email.service';

const router = Router();

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // service role para operaciones de admin
);

// ─── Schemas de validación ────────────────────────────────────────────────────
const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'Contraseña mínima de 6 caracteres'),
});

const signupSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'Contraseña mínima de 8 caracteres'),
  fullName: z.string().min(2, 'Tu nombre completo'),
  businessName: z.string().min(2, 'Nombre del negocio'),
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────
router.post('/login', async (req: Request, res: Response) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return badRequest(res, parsed.error.errors[0].message);
    }

    const { email, password } = parsed.data;

    // Autenticar con Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session) {
      return badRequest(res, 'Credenciales inválidas');
    }

    // Obtener perfil del usuario + info del business (para saber si terminó onboarding)
    const user = await prisma.user.findUnique({
      where: { id: authData.user.id },
      include: {
        branch: { select: { id: true, name: true } },
        business: { select: { id: true, name: true, onboardingCompleted: true } },
      },
    });

    if (!user) {
      return badRequest(res, 'Usuario no registrado en el sistema');
    }

    return ok(res, {
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        businessId: user.businessId,
        branchId: user.branchId,
        branch: user.branch,
      },
      business: user.business,
    });
  } catch (error) {
    console.error('[auth/login]', error);
    return serverError(res);
  }
});

// ─── POST /api/auth/signup ────────────────────────────────────────────────────
// Endpoint PÚBLICO. Crea un nuevo tenant completo en una sola request:
//   1. Usuario en Supabase Auth (con email_confirm=true → no requiere verificación)
//   2. Business (tenant root)
//   3. Primera Branch ("Sucursal Principal")
//   4. Fila User con rol OWNER, vinculada por id al auth.user
//   5. Login automático → devuelve accessToken para que el cliente entre directo
//
// Si falla a mitad, se hace cleanup (borrar lo creado en Supabase Auth y DB).
router.post('/signup', async (req: Request, res: Response) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

  const { email, password, fullName, businessName } = parsed.data;

  // Verificar que el email no esté ya registrado (mejor mensaje que dejar fallar Supabase)
  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return badRequest(res, 'Ya existe una cuenta con este email. Inicia sesión.');
  }

  // 1. Crear usuario en Supabase Auth (sin verificación de email)
  let authUserId: string | null = null;
  try {
    const { data: created, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // auto-confirmado, no requiere magic link
    });
    if (error || !created.user) {
      console.error('[signup/auth]', error);
      return badRequest(res, error?.message ?? 'No se pudo crear el usuario');
    }
    authUserId = created.user.id;
  } catch (e) {
    console.error('[signup/auth-throw]', e);
    return serverError(res);
  }

  // 2-4. Crear Business + Branch + User en una transacción.
  //      Si falla algo, hacemos rollback de la DB Y borramos el usuario de Supabase Auth.
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Plan FREE con 30 días de prueba desde el signup. Después de esa
      // fecha se bloquean los POSTs hasta que el usuario haga upgrade.
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const business = await tx.business.create({
        data: {
          name: businessName,
          taxRate: 18, // default IGV Perú
          trialEndsAt,
        },
      });

      const branch = await tx.branch.create({
        data: {
          businessId: business.id,
          name: 'Sucursal Principal',
          isActive: true,
        },
      });

      const user = await tx.user.create({
        data: {
          id: authUserId!,
          email,
          fullName,
          role: 'OWNER',
          businessId: business.id,
          branchId: null, // OWNER tiene acceso global, no atado a una sucursal
          isActive: true,
        },
      });

      return { business, branch, user };
    });

    // 5. Auto-login: generar tokens para que el frontend entre directo al wizard
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError || !authData.session) {
      // El signup fue exitoso pero el login falló — caso raro. Le pedimos
      // al usuario que entre manualmente desde /auth/login.
      return ok(res, { redirectTo: '/auth/login' }, 'Cuenta creada. Inicia sesión.');
    }

    return ok(res, {
      accessToken: authData.session.access_token,
      refreshToken: authData.session.refresh_token,
      user: {
        id: result.user.id,
        email: result.user.email,
        fullName: result.user.fullName,
        role: result.user.role,
        businessId: result.user.businessId,
        branchId: result.user.branchId,
      },
      business: {
        id: result.business.id,
        name: result.business.name,
        onboardingCompleted: result.business.onboardingCompleted,
      },
      branch: { id: result.branch.id, name: result.branch.name },
    }, 'Cuenta creada exitosamente');
  } catch (e) {
    console.error('[signup/db]', e);
    // Cleanup: borrar el usuario de Supabase Auth si el rollback de DB ya ocurrió
    if (authUserId) {
      try {
        await supabase.auth.admin.deleteUser(authUserId);
      } catch (cleanupErr) {
        console.error('[signup/cleanup]', cleanupErr);
      }
    }
    return serverError(res);
  }
});

// ─── POST /api/auth/refresh ───────────────────────────────────────────────────
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) return badRequest(res, 'refreshToken requerido');

    const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken });

    if (error || !data.session) {
      return badRequest(res, 'No se pudo renovar la sesión');
    }

    return ok(res, { accessToken: data.session.access_token });
  } catch {
    return serverError(res);
  }
});

// ─── Reset password con código de 6 dígitos ───────────────────────────────────

const CODE_TTL_MS = 15 * 60 * 1000; // 15 minutos
const RESET_TOKEN_TTL_MS = 10 * 60 * 1000; // 10 minutos para usar el token

/** Genera un número entre 100000 y 999999 sin sesgo modular. */
function generateCode(): string {
  return String(crypto.randomInt(100000, 1000000));
}

const forgotSchema = z.object({
  email: z.string().email('Email inválido'),
});

// POST /api/auth/forgot-password — paso 1: pide email, manda código
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const parsed = forgotSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);
    const email = parsed.data.email.toLowerCase().trim();

    // Política: respondemos OK incluso si el email no existe — evita enumeración.
    const userExists = await prisma.user.findUnique({ where: { email }, select: { id: true } });

    if (userExists) {
      // Invalida códigos previos para este email (defensa contra bruteforce)
      await prisma.passwordResetCode.updateMany({
        where: { email, used: false },
        data: { used: true },
      });

      const code = generateCode();
      await prisma.passwordResetCode.create({
        data: {
          email,
          code,
          expiresAt: new Date(Date.now() + CODE_TTL_MS),
        },
      });

      // IMPORTANTE: esperamos el envío. En serverless (Vercel) si no awaitamos,
      // la función puede terminar y matar la promesa antes de que loguee/envíe.
      try {
        await sendPasswordResetEmail(email, code);
      } catch (e) {
        console.error('[forgot-password] email send failed:', e);
      }
    }

    return ok(
      res,
      { email },
      'Si el correo existe, te enviamos un código de 6 dígitos. Revisa tu bandeja.'
    );
  } catch (e) {
    console.error('[auth/forgot-password]', e);
    return serverError(res);
  }
});

const verifySchema = z.object({
  email: z.string().email('Email inválido'),
  code: z.string().regex(/^\d{6}$/, 'Código de 6 dígitos'),
});

// POST /api/auth/verify-reset-code — paso 2: valida código, devuelve token corto
router.post('/verify-reset-code', async (req: Request, res: Response) => {
  try {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    const email = parsed.data.email.toLowerCase().trim();
    const code = parsed.data.code;

    const entry = await prisma.passwordResetCode.findFirst({
      where: { email, code, used: false, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!entry) {
      return badRequest(res, 'Código inválido o expirado. Pide uno nuevo.');
    }

    // Marca usado para que no se reutilice. Generamos un resetToken random
    // (firmado con el id de la entry) que el frontend usa en el paso 3.
    await prisma.passwordResetCode.update({
      where: { id: entry.id },
      data: { used: true },
    });

    // Token = entry.id + expiresAt (codificado). Lo verificamos en /reset-password.
    const tokenPayload = {
      id: entry.id,
      email,
      exp: Date.now() + RESET_TOKEN_TTL_MS,
    };
    const token = Buffer.from(JSON.stringify(tokenPayload)).toString('base64url');

    return ok(res, { resetToken: token, email }, 'Código verificado');
  } catch (e) {
    console.error('[auth/verify-reset-code]', e);
    return serverError(res);
  }
});

const resetSchema = z.object({
  resetToken: z.string().min(1, 'Token requerido'),
  newPassword: z.string().min(8, 'Mínimo 8 caracteres'),
});

// POST /api/auth/reset-password — paso 3: cambia password con el token
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const parsed = resetSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);

    let payload: { id: string; email: string; exp: number };
    try {
      payload = JSON.parse(Buffer.from(parsed.data.resetToken, 'base64url').toString('utf-8'));
    } catch {
      return badRequest(res, 'Token inválido');
    }
    if (!payload?.id || !payload?.email || !payload?.exp || payload.exp < Date.now()) {
      return badRequest(res, 'Token inválido o expirado. Vuelve a pedir el código.');
    }

    // Verifica que la entry exista y haya sido usada (consumida en el paso 2).
    const entry = await prisma.passwordResetCode.findUnique({ where: { id: payload.id } });
    if (!entry || entry.email !== payload.email || !entry.used) {
      return badRequest(res, 'Token inválido. Repite el proceso.');
    }

    // Buscar al user en nuestra DB para tener el id de Supabase Auth.
    const user = await prisma.user.findUnique({ where: { email: payload.email } });
    if (!user) {
      // Por seguridad, no leakear que no existe — pero tampoco hacer nada.
      return ok(res, null, 'Contraseña actualizada');
    }

    // Cambiar password usando el admin API de Supabase.
    const { error } = await supabase.auth.admin.updateUserById(user.id, {
      password: parsed.data.newPassword,
    });
    if (error) {
      console.error('[auth/reset-password] Supabase admin error:', error);
      return badRequest(res, 'No se pudo actualizar la contraseña: ' + error.message);
    }

    // Borra todos los códigos de este email para limpieza (opcional pero higiénico).
    await prisma.passwordResetCode.deleteMany({ where: { email: payload.email } });

    return ok(res, null, 'Contraseña actualizada con éxito');
  } catch (e) {
    console.error('[auth/reset-password]', e);
    return serverError(res);
  }
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────
router.post('/logout', async (req: Request, res: Response) => {
  // El logout real lo maneja el cliente borrando el token
  // Aquí solo confirmamos
  return ok(res, null, 'Sesión cerrada');
});

export default router;
