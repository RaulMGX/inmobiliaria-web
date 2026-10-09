-- ========================================================
-- CRM ANTONY: Esquema completo 22 migraciones Prisma
-- Ejecutar UNA SOLA VEZ en Supabase SQL Editor
-- ========================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

SET statement_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- === Migracion: 20260802234812_create_security_module_base ===
-- CreateTable
CREATE TABLE "empresas" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "ruc" VARCHAR(20) NOT NULL,
    "telefono" VARCHAR(30),
    "correo" VARCHAR(120),
    "direccion" VARCHAR(255),
    "logo" VARCHAR(255),
    "color_primario" VARCHAR(20),
    "color_secundario" VARCHAR(20),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "empresas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "descripcion" VARCHAR(255),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "empresa_id" TEXT NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombres" VARCHAR(100) NOT NULL,
    "apellidos" VARCHAR(100) NOT NULL,
    "correo" VARCHAR(120) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "telefono" VARCHAR(30),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "rol_id" TEXT NOT NULL,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "empresas_ruc_key" ON "empresas"("ruc");

-- CreateIndex
CREATE INDEX "empresas_active_idx" ON "empresas"("active");

-- CreateIndex
CREATE INDEX "roles_empresa_id_idx" ON "roles"("empresa_id");

-- CreateIndex
CREATE INDEX "roles_active_idx" ON "roles"("active");

-- CreateIndex
CREATE UNIQUE INDEX "roles_empresa_id_nombre_key" ON "roles"("empresa_id", "nombre");

-- CreateIndex
CREATE INDEX "usuarios_empresa_id_idx" ON "usuarios"("empresa_id");

-- CreateIndex
CREATE INDEX "usuarios_rol_id_idx" ON "usuarios"("rol_id");

-- CreateIndex
CREATE INDEX "usuarios_active_idx" ON "usuarios"("active");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_empresa_id_correo_key" ON "usuarios"("empresa_id", "correo");

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_rol_id_fkey" FOREIGN KEY ("rol_id") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- === Migracion: 20260802235423_add_soft_delete_and_projects_module ===
-- CreateEnum
CREATE TYPE "TipoProyecto" AS ENUM ('CASAS', 'DEPARTAMENTOS');

-- CreateEnum
CREATE TYPE "EstadoProyecto" AS ENUM ('ACTIVO', 'FINALIZADO', 'PAUSADO');

-- AlterTable
ALTER TABLE "empresas" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "roles" ADD COLUMN     "deleted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "usuarios" ADD COLUMN     "avatar" VARCHAR(255),
ADD COLUMN     "deleted_at" TIMESTAMP(3),
ADD COLUMN     "last_login" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "proyectos" (
    "id" TEXT NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "descripcion" VARCHAR(500),
    "tipo_proyecto" "TipoProyecto" NOT NULL,
    "estado" "EstadoProyecto" NOT NULL DEFAULT 'ACTIVO',
    "fecha_inicio" DATE,
    "fecha_fin" DATE,
    "direccion" VARCHAR(255),
    "distrito" VARCHAR(100),
    "ciudad" VARCHAR(100),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "empresa_id" TEXT NOT NULL,

    CONSTRAINT "proyectos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proyectos_empresa_id_idx" ON "proyectos"("empresa_id");

-- CreateIndex
CREATE INDEX "proyectos_estado_idx" ON "proyectos"("estado");

-- CreateIndex
CREATE INDEX "proyectos_active_idx" ON "proyectos"("active");

-- CreateIndex
CREATE INDEX "proyectos_deleted_at_idx" ON "proyectos"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "proyectos_empresa_id_nombre_key" ON "proyectos"("empresa_id", "nombre");

-- CreateIndex
CREATE INDEX "empresas_deleted_at_idx" ON "empresas"("deleted_at");

-- CreateIndex
CREATE INDEX "roles_deleted_at_idx" ON "roles"("deleted_at");

-- CreateIndex
CREATE INDEX "usuarios_deleted_at_idx" ON "usuarios"("deleted_at");

-- CreateIndex
CREATE INDEX "usuarios_last_login_idx" ON "usuarios"("last_login");

-- AddForeignKey
ALTER TABLE "proyectos" ADD CONSTRAINT "proyectos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- === Migracion: 20260803000416_add_properties_module_base ===
-- CreateEnum
CREATE TYPE "TipoPropiedad" AS ENUM ('CASA', 'DEPARTAMENTO', 'TERRENO', 'LOCAL', 'OFICINA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoPropiedad" AS ENUM ('DISPONIBLE', 'RESERVADO', 'VENDIDO', 'SEPARADO');

-- CreateTable
CREATE TABLE "propiedades" (
    "id" TEXT NOT NULL,
    "codigo_interno" VARCHAR(50) NOT NULL,
    "nombre" VARCHAR(150) NOT NULL,
    "tipo_propiedad" "TipoPropiedad" NOT NULL,
    "estado" "EstadoPropiedad" NOT NULL DEFAULT 'DISPONIBLE',
    "precio" DECIMAL(14,2) NOT NULL,
    "area_total" DECIMAL(10,2),
    "area_construida" DECIMAL(10,2),
    "habitaciones" INTEGER,
    "banos" INTEGER,
    "estacionamientos" INTEGER,
    "piso" INTEGER,
    "direccion" VARCHAR(255),
    "distrito" VARCHAR(100),
    "ciudad" VARCHAR(100),
    "latitud" DECIMAL(10,8),
    "longitud" DECIMAL(11,8),
    "descripcion" VARCHAR(1000),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "proyecto_id" TEXT NOT NULL,

    CONSTRAINT "propiedades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "propiedades_codigo_interno_key" ON "propiedades"("codigo_interno");

-- CreateIndex
CREATE INDEX "propiedades_proyecto_id_idx" ON "propiedades"("proyecto_id");

-- CreateIndex
CREATE INDEX "propiedades_estado_idx" ON "propiedades"("estado");

-- CreateIndex
CREATE INDEX "propiedades_active_idx" ON "propiedades"("active");

-- CreateIndex
CREATE INDEX "propiedades_deleted_at_idx" ON "propiedades"("deleted_at");

-- AddForeignKey
ALTER TABLE "propiedades" ADD CONSTRAINT "propiedades_proyecto_id_fkey" FOREIGN KEY ("proyecto_id") REFERENCES "proyectos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- === Migracion: 20260803001451_add_clients_module_base ===
-- CreateEnum
CREATE TYPE "TipoDocumentoCliente" AS ENUM ('DNI', 'CE', 'PASAPORTE', 'RUC', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoCivilCliente" AS ENUM ('SOLTERO', 'CASADO', 'CONVIVIENTE', 'DIVORCIADO', 'VIUDO', 'OTRO');

-- CreateEnum
CREATE TYPE "MonedaCliente" AS ENUM ('PEN', 'USD');

-- CreateEnum
CREATE TYPE "MedioCaptacionCliente" AS ENUM ('FACEBOOK', 'INSTAGRAM', 'TIKTOK', 'WHATSAPP', 'REFERIDO', 'WEB', 'LLAMADA', 'OTRO');

-- CreateEnum
CREATE TYPE "EstadoCliente" AS ENUM ('NUEVO', 'CONTACTADO', 'INTERESADO', 'EN_SEGUIMIENTO', 'CALIFICADO', 'NO_INTERESADO', 'CLIENTE');

-- CreateTable
CREATE TABLE "clientes" (
    "id" TEXT NOT NULL,
    "nombres" VARCHAR(100) NOT NULL,
    "apellidos" VARCHAR(100) NOT NULL,
    "tipo_documento" "TipoDocumentoCliente",
    "numero_documento" VARCHAR(30),
    "celular" VARCHAR(30) NOT NULL,
    "telefono" VARCHAR(30),
    "correo" VARCHAR(120),
    "fecha_nacimiento" DATE,
    "estado_civil" "EstadoCivilCliente",
    "ocupacion" VARCHAR(100),
    "empresa_donde_trabaja" VARCHAR(150),
    "distrito" VARCHAR(100),
    "ciudad" VARCHAR(100),
    "direccion" VARCHAR(255),
    "presupuesto_minimo" DECIMAL(14,2),
    "presupuesto_maximo" DECIMAL(14,2),
    "moneda" "MonedaCliente",
    "medio_captacion" "MedioCaptacionCliente" NOT NULL,
    "estado" "EstadoCliente" NOT NULL DEFAULT 'NUEVO',
    "observaciones" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "empresa_id" TEXT NOT NULL,

    CONSTRAINT "clientes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "clientes_empresa_id_idx" ON "clientes"("empresa_id");

-- CreateIndex
CREATE INDEX "clientes_estado_idx" ON "clientes"("estado");

-- CreateIndex
CREATE INDEX "clientes_active_idx" ON "clientes"("active");

-- CreateIndex
CREATE INDEX "clientes_deleted_at_idx" ON "clientes"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "clientes_empresa_id_tipo_documento_numero_documento_key" ON "clientes"("empresa_id", "tipo_documento", "numero_documento");

-- AddForeignKey
ALTER TABLE "clientes" ADD CONSTRAINT "clientes_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- === Migracion: 20260803002017_add_commercial_pipeline_module ===
-- CreateEnum
CREATE TYPE "EtapaPipelineComercial" AS ENUM ('NUEVO', 'CONTACTADO', 'INTERESADO', 'VISITA_PROGRAMADA', 'NEGOCIACION', 'SEPARACION', 'VENTA_GANADA', 'VENTA_PERDIDA');

-- CreateEnum
CREATE TYPE "PrioridadPipelineComercial" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- CreateTable
CREATE TABLE "pipelines_comerciales" (
    "id" TEXT NOT NULL,
    "etapa" "EtapaPipelineComercial" NOT NULL DEFAULT 'NUEVO',
    "fecha_ingreso" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_ultimo_seguimiento" TIMESTAMP(3),
    "proxima_fecha_seguimiento" TIMESTAMP(3),
    "prioridad" "PrioridadPipelineComercial" NOT NULL DEFAULT 'MEDIA',
    "probabilidad_cierre" INTEGER NOT NULL DEFAULT 0,
    "motivo_perdida" VARCHAR(255),
    "observaciones" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "asesor_id" TEXT NOT NULL,

    CONSTRAINT "pipelines_comerciales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pipelines_comerciales_empresa_id_idx" ON "pipelines_comerciales"("empresa_id");

-- CreateIndex
CREATE INDEX "pipelines_comerciales_cliente_id_idx" ON "pipelines_comerciales"("cliente_id");

-- CreateIndex
CREATE INDEX "pipelines_comerciales_asesor_id_idx" ON "pipelines_comerciales"("asesor_id");

-- CreateIndex
CREATE INDEX "pipelines_comerciales_etapa_idx" ON "pipelines_comerciales"("etapa");

-- CreateIndex
CREATE INDEX "pipelines_comerciales_prioridad_idx" ON "pipelines_comerciales"("prioridad");

-- CreateIndex
CREATE INDEX "pipelines_comerciales_proxima_fecha_seguimiento_idx" ON "pipelines_comerciales"("proxima_fecha_seguimiento");

-- CreateIndex
CREATE INDEX "pipelines_comerciales_active_idx" ON "pipelines_comerciales"("active");

-- CreateIndex
CREATE INDEX "pipelines_comerciales_deleted_at_idx" ON "pipelines_comerciales"("deleted_at");

-- CreateIndex
CREATE INDEX "pipelines_comerciales_empresa_id_etapa_idx" ON "pipelines_comerciales"("empresa_id", "etapa");

-- CreateIndex
CREATE INDEX "pipelines_comerciales_empresa_id_proxima_fecha_seguimiento_idx" ON "pipelines_comerciales"("empresa_id", "proxima_fecha_seguimiento");

-- AddForeignKey
ALTER TABLE "pipelines_comerciales" ADD CONSTRAINT "pipelines_comerciales_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines_comerciales" ADD CONSTRAINT "pipelines_comerciales_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pipelines_comerciales" ADD CONSTRAINT "pipelines_comerciales_asesor_id_fkey" FOREIGN KEY ("asesor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- === Migracion: 20260803002455_add_agenda_and_follow_ups_module ===
-- CreateEnum
CREATE TYPE "EstadoSeguimiento" AS ENUM ('PENDIENTE', 'EN_PROCESO', 'COMPLETADA', 'CANCELADA');

-- CreateEnum
CREATE TYPE "TipoSeguimiento" AS ENUM ('LLAMADA', 'WHATSAPP', 'CORREO', 'REUNION', 'VISITA', 'OTRO');

-- CreateEnum
CREATE TYPE "PrioridadSeguimiento" AS ENUM ('BAJA', 'MEDIA', 'ALTA');

-- CreateTable
CREATE TABLE "seguimientos_agenda" (
    "id" TEXT NOT NULL,
    "fecha_programada" TIMESTAMP(3) NOT NULL,
    "recordatorio_at" TIMESTAMP(3),
    "prioridad" "PrioridadSeguimiento" NOT NULL DEFAULT 'MEDIA',
    "estado" "EstadoSeguimiento" NOT NULL DEFAULT 'PENDIENTE',
    "tipo" "TipoSeguimiento" NOT NULL,
    "observaciones" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "asesor_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "pipeline_id" TEXT,

    CONSTRAINT "seguimientos_agenda_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "seguimientos_agenda_empresa_id_idx" ON "seguimientos_agenda"("empresa_id");

-- CreateIndex
CREATE INDEX "seguimientos_agenda_asesor_id_idx" ON "seguimientos_agenda"("asesor_id");

-- CreateIndex
CREATE INDEX "seguimientos_agenda_cliente_id_idx" ON "seguimientos_agenda"("cliente_id");

-- CreateIndex
CREATE INDEX "seguimientos_agenda_pipeline_id_idx" ON "seguimientos_agenda"("pipeline_id");

-- CreateIndex
CREATE INDEX "seguimientos_agenda_estado_idx" ON "seguimientos_agenda"("estado");

-- CreateIndex
CREATE INDEX "seguimientos_agenda_tipo_idx" ON "seguimientos_agenda"("tipo");

-- CreateIndex
CREATE INDEX "seguimientos_agenda_fecha_programada_idx" ON "seguimientos_agenda"("fecha_programada");

-- CreateIndex
CREATE INDEX "seguimientos_agenda_recordatorio_at_idx" ON "seguimientos_agenda"("recordatorio_at");

-- CreateIndex
CREATE INDEX "seguimientos_agenda_active_idx" ON "seguimientos_agenda"("active");

-- CreateIndex
CREATE INDEX "seguimientos_agenda_deleted_at_idx" ON "seguimientos_agenda"("deleted_at");

-- CreateIndex
CREATE INDEX "seguimientos_agenda_empresa_id_fecha_programada_idx" ON "seguimientos_agenda"("empresa_id", "fecha_programada");

-- CreateIndex
CREATE INDEX "seguimientos_agenda_asesor_id_estado_fecha_programada_idx" ON "seguimientos_agenda"("asesor_id", "estado", "fecha_programada");

-- AddForeignKey
ALTER TABLE "seguimientos_agenda" ADD CONSTRAINT "seguimientos_agenda_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimientos_agenda" ADD CONSTRAINT "seguimientos_agenda_asesor_id_fkey" FOREIGN KEY ("asesor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimientos_agenda" ADD CONSTRAINT "seguimientos_agenda_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seguimientos_agenda" ADD CONSTRAINT "seguimientos_agenda_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines_comerciales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- === Migracion: 20260803003012_add_property_visits_module ===
-- CreateEnum
CREATE TYPE "EstadoVisitaPropiedad" AS ENUM ('PROGRAMADA', 'CONFIRMADA', 'REPROGRAMADA', 'REALIZADA', 'CANCELADA', 'NO_ASISTIO');

-- CreateTable
CREATE TABLE "visitas_propiedades" (
    "id" TEXT NOT NULL,
    "fecha_hora" TIMESTAMP(3) NOT NULL,
    "duracion_estimada" INTEGER,
    "lugar_encuentro" VARCHAR(255),
    "estado" "EstadoVisitaPropiedad" NOT NULL DEFAULT 'PROGRAMADA',
    "resultado" TEXT,
    "observaciones" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "asesor_id" TEXT NOT NULL,
    "propiedad_id" TEXT NOT NULL,
    "pipeline_id" TEXT,
    "seguimiento_id" TEXT,
    "reprogramada_de_id" TEXT,

    CONSTRAINT "visitas_propiedades_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visitas_propiedades_empresa_id_idx" ON "visitas_propiedades"("empresa_id");

-- CreateIndex
CREATE INDEX "visitas_propiedades_cliente_id_idx" ON "visitas_propiedades"("cliente_id");

-- CreateIndex
CREATE INDEX "visitas_propiedades_asesor_id_idx" ON "visitas_propiedades"("asesor_id");

-- CreateIndex
CREATE INDEX "visitas_propiedades_propiedad_id_idx" ON "visitas_propiedades"("propiedad_id");

-- CreateIndex
CREATE INDEX "visitas_propiedades_pipeline_id_idx" ON "visitas_propiedades"("pipeline_id");

-- CreateIndex
CREATE INDEX "visitas_propiedades_seguimiento_id_idx" ON "visitas_propiedades"("seguimiento_id");

-- CreateIndex
CREATE INDEX "visitas_propiedades_estado_idx" ON "visitas_propiedades"("estado");

-- CreateIndex
CREATE INDEX "visitas_propiedades_fecha_hora_idx" ON "visitas_propiedades"("fecha_hora");

-- CreateIndex
CREATE INDEX "visitas_propiedades_active_idx" ON "visitas_propiedades"("active");

-- CreateIndex
CREATE INDEX "visitas_propiedades_deleted_at_idx" ON "visitas_propiedades"("deleted_at");

-- CreateIndex
CREATE INDEX "visitas_propiedades_empresa_id_fecha_hora_idx" ON "visitas_propiedades"("empresa_id", "fecha_hora");

-- CreateIndex
CREATE INDEX "visitas_propiedades_asesor_id_fecha_hora_idx" ON "visitas_propiedades"("asesor_id", "fecha_hora");

-- AddForeignKey
ALTER TABLE "visitas_propiedades" ADD CONSTRAINT "visitas_propiedades_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas_propiedades" ADD CONSTRAINT "visitas_propiedades_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas_propiedades" ADD CONSTRAINT "visitas_propiedades_asesor_id_fkey" FOREIGN KEY ("asesor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas_propiedades" ADD CONSTRAINT "visitas_propiedades_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas_propiedades" ADD CONSTRAINT "visitas_propiedades_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines_comerciales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas_propiedades" ADD CONSTRAINT "visitas_propiedades_seguimiento_id_fkey" FOREIGN KEY ("seguimiento_id") REFERENCES "seguimientos_agenda"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "visitas_propiedades" ADD CONSTRAINT "visitas_propiedades_reprogramada_de_id_fkey" FOREIGN KEY ("reprogramada_de_id") REFERENCES "visitas_propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- === Migracion: 20260803003524_add_reservations_module ===
-- CreateEnum
CREATE TYPE "EstadoReserva" AS ENUM ('ACTIVA', 'VENCIDA', 'CANCELADA', 'CONVERTIDA');

-- CreateTable
CREATE TABLE "reservas" (
    "id" TEXT NOT NULL,
    "estado" "EstadoReserva" NOT NULL DEFAULT 'ACTIVA',
    "monto_separacion" DECIMAL(14,2) NOT NULL,
    "fecha_reserva" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_vencimiento" TIMESTAMP(3) NOT NULL,
    "observaciones" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "propiedad_id" TEXT NOT NULL,
    "asesor_id" TEXT NOT NULL,
    "pipeline_id" TEXT,
    "visita_id" TEXT,

    CONSTRAINT "reservas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reservas_empresa_id_idx" ON "reservas"("empresa_id");

-- CreateIndex
CREATE INDEX "reservas_cliente_id_idx" ON "reservas"("cliente_id");

-- CreateIndex
CREATE INDEX "reservas_propiedad_id_idx" ON "reservas"("propiedad_id");

-- CreateIndex
CREATE INDEX "reservas_asesor_id_idx" ON "reservas"("asesor_id");

-- CreateIndex
CREATE INDEX "reservas_pipeline_id_idx" ON "reservas"("pipeline_id");

-- CreateIndex
CREATE INDEX "reservas_estado_idx" ON "reservas"("estado");

-- CreateIndex
CREATE INDEX "reservas_fecha_reserva_idx" ON "reservas"("fecha_reserva");

-- CreateIndex
CREATE INDEX "reservas_fecha_vencimiento_idx" ON "reservas"("fecha_vencimiento");

-- CreateIndex
CREATE INDEX "reservas_active_idx" ON "reservas"("active");

-- CreateIndex
CREATE INDEX "reservas_deleted_at_idx" ON "reservas"("deleted_at");

-- CreateIndex
CREATE INDEX "reservas_empresa_id_estado_idx" ON "reservas"("empresa_id", "estado");

-- CreateIndex
CREATE INDEX "reservas_empresa_id_propiedad_id_estado_idx" ON "reservas"("empresa_id", "propiedad_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "reservas_visita_id_key" ON "reservas"("visita_id");

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_asesor_id_fkey" FOREIGN KEY ("asesor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_pipeline_id_fkey" FOREIGN KEY ("pipeline_id") REFERENCES "pipelines_comerciales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reservas" ADD CONSTRAINT "reservas_visita_id_fkey" FOREIGN KEY ("visita_id") REFERENCES "visitas_propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- === Migracion: 20260803003541_add_reservations_module ===
-- This is an empty migration.

-- === Migracion: 20260803003640_add_reservations_consistency_constraints ===
ALTER TABLE "reservas"
ADD CONSTRAINT "reservas_monto_separacion_non_negative_check"
CHECK ("monto_separacion" >= 0);

ALTER TABLE "reservas"
ADD CONSTRAINT "reservas_fecha_vencimiento_gte_fecha_reserva_check"
CHECK ("fecha_vencimiento" >= "fecha_reserva");


-- === Migracion: 20260803004155_add_sales_module ===
-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('PENDIENTE_FORMALIZACION', 'FORMALIZADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "MetodoPagoVenta" AS ENUM ('CONTADO', 'CREDITO_HIPOTECARIO', 'FINANCIAMIENTO_DIRECTO', 'MIXTO', 'OTRO');

-- CreateTable
CREATE TABLE "ventas" (
    "id" TEXT NOT NULL,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'PENDIENTE_FORMALIZACION',
    "metodo_pago" "MetodoPagoVenta" NOT NULL,
    "fecha_venta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "precio_final" DECIMAL(14,2) NOT NULL,
    "descuento" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impuestos" DECIMAL(14,2),
    "total_venta" DECIMAL(14,2) NOT NULL,
    "observaciones" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "reserva_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "propiedad_id" TEXT NOT NULL,
    "asesor_id" TEXT NOT NULL,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ventas_reserva_id_key" ON "ventas"("reserva_id");

-- CreateIndex
CREATE INDEX "ventas_empresa_id_idx" ON "ventas"("empresa_id");

-- CreateIndex
CREATE INDEX "ventas_cliente_id_idx" ON "ventas"("cliente_id");

-- CreateIndex
CREATE INDEX "ventas_propiedad_id_idx" ON "ventas"("propiedad_id");

-- CreateIndex
CREATE INDEX "ventas_asesor_id_idx" ON "ventas"("asesor_id");

-- CreateIndex
CREATE INDEX "ventas_estado_idx" ON "ventas"("estado");

-- CreateIndex
CREATE INDEX "ventas_metodo_pago_idx" ON "ventas"("metodo_pago");

-- CreateIndex
CREATE INDEX "ventas_fecha_venta_idx" ON "ventas"("fecha_venta");

-- CreateIndex
CREATE INDEX "ventas_active_idx" ON "ventas"("active");

-- CreateIndex
CREATE INDEX "ventas_deleted_at_idx" ON "ventas"("deleted_at");

-- CreateIndex
CREATE INDEX "ventas_empresa_id_estado_idx" ON "ventas"("empresa_id", "estado");

-- CreateIndex
CREATE INDEX "ventas_empresa_id_fecha_venta_idx" ON "ventas"("empresa_id", "fecha_venta");

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_asesor_id_fkey" FOREIGN KEY ("asesor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- === Migracion: 20260803005628_add_payments_module ===
-- CreateEnum
CREATE TYPE "EstadoPago" AS ENUM ('PENDIENTE', 'VENCIDO', 'PAGADO', 'ANULADO');

-- CreateEnum
CREATE TYPE "MetodoPagoPago" AS ENUM ('EFECTIVO', 'TRANSFERENCIA_BANCARIA', 'DEPOSITO', 'TARJETA', 'CHEQUE', 'YAPE', 'PLIN', 'OTRO');

-- CreateTable
CREATE TABLE "pagos" (
    "id" TEXT NOT NULL,
    "numero_cuota" INTEGER,
    "fecha_vencimiento" TIMESTAMP(3),
    "fecha_pago" TIMESTAMP(3),
    "monto" DECIMAL(14,2) NOT NULL,
    "saldo" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "estado" "EstadoPago" NOT NULL DEFAULT 'PENDIENTE',
    "metodo_pago" "MetodoPagoPago",
    "numero_operacion" VARCHAR(100),
    "observaciones" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "venta_id" TEXT NOT NULL,
    "registrado_por_id" TEXT,

    CONSTRAINT "pagos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pagos_empresa_id_idx" ON "pagos"("empresa_id");

-- CreateIndex
CREATE INDEX "pagos_venta_id_idx" ON "pagos"("venta_id");

-- CreateIndex
CREATE INDEX "pagos_registrado_por_id_idx" ON "pagos"("registrado_por_id");

-- CreateIndex
CREATE INDEX "pagos_estado_idx" ON "pagos"("estado");

-- CreateIndex
CREATE INDEX "pagos_metodo_pago_idx" ON "pagos"("metodo_pago");

-- CreateIndex
CREATE INDEX "pagos_fecha_vencimiento_idx" ON "pagos"("fecha_vencimiento");

-- CreateIndex
CREATE INDEX "pagos_fecha_pago_idx" ON "pagos"("fecha_pago");

-- CreateIndex
CREATE INDEX "pagos_active_idx" ON "pagos"("active");

-- CreateIndex
CREATE INDEX "pagos_deleted_at_idx" ON "pagos"("deleted_at");

-- CreateIndex
CREATE INDEX "pagos_empresa_id_estado_idx" ON "pagos"("empresa_id", "estado");

-- CreateIndex
CREATE INDEX "pagos_empresa_id_venta_id_idx" ON "pagos"("empresa_id", "venta_id");

-- CreateIndex
CREATE INDEX "pagos_venta_id_estado_idx" ON "pagos"("venta_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "pagos_venta_id_numero_cuota_key" ON "pagos"("venta_id", "numero_cuota");

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pagos" ADD CONSTRAINT "pagos_registrado_por_id_fkey" FOREIGN KEY ("registrado_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- === Migracion: 20260803005726_add_payments_consistency_constraints ===
-- This is an empty migration.

-- === Migracion: 20260803005740_add_payments_consistency_constraints ===
-- This is an empty migration.

-- === Migracion: 20260803005810_add_payments_check_constraints ===
ALTER TABLE "pagos"
ADD CONSTRAINT "pagos_monto_non_negative_check"
CHECK ("monto" >= 0);

ALTER TABLE "pagos"
ADD CONSTRAINT "pagos_saldo_non_negative_check"
CHECK ("saldo" >= 0);

ALTER TABLE "pagos"
ADD CONSTRAINT "pagos_numero_cuota_positive_check"
CHECK ("numero_cuota" IS NULL OR "numero_cuota" > 0);


-- === Migracion: 20260803024640_add_documents_module ===
-- CreateEnum
CREATE TYPE "TipoDocumentoDocumento" AS ENUM ('IDENTIDAD', 'COMPROBANTE', 'CONTRATO', 'IMAGEN', 'OTRO');

-- CreateTable
CREATE TABLE "documentos" (
    "id" TEXT NOT NULL,
    "tipo" "TipoDocumentoDocumento" NOT NULL DEFAULT 'OTRO',
    "nombre_archivo" VARCHAR(255) NOT NULL,
    "nombre_original" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(150) NOT NULL,
    "extension" VARCHAR(20),
    "tamano_bytes" BIGINT NOT NULL,
    "ruta_almacenamiento" VARCHAR(500) NOT NULL,
    "hash_archivo" VARCHAR(128) NOT NULL,
    "observaciones" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "subido_por_id" TEXT NOT NULL,
    "cliente_id" TEXT,
    "propiedad_id" TEXT,
    "reserva_id" TEXT,
    "venta_id" TEXT,
    "pago_id" TEXT,

    CONSTRAINT "documentos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "documentos_empresa_id_idx" ON "documentos"("empresa_id");

-- CreateIndex
CREATE INDEX "documentos_subido_por_id_idx" ON "documentos"("subido_por_id");

-- CreateIndex
CREATE INDEX "documentos_cliente_id_idx" ON "documentos"("cliente_id");

-- CreateIndex
CREATE INDEX "documentos_propiedad_id_idx" ON "documentos"("propiedad_id");

-- CreateIndex
CREATE INDEX "documentos_reserva_id_idx" ON "documentos"("reserva_id");

-- CreateIndex
CREATE INDEX "documentos_venta_id_idx" ON "documentos"("venta_id");

-- CreateIndex
CREATE INDEX "documentos_pago_id_idx" ON "documentos"("pago_id");

-- CreateIndex
CREATE INDEX "documentos_tipo_idx" ON "documentos"("tipo");

-- CreateIndex
CREATE INDEX "documentos_active_idx" ON "documentos"("active");

-- CreateIndex
CREATE INDEX "documentos_deleted_at_idx" ON "documentos"("deleted_at");

-- CreateIndex
CREATE INDEX "documentos_empresa_id_tipo_idx" ON "documentos"("empresa_id", "tipo");

-- CreateIndex
CREATE INDEX "documentos_empresa_id_created_at_idx" ON "documentos"("empresa_id", "created_at");

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_subido_por_id_fkey" FOREIGN KEY ("subido_por_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_pago_id_fkey" FOREIGN KEY ("pago_id") REFERENCES "pagos"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- === Migracion: 20260803025252_add_contracts_module ===
-- CreateEnum
CREATE TYPE "EstadoContrato" AS ENUM ('BORRADOR', 'PENDIENTE_FIRMA', 'FIRMADO', 'VENCIDO', 'ANULADO');

-- CreateEnum
CREATE TYPE "TipoContrato" AS ENUM ('COMPRAVENTA', 'SEPARACION', 'ADENDA', 'OTRO');

-- CreateTable
CREATE TABLE "contratos" (
    "id" TEXT NOT NULL,
    "numero_contrato" VARCHAR(50) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "fecha_emision" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_firma" TIMESTAMP(3),
    "fecha_vencimiento" TIMESTAMP(3),
    "estado" "EstadoContrato" NOT NULL DEFAULT 'PENDIENTE_FIRMA',
    "tipo" "TipoContrato" NOT NULL,
    "monto_contrato" DECIMAL(14,2) NOT NULL,
    "observaciones" TEXT,
    "ruta_pdf_firmado" VARCHAR(500),
    "hash_documento" VARCHAR(128),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "venta_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "propiedad_id" TEXT NOT NULL,
    "responsable_id" TEXT NOT NULL,

    CONSTRAINT "contratos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "contratos_empresa_id_idx" ON "contratos"("empresa_id");

-- CreateIndex
CREATE INDEX "contratos_venta_id_idx" ON "contratos"("venta_id");

-- CreateIndex
CREATE INDEX "contratos_cliente_id_idx" ON "contratos"("cliente_id");

-- CreateIndex
CREATE INDEX "contratos_propiedad_id_idx" ON "contratos"("propiedad_id");

-- CreateIndex
CREATE INDEX "contratos_responsable_id_idx" ON "contratos"("responsable_id");

-- CreateIndex
CREATE INDEX "contratos_estado_idx" ON "contratos"("estado");

-- CreateIndex
CREATE INDEX "contratos_tipo_idx" ON "contratos"("tipo");

-- CreateIndex
CREATE INDEX "contratos_fecha_emision_idx" ON "contratos"("fecha_emision");

-- CreateIndex
CREATE INDEX "contratos_active_idx" ON "contratos"("active");

-- CreateIndex
CREATE INDEX "contratos_deleted_at_idx" ON "contratos"("deleted_at");

-- CreateIndex
CREATE INDEX "contratos_empresa_id_estado_idx" ON "contratos"("empresa_id", "estado");

-- CreateIndex
CREATE INDEX "contratos_empresa_id_venta_id_idx" ON "contratos"("empresa_id", "venta_id");

-- CreateIndex
CREATE INDEX "contratos_empresa_id_fecha_emision_idx" ON "contratos"("empresa_id", "fecha_emision");

-- CreateIndex
CREATE INDEX "contratos_venta_id_estado_idx" ON "contratos"("venta_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "contratos_empresa_id_numero_contrato_version_key" ON "contratos"("empresa_id", "numero_contrato", "version");

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contratos" ADD CONSTRAINT "contratos_responsable_id_fkey" FOREIGN KEY ("responsable_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- === Migracion: 20260803030657_add_commissions_module ===
-- CreateEnum
CREATE TYPE "EstadoComision" AS ENUM ('PENDIENTE_PAGO', 'PAGADA', 'ANULADA');

-- CreateTable
CREATE TABLE "comisiones" (
    "id" TEXT NOT NULL,
    "porcentaje_comision" DECIMAL(5,2) NOT NULL,
    "monto_comision" DECIMAL(14,2) NOT NULL,
    "estado" "EstadoComision" NOT NULL DEFAULT 'PENDIENTE_PAGO',
    "fecha_generacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_pago" TIMESTAMP(3),
    "observaciones" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "venta_id" TEXT NOT NULL,
    "asesor_id" TEXT NOT NULL,

    CONSTRAINT "comisiones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comisiones_empresa_id_idx" ON "comisiones"("empresa_id");

-- CreateIndex
CREATE INDEX "comisiones_venta_id_idx" ON "comisiones"("venta_id");

-- CreateIndex
CREATE INDEX "comisiones_asesor_id_idx" ON "comisiones"("asesor_id");

-- CreateIndex
CREATE INDEX "comisiones_estado_idx" ON "comisiones"("estado");

-- CreateIndex
CREATE INDEX "comisiones_fecha_generacion_idx" ON "comisiones"("fecha_generacion");

-- CreateIndex
CREATE INDEX "comisiones_fecha_pago_idx" ON "comisiones"("fecha_pago");

-- CreateIndex
CREATE INDEX "comisiones_active_idx" ON "comisiones"("active");

-- CreateIndex
CREATE INDEX "comisiones_deleted_at_idx" ON "comisiones"("deleted_at");

-- CreateIndex
CREATE INDEX "comisiones_empresa_id_estado_idx" ON "comisiones"("empresa_id", "estado");

-- CreateIndex
CREATE INDEX "comisiones_empresa_id_asesor_id_idx" ON "comisiones"("empresa_id", "asesor_id");

-- CreateIndex
CREATE INDEX "comisiones_empresa_id_venta_id_idx" ON "comisiones"("empresa_id", "venta_id");

-- CreateIndex
CREATE INDEX "comisiones_venta_id_estado_idx" ON "comisiones"("venta_id", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "comisiones_venta_id_asesor_id_key" ON "comisiones"("venta_id", "asesor_id");

-- AddForeignKey
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_venta_id_fkey" FOREIGN KEY ("venta_id") REFERENCES "ventas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comisiones" ADD CONSTRAINT "comisiones_asesor_id_fkey" FOREIGN KEY ("asesor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- === Migracion: 20260803031616_add_dashboard_kpis_indexes ===
-- CreateIndex
CREATE INDEX "clientes_empresa_id_created_at_idx" ON "clientes"("empresa_id", "created_at");

-- CreateIndex
CREATE INDEX "pipelines_comerciales_empresa_id_fecha_ingreso_idx" ON "pipelines_comerciales"("empresa_id", "fecha_ingreso");


-- === Migracion: 20260803035706_add_sales_balance_and_paid_state ===
-- AlterEnum
ALTER TYPE "EstadoVenta" ADD VALUE 'PAGADA';

-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "saldo_pendiente" DECIMAL(14,2) NOT NULL DEFAULT 0;


-- === Migracion: 20260803042000_update_commission_states ===
ALTER TYPE "EstadoComision" RENAME VALUE 'PENDIENTE_PAGO' TO 'PENDIENTE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'EstadoComision'
      AND e.enumlabel = 'APROBADA'
  ) THEN
    ALTER TYPE "EstadoComision" ADD VALUE 'APROBADA' AFTER 'PENDIENTE';
  END IF;
END $$;



