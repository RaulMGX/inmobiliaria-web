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
