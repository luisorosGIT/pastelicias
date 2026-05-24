# 🚀 Deploy a Vercel — Guía paso a paso

Estructura: **2 proyectos Vercel desde el mismo repositorio Git**, uno para
el frontend Angular y otro para el backend Express serverless. La DB Postgres
sigue en Supabase (São Paulo) sin cambios.

---

## 1. Subir el código a GitHub

Vercel necesita conectarse a un repo Git. Si aún no lo tienes:

```bash
cd "C:/Users/Luis/Documents/EspacioProyectosClaude/Proyecto 1/Pastelicias"

# Inicializar si nunca lo hiciste
git init
git add .
git commit -m "Initial commit — Pastelicias SaaS listo para deploy"

# Crear repo en GitHub (privado o público, da igual)
# Después conectar:
git remote add origin https://github.com/TU_USUARIO/pastelicias.git
git branch -M main
git push -u origin main
```

⚠️ **Asegúrate de tener un `.gitignore`** que excluya `node_modules/`, `.env`,
`.env.local`, y `dist/`. Ya está incluido si Angular/Node lo generaron, pero
verifícalo.

---

## 2. Crear el proyecto del FRONTEND en Vercel

1. Entra a https://vercel.com → **Add New → Project**
2. Importa el repo `pastelicias` de GitHub
3. En **Configure Project**:
   - **Project Name**: `pastelicias` (o lo que quieras — esto es el subdominio)
   - **Framework Preset**: Angular (lo detecta solo)
   - **Root Directory**: `frontend` ← **importante**
   - **Build Command**: (deja el default `npm run build`)
   - **Output Directory**: `dist/pastelicias/browser` ← **importante**
4. Aún NO presiones Deploy. Primero configura **Environment Variables**:

| Variable | Valor |
|---|---|
| (ninguna por ahora — el frontend lee la URL del API de `environment.prod.ts`) | |

5. **Deploy**. Espera 1-2 min. Te dará la URL `https://pastelicias.vercel.app`
   (o como hayas nombrado el proyecto).

---

## 3. Crear el proyecto del BACKEND en Vercel

1. Vuelve a https://vercel.com → **Add New → Project**
2. Importa **el mismo repo** `pastelicias` otra vez (sí, Vercel permite múltiples
   proyectos desde el mismo repo con diferente Root Directory)
3. En **Configure Project**:
   - **Project Name**: `pastelicias-api` (o como quieras)
   - **Framework Preset**: Other (no lo cambies)
   - **Root Directory**: `backend` ← **importante**
   - **Build Command**: (deja vacío — Vercel detecta `api/index.ts` automáticamente)
   - **Output Directory**: (deja vacío)
4. **Environment Variables** — pega TODOS los siguientes (puedes copiarlos de tu `.env` local):

| Variable | Valor (copia de `backend/.env`) |
|---|---|
| `DATABASE_URL` | tu connection string con `?pgbouncer=true&connection_limit=15&pool_timeout=20&statement_cache_size=0` |
| `DIRECT_URL` | misma URL pero **sin** los query params |
| `SUPABASE_URL` | `https://exbnirmdxuvxqnqdnjas.supabase.co` |
| `SUPABASE_ANON_KEY` | el JWT con `"role":"anon"` |
| `SUPABASE_SERVICE_ROLE_KEY` | el JWT con `"role":"service_role"` |
| `JWT_SECRET` | el del `.env` |
| `NODE_ENV` | `production` |
| `FRONTEND_URL` | la URL del proyecto frontend de paso 2 (ej. `https://pastelicias.vercel.app`) |
| `SENTRY_DSN` | (opcional, déjalo vacío por ahora) |

5. **Deploy**. Espera 1-2 min. Te dará la URL `https://pastelicias-api.vercel.app`.

---

## 4. Conectar el frontend al backend

Edita `frontend/src/environments/environment.prod.ts` con la URL del backend deployado:

```typescript
export const environment = {
  production: true,
  apiUrl: 'https://pastelicias-api.vercel.app/api', // ← URL del paso 3
  supabaseUrl: 'https://exbnirmdxuvxqnqdnjas.supabase.co',
  supabaseAnonKey: 'eyJhbGc...', // tu anon key real
  sentryDsn: '',
};
```

Commitea el cambio y push:

```bash
git add frontend/src/environments/environment.prod.ts
git commit -m "deploy: conectar frontend a backend en Vercel"
git push
```

Vercel **redespliega automáticamente** ambos proyectos al detectar el push.

---

## 5. Probar el deploy

1. Abre `https://pastelicias.vercel.app` → deberías ver la landing pública
2. Clic en "Crear cuenta gratis" → llena el form
3. Si todo funcionó, llegas al wizard de onboarding
4. Si algo falla → ve a Vercel dashboard → tu proyecto → **Logs** para ver errores

---

## 6. Configurar dominio personalizado (opcional, después)

Cuando tengas un dominio:

1. En Vercel dashboard → proyecto frontend → **Settings → Domains**
2. Agrega `pastelicias.com` (o tu dominio)
3. Vercel te dice qué registros DNS configurar en tu registrador (Cloudflare/Namecheap/etc.)
4. Actualiza `FRONTEND_URL` en el backend para que apunte al nuevo dominio

---

## 🐛 Troubleshooting común

### "Database connection failed" en producción
- Verifica que `DATABASE_URL` esté seteado en Vercel
- Confirma que tiene `?pgbouncer=true` al final
- Verifica que Supabase no esté pausado (free tier pausa proyectos inactivos)

### CORS error en producción
- `FRONTEND_URL` en backend Vercel debe ser EXACTO al dominio frontend
- Si cambias de dominio, actualiza esto

### "Function exceeded maximum duration"
- Algún query tarda >30s. Revisa los logs de Vercel
- Posible: query a Supabase sin `pgbouncer=true` (vuelve queries lentas en serverless)

### Cold starts molestos
- Es normal: ~500-1500ms el primer request después de inactividad
- Vercel Pro ($20/mes) reduce cold starts con "fluid compute"
- Alternativa gratis: cron-job.org pingueando `/health` cada 5 min

---

## 💰 Costos estimados mensuales

| Servicio | Plan | Costo |
|---|---|---|
| Vercel frontend | Hobby | $0 |
| Vercel backend | Hobby | $0 (100GB-hours/mes incluidos) |
| Supabase DB | Free | $0 (hasta 500MB DB, 50K usuarios activos/mes) |
| Dominio | (opcional) | ~$12/año |

**Total**: $0/mes hasta que crezcas mucho. En ese momento, ~$50/mes total (Vercel Pro + Supabase Pro).
