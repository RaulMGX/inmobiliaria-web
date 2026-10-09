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
