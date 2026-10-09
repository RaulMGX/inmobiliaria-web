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
