-- CreateEnum
CREATE TYPE "EstadoVenta" AS ENUM ('PENDIENTE_FORMALIZACION', 'FORMALIZADA', 'ANULADA');

-- CreateEnum
CREATE TYPE "MetodoPagoVenta" AS ENUM ('CONTADO', 'CREDITO_HIPOTECARIO', 'FINANCIAMIENTO_DIRECTO', 'MIXTO', 'OTRO');

-- CreateTable
CREATE TABLE "ventas" (
    "id" TEXT NOT NULL,
    "estado" "EstadoVenta" NOT NULL DEFAULT 'PENDIENTE_FORMALIZACION',
    "metodo_pago" "MetodoPagoVenta" NOT NULL,
    "fecha_venta" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "precio_final" DECIMAL(14,2) NOT NULL,
    "descuento" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impuestos" DECIMAL(14,2),
    "total_venta" DECIMAL(14,2) NOT NULL,
    "observaciones" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "empresa_id" TEXT NOT NULL,
    "reserva_id" TEXT NOT NULL,
    "cliente_id" TEXT NOT NULL,
    "propiedad_id" TEXT NOT NULL,
    "asesor_id" TEXT NOT NULL,

    CONSTRAINT "ventas_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ventas_reserva_id_key" ON "ventas"("reserva_id");

-- CreateIndex
CREATE INDEX "ventas_empresa_id_idx" ON "ventas"("empresa_id");

-- CreateIndex
CREATE INDEX "ventas_cliente_id_idx" ON "ventas"("cliente_id");

-- CreateIndex
CREATE INDEX "ventas_propiedad_id_idx" ON "ventas"("propiedad_id");

-- CreateIndex
CREATE INDEX "ventas_asesor_id_idx" ON "ventas"("asesor_id");

-- CreateIndex
CREATE INDEX "ventas_estado_idx" ON "ventas"("estado");

-- CreateIndex
CREATE INDEX "ventas_metodo_pago_idx" ON "ventas"("metodo_pago");

-- CreateIndex
CREATE INDEX "ventas_fecha_venta_idx" ON "ventas"("fecha_venta");

-- CreateIndex
CREATE INDEX "ventas_active_idx" ON "ventas"("active");

-- CreateIndex
CREATE INDEX "ventas_deleted_at_idx" ON "ventas"("deleted_at");

-- CreateIndex
CREATE INDEX "ventas_empresa_id_estado_idx" ON "ventas"("empresa_id", "estado");

-- CreateIndex
CREATE INDEX "ventas_empresa_id_fecha_venta_idx" ON "ventas"("empresa_id", "fecha_venta");

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_empresa_id_fkey" FOREIGN KEY ("empresa_id") REFERENCES "empresas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_reserva_id_fkey" FOREIGN KEY ("reserva_id") REFERENCES "reservas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "clientes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_propiedad_id_fkey" FOREIGN KEY ("propiedad_id") REFERENCES "propiedades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ventas" ADD CONSTRAINT "ventas_asesor_id_fkey" FOREIGN KEY ("asesor_id") REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
