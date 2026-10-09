# CMR Antony Backend

Base inicial profesional del backend del CRM Inmobiliario `CMR Antony`, construida con `NestJS` y `TypeScript`.

## Objetivo de esta fase

Esta version deja preparado el proyecto para:

- Arquitectura modular y escalable.
- Configuracion centralizada por variables de entorno.
- Validacion global de entrada.
- Documentacion base con Swagger deshabilitada por defecto.
- Preparacion para `Prisma ORM` y `PostgreSQL`.

No incluye aun:

- Modulos funcionales.
- Autenticacion.
- Modelos de Prisma.
- Migraciones.
- Controladores de negocio.

## Scripts disponibles

```bash
npm run start
npm run start:dev
npm run build
npm run lint
npm run lint:fix
npm run test
npm run test:e2e
npm run typecheck
```

## Variables de entorno

Usa `/.env.example` como referencia para crear el archivo `/.env.local` o `/.env`.

Variables base:

- `APP_NAME`
- `NODE_ENV`
- `PORT`
- `API_PREFIX`
- `SWAGGER_ENABLED`
- `SWAGGER_PATH`
- `DATABASE_URL`

Notas:

- `SWAGGER_ENABLED` viene en `false` por seguridad.
- `DATABASE_URL` queda reservada para la fase de configuracion real de base de datos.

## Estructura inicial

```text
src/
  common/
  config/
  infrastructure/
  modules/
prisma/
```

## Convencion Prisma

La carpeta `prisma/` queda reservada para `schema.prisma` y futuras migraciones.
La carpeta `src/infrastructure/database/prisma/` queda reservada para servicios, adaptadores o repositorios tecnicos relacionados con Prisma dentro de NestJS.

## Siguiente fase

La configuracion detallada de `PostgreSQL` y `Prisma` se realiza en pasos posteriores del proyecto.
