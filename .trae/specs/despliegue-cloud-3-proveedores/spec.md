# Especificación: Despliegue del CRM Antony a la Nube

## Problema
El CRM Antony actualmente se ejecuta 100% local:
- Base de datos PostgreSQL en `localhost:5432/cmr_antony`
- Backend NestJS 11 en `http://localhost:3000`
- Frontend Next.js 16 en `http://localhost:3001` (con rewrite `/api/*` → localhost:3000)

Objetivo del usuario: **Pasar el sistema a producción en 3 proveedores SaaS**:
1. **Supabase** → Base de datos PostgreSQL (reemplaza pg local)
2. **Render.com** → Backend NestJS 11 con Prisma 7 (servicio Web Service)
3. **Vercel** → Frontend Next.js 16 (App Router)

## Usuarios impactados
- **Administrador Antony** (admin@antony.com): accesos totales, configuración, reportes
- **Asesores comerciales** (ej: asesor@antony.com): pipeline, clientes, visitas, ventas
- **Clientes finales**: no acceden al sistema, solo los asesores trabajan sus leads

## Objetivos Principales (must-have)
1. **Migrar DB** de PostgreSQL local al cluster Postgres de Supabase (conservar schema + datos de seed inicial: admin/asesor + condominios demo)
2. **Publicar backend NestJS en Render.com**, con:
   - Prisma 7 `prisma generate` ejecutado en build
   - Migraciones Prisma (`prisma migrate deploy`) ejecutadas contra la DB de Supabase antes del `node dist/main.js`
   - JWT SECRET, DATABASE_URL, y otros env vars inyectados desde Render Secrets
   - CORS permitiendo SOLO los dominios del frontend de Vercel + localhost para QA
   - Puerto `0.0.0.0:${PORT}` (no `localhost`, Render injecta PORT variable)
3. **Publicar frontend Next.js en Vercel**, con:
   - `NEXT_PUBLIC_API_BASE_URL` apuntando a la URL pública del backend de Render (`https://crm-antony-api.onrender.com/api/v1`)
   - Rewrite `/api/*` funcionando en Vercel (Next.js Vercel rewrites sí soportan destinos externos)
   - Build Next.js exitoso (sass, typescript, bootstrap)
4. **Seguridad**: NO commitear NINGÚN .env con secretos reales. Sólo plantillas `.env.example`.
5. **Mantener desarrollo local intacto** (todo sigue funcionando con localhost al correr `npm run start:dev` y `npm run dev`)

## No-Goals (out of scope esta entrega)
❌ Cambiar proveedores (ej: Neon en vez de Supabase, Railway en vez de Render, Cloudflare Pages en vez de Vercel)
❌ Dockerizar (Render admite monorepo node + build command directo, no necesitamos Dockerfile a menos que falle)
❌ CDN assets / blob storage Supabase (no hay uploads de documentos aún)
❌ Dominio custom (.com / SSL propio) — usar los dominios autogenerados por Render/Vercel/Supabase
❌ Migración continua de datos durante días (sólo una migración inicial para launch)

## Requisitos Funcionales
| ID | Requisito | Proveedor |
|---|---|---|
| R1 | Login admin@antony.com funciona en Vercel (backend render resuelve JWT + consulta DB Supabase) | Vercel ↔ Render ↔ Supabase |
| R2 | Sidebar restringido roles ASESOR (no ve Propiedades/Pagos/Contratos) sigue funcionando en cloud | Vercel |
| R3 | Pipeline Kanban colapsable/compacto + drag drop guarda cambios persistentes en Supabase | Todos |
| R4 | Dashboard KPIs (con SQL $queryRawUnsafe fix Prisma 7 groupBy) retorna mismos valores que local | Render + Supabase |
| R5 | Notificaciones endpoint `GET /empresas/:emp/notificaciones/contar-pendientes` 200 y mismo algoritmo escape SQL | Render |
| R6 | Scripts seed `seed-admin-pg.cjs` + `seed-asesor-demo.cjs` se pueden correr desde local apuntando a la DB de Supabase para poblar la primera vez | Local → Supabase |

## Requisitos No Funcionales
| ID | Requisito |
|---|---|
| NFR1 | Tiempo cold start Render < 15s (Web Service gratuito tiene 50s timeout, build < 8min) |
| NFR2 | Backend responde pings en `GET /api/v1/auth/login` (OPTIONS preflight 204, POST login 401 credenciales malas) |
| NFR3 | Frontend Vercel Lighthouse First Contentful Paint < 2s (Bootstrap 5 es ligero) |
| NFR4 | CORS NO permite wildcard en producción. Sólo origines Vercel explícitos / regex `*.vercel.app` |
| NFR5 | Prisma migrate deploy es **idempotente** — ejecutarlo varias veces en release no rompe schema |
| NFR6 | Build backend en Render corre en la carpeta `backend/` del monorepo (rootDir correcto) |
| NFR7 | Build frontend en Vercel corre en la carpeta `frontend/` del monorepo (Root Directory) |

## Dependencias Externas (el usuario debe tener cuentas)
1. Cuenta Supabase (https://supabase.com) — free tier alcanza
2. Cuenta Render.com (https://render.com) — free tier Web Service + PostgreSQL **pero** usaremos solo PostgreSQL de Supabase, Render solo host Node (evitar la PG duplicada de Render)
3. Cuenta Vercel (https://vercel.com) — free tier Hobby alcanza

## Suposiciones
- El monorepo tiene estructura `backend/` y `frontend/` en la raíz (ya confirmado con LS del workspace)
- El usuario usa GitHub (public o private) y Render/Vercel/Supabase pueden conectarse al repo
- Supabase Pooler/pgbouncer no requerido, conexión directa `postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres` sirve para Render free tier (<10 conexiones concurrentes)
- JWT secret se mantiene igual o genera uno nuevo (no importa mientras sea un UUID largo en Render Secrets)

## Preguntas Abiertas
Q1: ¿Se necesita domininio custom en Vercel/Render o valemos los `.onrender.com` y `.vercel.app` autogenerados? → **Asumimos dominios autogenerados OK (default)**
Q2: ¿La base de datos local tiene datos reales de clientes/asesores o solo los seeds demo? → **Asumimos sólo los seeds demo se pasan (R6), si hubiera datos reales avisar y corremos pg_dump + psql restore sin scripts seeds**

## Criterios de Aceptación
Todos son de tipo `rule` (pasa / no pasa, verificable):
```
AC-1 (rule) GET https://{render-url}/api/v1/ retorna HTTP 200 {"status":"ok","version":"1.0.0"} (o lo que retorna Nest) — evidencia: curl / Postman
AC-2 (rule) POST https://{render-url}/api/v1/auth/login body {email: "admin@antony.com", password: "Admin123$"} retorna 200 { access_token } — evidencia: JSON response
AC-3 (rule) GET https://{render-url}/api/v1/empresas/1/pipeline?page=1&limit=10 con JWT admin retorna 200 lista array (no 500 por Prisma groupBy) — evidencia: status 200
AC-4 (rule) Navegando a la URL Vercel → login con admin@antony.com → Dashboard carga KPIs sin console errors 4xx/5xx — evidencia: Chrome DevTools network 200s
AC-5 (rule) Sidebar rol ASESOR (asesor@antony.com / Asesor123$) en Vercel NO muestra la entrada "Propiedades" — evidencia: screenshot sidebar
AC-6 (rule) Pipeline kanban en Vercel: arrastrar tarjeta "Notif Smoke Seguimiento" de NUEVO → CONTACTADO guarda y al recargar la etapa es CONTACTADO — evidencia: refresh muestra la card en la columna correcta
AC-7 (rule) Build de Render en logs muestra `$ prisma generate` + `$ prisma migrate deploy` + `$ nest build` todos exit 0 — evidencia: snapshot build logs
AC-8 (rule) Build de Vercel muestra `build` success y output deploy listo — evidencia: Vercel deployments list Status Ready
AC-9 (rule) CORS: desde consola Chrome en Vercel, `fetch('{render-url}/api/v1/auth/login', {method:'OPTIONS'})` retorna status 204 y header access-control-allow-origin=origen vercel — evidencia: DevTools network OPTIONS
AC-10 (rule) Supabase Table Editor muestra las tablas: usuarios, empresas, proyectos, propiedades, clientes, pipelines_comerciales, visitas_propiedades, reservas, ventas, pagos, contratos, comisiones, notificaciones, documentos — evidencia: 15+ tables visibles
```
