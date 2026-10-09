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
