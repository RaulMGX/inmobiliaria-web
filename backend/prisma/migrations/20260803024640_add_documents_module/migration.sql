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
