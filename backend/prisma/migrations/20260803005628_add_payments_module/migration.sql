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
