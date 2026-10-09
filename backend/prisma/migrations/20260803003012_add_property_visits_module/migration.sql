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
