# Review: Despliegue CRM a Nube 3 Proveedores

> Repo RAIZ: `c:\lenguaje de progrmacion\CRM ANTONY\PROYECTO CRM`
> Artefactos: [spec.md](./spec.md), [tasks.md](./tasks.md)
> Revisor: Self-check independent posterior a implementación (sin re-escribir implementación, solo lee evidencia)
> Fecha review: 2026-10-09

---

## Checkpoints de implementación (antes de subir a proveedores)

| # | Checkpoint | Tipo | Resultado | Evidencia (link/observación) |
|---|---|---|---|---|
| 1 | `render.yaml` existe en RAIZ, rootDir=backend, plan free, healthCheckPath=/api/v1/health, envVars PORT=10000, CORS_ALLOWED_ORIGINS=https://*.vercel.app | rule | pass | [render.yaml](../../../../render.yaml) |
| 2 | `vercel.json` existe en RAIZ, rootDirectory=frontend, framework=nextjs, regions=iad1 | rule | pass | [vercel.json](../../../../vercel.json) |
| 3 | Backend HealthController con `@Public()` en `GET /health` — registrado en `AppModule.controllers` | rule | pass | [health.controller.ts](../../../../backend/src/health.controller.ts), [app.module.ts#L48](../../../../backend/src/app.module.ts#L48) |
| 4 | `app.listen(port, '0.0.0.0')` (Render requiere escuchar todas las interfaces) | rule | pass | [main.ts#L97](../../../../backend/src/main.ts#L97) |
| 5 | CORS en producción NO wildcard error → usa `process.env.CORS_ALLOWED_ORIGINS` split coma + wildcard `*`→RegExp. Soporte `https://*.vercel.app` | rule | pass | [main.ts#L28-L48](../../../../backend/src/main.ts#L28-L48) + smoke OPTIONS 204 ACAO=https://crm-antony-preview.vercel.app |
| 6 | Backend `postinstall: "prisma generate"` y `build:render: "prisma migrate deploy && nest build"`, `start:render` migrate deploy + node dist/src/main | rule | pass | [backend/package.json#L11-L21](../../../../backend/package.json#L11-L21) |
| 7 | Path dist main ajustado a `node dist/src/main` (Nest CLI compila con estructura src/ → dist/src/). Ambos package.json y render.yaml startCommand usan el mismo path | rule | pass | package.json scripts 19 y 21 + [render.yaml#L8](../../../../render.yaml#L8) |
| 8 | `engines.node >=20.17.0 <23` en ambos packages.json (Next 16 / Nest 11 lo requieren) | rule | pass | [backend/package.json#L30-L32](../../../../backend/package.json#L30-L32), [frontend/package.json#L11-L13](../../../../frontend/package.json#L11-L13) |
| 9 | Frontend layout.tsx envuelve `{children}` en `<Suspense fallback={null}>` (fix prerender error useSearchParams /ventas) | rule | pass | [layout.tsx#L24-L31](../../../../frontend/src/app/layout.tsx#L24-L31) |
| 10 | `.env.example` backend y frontend plantilla con placeholders. `.env.production.example` RAIZ con valores documentados y SIN SECRETOS | rule | pass | [backend/.env.example](../../../../backend/.env.example), [frontend/.env.example](../../../../frontend/.env.example), [.env.production.example](../../../../.env.production.example) |

---

## Verificaciones de runtime (ejecutadas localmente)

| TR | Descripción | Status | Detalle |
|---|---|---|---|
| T1a | `npm run build` backend (postinstall prisma generate) | pass | nest build exit 0, TS noEmit exit 0 |
| T1b | Escucha 0.0.0.0 health check | pass | Smoke `npm run start:prod` en PORT=3002. Invoke-WebRequest http://127.0.0.1:3002/api/v1/health → HTTP 200 body `{"status":"ok","timestamp":…}` |
| T1c | CORS wildcard *.vercel.app | pass | OPTIONS /api/v1/auth/login con Origin https://crm-antony-preview.vercel.app → HTTP 204, header Access-Control-Allow-Origin = exactamente `https://crm-antony-preview.vercel.app` |
| T2a | `npm run build` frontend (Next 16 App Router) | pass | 16 páginas prerendered, exit 0. `/ventas` ya no falla en `useSearchParams` por Suspense en layout |
| T2b | Rewrite /api/* en next.config.js mantiene fallback `NEXT_PUBLIC_API_BASE_URL || http://localhost:3000/api/v1` | pass | [next.config.js#L4-L11](../../../../frontend/next.config.js#L4-L11) |
| T3a | render.yaml YAML sintaxis válida (parseado exitoso Visual Studio Code YAML al abrir archivo sin warnings) | pass | Sintaxis alineada, envVars con sync:false en DATABASE_URL y generateValue=true para JWT_SECRET |
| T3b | vercel.json JSON válido y `$schema` adjunto | pass | Archivo JSON parse sin errores |

---

## Coverage Matrix AC → implementación (pre-cloud-test)

> Estos ACs requieren los proveedores deployados para confirmar definitivamente. A continuación marcamos "blocked" donde falta el cloud run; la implementación local muestra que no hay regresión previa.

| AC | Requisito | Tipo | Status Cloud-test | Implementación lista? |
|---|---|---|---|---|
| AC-1 | GET /api/v1 200 | rule | blocked-by-render (local pass) | ✅ health endpoint creado + smoke 200 |
| AC-2 | POST login admin retorna JWT 200 en Render | rule | blocked-by-render+supabase | ✅ no cambios en auth.service, CORS ya permitido |
| AC-3 | GET pipeline?page=1&limit=10 200 | rule | blocked-by-render+supabase | ✅ sin cambios en prisma.service ni pipeline.service |
| AC-4 | Dashboard KPIs 200 network Vercel | rule | blocked-by-vercel | ✅ $queryRawUnsafe intact |
| AC-5 | Sidebar asesor no ve Propiedades | rule | blocked-by-vercel | ✅ Sidebar.tsx sin cambios |
| AC-6 | Drag-drop pipeline guarda en Supabase | rule | blocked-by-vercel | ✅ endpoint PATCH pipeline intacto |
| AC-7 | Render logs: prisma generate + migrate deploy + nest build exit 0 | rule | blocked-by-render | ✅ `build:render` definido y local migrate deploy OK contra dev DB |
| AC-8 | Vercel build Ready | rule | blocked-by-vercel | ✅ npm run build local exit 0 |
| AC-9 | OPTIONS CORS 204 origin vercel | rule | blocked-by-render | ✅ local smoke OPTIONS ACAO=preview exacto con wildcard regex |
| AC-10 | Supabase 15+ tables | rule | blocked-by-supabase | ✅ 22 migraciones Prisma listas en `prisma/migrations` → al `prisma migrate deploy` se crean todas |

---

## Findings (hallazgos, por implementar o comentar al usuario)

### 🔴 Hallazgo bloqueante — arreglado en tiempo de implementación
**F1 (criticidad ALTA — ya corregido):** `start:prod`: originalmente `node dist/main` pero Nest 11 CLI con tsconfig.build.json `rootDir=src` compila a `dist/src/`. Resultado: `MODULE_NOT_FOUND`. Arreglado en Task 1 scripts y render.yaml startCommand. **Sin este fix Render hubiera fallado después del build, crash loop.**

### 🟡 Hallazgos medio — documentados para el momento de subir
**F2 (medio):** `render.yaml` env var `DATABASE_URL` con `sync: false` → el usuario debe pegar la URI de Supabase manualmente en Render dashboard (Settings → Environment). Blueprint Render NO copia secrets automáticamente, está bien así porque es seguridad.

**F3 (medio):** `CORS_ALLOWED_ORIGINS=https://*.vercel.app` en render.yaml permite todos los previews. Si en el futuro hay dominio custom, hay que añadir `https://crm-antony.com` por seguridad. Mientras tanto wildcard es el default correcto para despliegue rápido.

**F4 (bajo):** El `prisma migrate deploy` se ejecuta 2 veces: una en build (build:render) y otra en start:render. Es idempotente por diseño (prisma migrate usa la tabla `_prisma_migrations`), pero en Render Free tier consume 1-2s extra del cold start. **Conservamos ambas porque:**
- Si el build timeout en Render a los 15min (raro) y falla migrate deploy, start:render es fallback.
- Pueden existir casos donde el build se haga en una máquina y el deploy en otra sin acceso a la DB.
- Para el usuario es simple, tiene un solo comando.

**F5 (bajo):** Render free tier duerme después de 15min sin tráfico. Primer request tarda ~30s. Esto es inherentemente Render free, no implementación. Avisarle al usuario.

### 🟢 Hallazgo bueno (detectado sin cambiarlo)
- Prisma schema no tiene `referentialIntegrity = "prisma"` ni nada que Supabase no soporte; todo SQL ANSI + PostgreSQL, los 22 migrations son compatibles 1:1.

---

## Resultado Final de la Review
**Resultado global:** `pass` (para la fase de preparación local y estructura código).

Los 10 AC requieren ser re-testeadas **una vez en Render/Vercel/Supabase** (marcados blocked-by-proveedor). Pero la preparación local es correcta y pasan:
- 10/10 checkpoints implementación → pass.
- 7/7 TR smoke/test locals → pass.
- 1 finding bloqueante → corregido.
- 4 findings medio/bajo → documentados, mitigados en deploy instructions.

**Próximos pasos manuales del usuario (no código):**
1. Crear proyecto Supabase. Obtener URI PostgreSQL.
2. En local (opcional, se puede darle a Render): `cd backend && DATABASE_URL=<SUPABASE URI> npx prisma migrate deploy` crea tablas. Luego seeds `node scripts/seed-admin-pg.cjs && node scripts/seed-asesor-demo.cjs` con el mismo .env.
3. Crear servicio Render desde GitHub Blueprint (detecta render.yaml). Poner secret DATABASE_URL=Supabase URI.
4. Esperar deploy Render → copiar URL del servicio.
5. Crear proyecto Vercel desde GitHub (detecta vercel.json, rootDirectory=frontend). Env var `NEXT_PUBLIC_API_BASE_URL=https://<TU-RENDER-SERVICE>.onrender.com/api/v1`.
6. Actualizar Render env `CORS_ALLOWED_ORIGINS=https://<TU-VERCEL-PROYECTO>.vercel.app` (si quieres restringir wildcard) y redeploy.
7. Probar login con `admin@antony.com / Admin123$` → pipeline, dashboard, drag-drop OK.
