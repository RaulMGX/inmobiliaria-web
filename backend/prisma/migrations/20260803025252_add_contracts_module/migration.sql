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
