import { Router, Request, Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../services/prisma.service';
import { ok, badRequest, serverError } from '../utils/response';
import { signAdminToken } from '../middleware/admin.middleware';

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
    const emailNorm = email.toLowerCase().trim();

    // ─── Detección de admin del SaaS ────────────────────────────────────────
    // Si el email está en la tabla `admins`, autenticamos contra bcrypt y
    // devolvemos una respuesta especial con isAdmin: true + adminToken.
    // El frontend lo detecta y redirige a /admin/dashboard en lugar del flow
    // normal de business owner.
    //
    // Si la password admin no coincide, NO seguimos al flujo Supabase — porque
    // el email pertenece a un admin (no a un user business). Eso evita que un
    // admin que olvidó su password se loguee accidentalmente como business owner.
    const admin = await prisma.admin.findUnique({ where: { email: emailNorm } });
    if (admin && admin.isActive) {
      const valid = await bcrypt.compare(password, admin.passwordHash);
      if (!valid) return badRequest(res, 'Credenciales inválidas');

      prisma.admin.update({
        where: { id: admin.id },
        data: { lastLoginAt: new Date() },
      }).catch(() => {});

      const adminToken = signAdminToken({ id: admin.id, email: admin.email, name: admin.name });
      return ok(res, {
        isAdmin: true,
        adminToken,
        admin: { id: admin.id, email: admin.email, name: admin.name },
      }, 'Sesión iniciada como administrador');
    }

    // Autenticar con Supabase Auth (flujo normal business owner)
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

// ─── OAuth (Google) bootstrap ─────────────────────────────────────────────────
// Tras un sign-in OAuth de Supabase, el cliente recibe un access_token en el
// fragment de la URL. Llama a este endpoint con su Bearer token para:
//   1. Verificar el token contra Supabase
//   2. Si ya existe en prisma.user → devolver perfil + business + branch
//   3. Si NO existe → crear Business + Branch + User automáticamente con
//      plan FREE + trial 30 días y onboardingCompleted=false (va a /onboarding)
//
// El user no usa contraseña — el login se hará siempre via Google.
router.post('/oauth-bootstrap', async (req: Request, res: Response) => {
  try {
    // Validar el Bearer token con Supabase
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!token) return badRequest(res, 'Token de OAuth requerido');

    const { data: authData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !authData.user) {
      return badRequest(res, 'Token inválido o expirado');
    }
    const authUser = authData.user;
    const email = (authUser.email || '').toLowerCase().trim();
    if (!email) {
      return badRequest(res, 'No se pudo leer el email del proveedor OAuth');
    }

    // ¿Existe en nuestra DB?
    const existing = await prisma.user.findUnique({
      where: { id: authUser.id },
      include: {
        business: { select: { id: true, name: true, onboardingCompleted: true } },
        branch: { select: { id: true, name: true } },
      },
    });

    if (existing) {
      return ok(res, {
        user: {
          id: existing.id,
          email: existing.email,
          fullName: existing.fullName,
          role: existing.role,
          businessId: existing.businessId,
          branchId: existing.branchId,
        },
        business: existing.business,
        branch: existing.branch,
        isNewUser: false,
      }, 'Sesión iniciada');
    }

    // No existe — primer login OAuth. Crear Business + Branch + User.
    const fullName =
      (authUser.user_metadata?.['full_name'] as string | undefined) ||
      (authUser.user_metadata?.['name'] as string | undefined) ||
      email.split('@')[0];
    // Usamos el nombre del user como nombre temporal del business — lo
    // editará en el wizard de onboarding después.
    const businessName = `Pastelería de ${fullName.split(' ')[0]}`;

    const result = await prisma.$transaction(async (tx) => {
      const trialEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      const business = await tx.business.create({
        data: { name: businessName, taxRate: 18, trialEndsAt },
      });
      const branch = await tx.branch.create({
        data: { businessId: business.id, name: 'Sucursal Principal', isActive: true },
      });
      const user = await tx.user.create({
        data: {
          id: authUser.id, // mismo id que en Supabase Auth
          email,
          fullName,
          role: 'OWNER',
          businessId: business.id,
          branchId: null,
          isActive: true,
        },
      });
      return { business, branch, user };
    });

    return ok(res, {
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
      isNewUser: true,
    }, 'Cuenta creada vía Google');
  } catch (e) {
    console.error('[auth/oauth-bootstrap]', e);
    return serverError(res);
  }
});

// ─── Reset password con Supabase Auth ─────────────────────────────────────────
// Usa el flujo built-in de Supabase: el user pone email → Supabase manda un
// email con link de recovery → user clickea → frontend recibe el token en el
// fragment de URL → llama a supabase.auth.updateUser({ password }) directamente.
// Ventaja vs. codigo custom: Supabase manda los emails con su SMTP (gratis,
// sin limite de destinatarios), no requiere Resend ni dominio verificado.

const forgotSchema = z.object({
  email: z.string().email('Email inválido'),
});

// POST /api/auth/forgot-password — Supabase manda el email con link
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const parsed = forgotSchema.safeParse(req.body);
    if (!parsed.success) return badRequest(res, parsed.error.errors[0].message);
    const email = parsed.data.email.toLowerCase().trim();

    // URL del frontend donde el user aterrizará al clickear el link. Supabase
    // pone el access_token en el fragment (#access_token=...).
    const frontendUrl = process.env.FRONTEND_URL || 'https://genimatech.vercel.app';
    const redirectTo = `${frontendUrl}/auth/reset-password`;

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    // No leakeamos si el email existe — siempre respondemos OK.
    if (error) {
      console.error('[forgot-password] Supabase error:', error.message);
    }

    return ok(
      res,
      { email },
      'Si el correo está registrado, te enviamos un link para restablecer tu contraseña. Revisa tu bandeja.'
    );
  } catch (e) {
    console.error('[auth/forgot-password]', e);
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
