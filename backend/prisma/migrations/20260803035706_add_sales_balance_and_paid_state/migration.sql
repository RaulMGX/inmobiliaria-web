-- AlterEnum
ALTER TYPE "EstadoVenta" ADD VALUE 'PAGADA';

-- AlterTable
ALTER TABLE "ventas" ADD COLUMN     "saldo_pendiente" DECIMAL(14,2) NOT NULL DEFAULT 0;
