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
