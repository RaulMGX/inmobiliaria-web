-- CreateEnum
CREATE TYPE "OrigenLead" AS ENUM ('WHATSAPP', 'FACEBOOK', 'INSTAGRAM', 'PAGINA_WEB', 'REFERIDO', 'CAMINATA', 'LLAMADA', 'OTRO');

-- AlterTable
ALTER TABLE "pipelines_comerciales" ADD COLUMN "monto_estimado" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "pipelines_comerciales" ADD COLUMN "origen" "OrigenLead" DEFAULT 'OTRO';

-- AlterTable
ALTER TABLE "pipelines_comerciales" ADD COLUMN "presupuesto_maximo" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "pipelines_comerciales" ADD COLUMN "zona_interes" VARCHAR(150);

-- AlterTable
ALTER TABLE "pipelines_comerciales" ADD COLUMN "tipo_propiedad_interes" "TipoPropiedad";

-- AlterTable
ALTER TABLE "pipelines_comerciales" ADD COLUMN "propiedad_id" TEXT;

-- CreateIndex
CREATE INDEX "pipelines_comerciales_propiedad_id_idx" ON "pipelines_comerciales"("propiedad_id");

-- CreateIndex
CREATE INDEX "pipelines_comerciales_origen_idx" ON "pipelines_comerciales"("origen");

-- AddForeignKey
ALTER TABLE "pipelines_comerciales" ADD CONSTRAINT "pipelines_comerciales_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE SET NULL ON UPDATE CASCADE;
