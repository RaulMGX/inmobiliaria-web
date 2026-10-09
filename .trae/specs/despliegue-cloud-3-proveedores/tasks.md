# Plan de Implementación: Despliegue CRM 3 Proveedores

> Artefacto asociado: [spec.md](./spec.md)
> Mapa 1:1 AC ↔ Tasks: ver la última sección "Coverage Matrix"

---

## Tareas (orden de dependencia)

## Task 1 — Ajustar backend NestJS para Render + CORS seguro
- **Prioridad**: `high`
- **Depende de**: ninguno
- **Files touched**: `backend/src/main.ts`, `backend/package.json`, `backend/.env.example`

### Resumen de cambios
1. `src/main.ts`: `app.listen(port, '0.0.0.0')` para que Render conecte el healthcheck. Sustituir CORS bloqueante `!isNodeEnvDev → Error()` por una lista de origenes permitidos desde `process.env.CORS_ALLOWED_ORIGINS` (split por coma). Regex opcional `*.vercel.app` + `*.onrender.com`.
2. `package.json`: Agregar scripts:
   - `"postinstall": "prisma generate"` para que Prisma cree el cliente después de `npm ci` en Render.
   - `"build:render": "prisma migrate deploy && nest build"` comando de build para Render (puede ser también un prebuild o correr el migrate en el pre-deploy hook).
3. `backend/.env.example`: Añadir `CORS_ALLOWED_ORIGINS=` como placeholder (no poner urls reales, usuario lo pega en Render Secrets).

### Requisitos de prueba locales (TR)
```
TR T1a (rule) cd backend && npm run build:render corriendo contra local dev db: prisma migrate deploy exit 0 + nest build exit 0
TR T1b (rule) Levantar backend local en 0.0.0.0:3000, curl desde otra máquina virtual / WSL a 127.0.0.1:3000 retorna 200
TR T1c (rule) POST login desde origen "https://foo.vercel.app" con CORS_ALLOWED_ORIGINS="https://foo.vercel.app" retorna 200 con ACAO header.
```

### Status: pending
### Completion Evidence: tsc + smoke CORS + curl 0.0.0.0

---

## Task 2 — Ajustar frontend Next.js para Vercel (API URL + rewrites)
- **Prioridad**: `high`
- **Depende de**: Task 1 (por AC CORS cross)
- **Files touched**: `frontend/next.config.js`, `frontend/.env.example` (crear si no), `frontend/package.json`

### Resumen de cambios
1. `next.config.js`: mantener rewrites `/api/*` a `${NEXT_PUBLIC_API_BASE_URL}/:path*` (ya lo hace). Confirmar que `trailingSlash` no rompe endpoints del backend (sin trailing slash).
2. `frontend/.env.example` (archivo NUEVO):
   ```
   NEXT_PUBLIC_API_BASE_URL=https://TU-SERVICIO-RENDER.onrender.com/api/v1
   ```
3. `package.json`: asegurarse que `"build"` script existe `next build` (ya lo tiene, OK). Verificar `"engines": { "node": ">=20" }` si Render/Vercel lo piden — Next 16 necesita Node 20.17+.

### Requisitos de prueba locales (TR)
```
TR T2a (rule) cd frontend && npm run build exit 0 (validar TS + SCSS)
TR T2b (rule) `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api/v1 npm run dev` y fetch('/api/auth/login') en console retorna 400 missing params (rewrite funciona).
```

### Status: pending
### Completion Evidence: next build exit 0

---

## Task 3 — Crear archivos declarativos deploy (render.yaml, vercel.json, .env.example raíz)
- **Prioridad**: `high`
- **Depende de**: Tasks 1 y 2
- **Files touched**: (NUEVOS) `render.yaml` RAIZ, `vercel.json` RAIZ, `.env.production.example` RAIZ

### Resumen
1. `render.yaml` (RAIZ del repo, Render Blueprints detecta este archivo):
   - Root directory: `backend/`
   - BuildCommand: `npm install && npx prisma generate && npx prisma migrate deploy && npm run build`
   - StartCommand: `node dist/main.js`
   - HealthCheckPath: `/api/v1` (o `/health` si hay — sino `/` en express, Nest retorna 404 o se usa `@Get()` en el AppController — verificar si hay un endpoint base. Si no, crear un endpoint `/api/v1/health` simple retornando status)
   - Env vars planas (Render les pone secrets posteriormente):
     - `NODE_ENV=production`
     - `PORT=10000` (Render default para Web Services)
     - `DATABASE_URL` (placeholder, usuario lo pega desde Supabase connection string)
     - `JWT_SECRET` (placeholder, usuario genera UUID v4)
     - `CORS_ALLOWED_ORIGINS=https://VERCEL-NAME.vercel.app`

2. `vercel.json` (RAIZ, Vercel detecta este archivo):
   ```
   {
     "rootDirectory": "frontend",
     "framework": "nextjs",
     "buildCommand": "npm run build",
     "installCommand": "npm install",
     "regions": ["iad1"]
   }
   ```
   (O alternativa: dejar Vercel inferir Next.js 16 automáticamente, pero `rootDirectory` evita error con el monorepo).

3. `.env.production.example` (RAIZ, NO secrets — solo placeholders con comentarios de dónde obtener cada valor):
   - Supabase DATABASE_URL (Supabase → Project Settings → Database → Connection string "Node.js")
   - JWT_SECRET (openssl rand -base64 32)
   - NEXT_PUBLIC_API_BASE_URL (la URL que Render da al crear el Web Service + `/api/v1`)
   - CORS_ALLOWED_ORIGINS (la URL que Vercel da al crear el proyecto)

### Requisitos de prueba locales (TR)
```
TR T3a (rule) Render Blueprint validator: `render.yaml` valido sintácticamente (yaml lint OK)
TR T3b (rule) vercel.json valido (vercel validate CLI si existe, de forma nativa el json schema de next.config.js)
```

### Status: pending
### Completion Evidence: files creados, yaml/json parse ok

---

## Task 4 — Agregar endpoint `/api/v1/health` para Render Health Check
- **Prioridad**: `medium` (bloquea render.yaml healthcheckPath; Render pide 200 en el path cada 10s)
- **Depende de**: Task 1
- **Files touched**: `backend/src/app.module.ts` (controller ya existente o crear), `backend/src/health.controller.ts`

### Resumen
NestJS: crear un controller minimal `@Public()` (no requiere JWT) `HealthController` con `@Get('/health')` que retorna `{ status: 'ok', timestamp: Date.now() }`. Asegurar que CORS lo acepte sin origin (healthcheck de Render no envía origin).

### TRs
```
TR T4a (rule) GET http://localhost:3000/api/v1/health retorna 200 {"status":"ok"}
TR T4b (rule) OPTIONS /api/v1/health retorna 204 (CORS preflight bypass por ruta publica)
```

### Status: pending

---

## Task 5 — Instrucciones Supabase (dump local → Supabase)
- **Prioridad**: `medium`
- **Depende de**: Tasks 1-4
- **Files touched**: (Documentación interna, NO archivos nuevos — solo lo anotamos en el completion evidence del spec; no creamos README a menos que usuario pida)

### Resumen pasos para usuario (NO código):
1. Supabase dashboard → New project → elegir region, generar contraseña DB. Esperar que el cluster esté listo (~2 min).
2. Copiar `Connection string` → Project settings → Database → URI (postgresql://postgres:[pass]@db.xxx.supabase.co:5432/postgres?schema=public). OPCIÓN MEJOR: usar el **pooler mode session** si Render tiene cold starts y hay muchas conexiones, pero por defecto URI directa sirve.
3. Ir a SQL Editor Supabase → correr `CREATE EXTENSION IF NOT EXISTS pgcrypto;` (prisma requiere uuid a veces, es buena práctica).
4. Opción A (solo schema + seed demo): `cd backend && DATABASE_URL="<copiada>" npx prisma migrate deploy` → crea todas las tablas, luego correr `node scripts/seed-admin-pg.cjs && node scripts/seed-asesor-demo.cjs` modificando la conexión a supabase (los seeds leen el `.env` del backend; usuario puede crear temporalmente un `.env` local con DATABASE_URL de supabase).
5. Opción B (datos reales locales): `pg_dump -d "postgresql://postgres:postgres@localhost:5432/cmr_antony?schema=public" -F c -f ./cmr_antony_local.dump` → luego `pg_restore --no-owner --clean --if-exists -d "<SUPABASE URI>" ./cmr_antony_local.dump`

### TRs
```
TR T5a (rule) Después de correr migrate deploy contra Supabase: Supabase Table Editor muestra 15+ tablas.
```

### Status: pending

---

## Coverage Matrix (AC ↔ Tasks + TRs)

| AC | Task(s) que la cubren | TR que la demuestra |
|---|---|---|
| AC-1 GET /api/v1 200 | T1 + T4 | TR T4a |
| AC-2 login admin 200 en Render | T1 | Smoke endpoint con curl + JWT real |
| AC-3 pipeline?page=1&limit=10 200 | T1 | Smoke notificaciones/pipeline (backend intacto ya fix Prisma) |
| AC-4 Dashboard vercel 200s | T2 + T1 (CORS) | Browser DevTools network |
| AC-5 Sidebar asesor no ve Propiedades | T2 (build typescript same code) | Screenshot |
| AC-6 Drag-drop guarda en Supabase | T1 + T5 | Manual test Vercel |
| AC-7 Render logs prisma ok | T1 + T3 | Render Build logs screenshot |
| AC-8 Vercel build Ready | T2 + T3 | Vercel Deployments Ready |
| AC-9 OPTIONS CORS 204 → origin vercel | T1 | Chrome DevTools preflight |
| AC-10 Supabase tables visibles | T5 | TR T5a |
