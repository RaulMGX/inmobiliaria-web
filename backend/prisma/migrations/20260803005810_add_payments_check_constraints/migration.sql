ALTER TABLE "pagos"
ADD CONSTRAINT "pagos_monto_non_negative_check"
CHECK ("monto" >= 0);

ALTER TABLE "pagos"
ADD CONSTRAINT "pagos_saldo_non_negative_check"
CHECK ("saldo" >= 0);

ALTER TABLE "pagos"
ADD CONSTRAINT "pagos_numero_cuota_positive_check"
CHECK ("numero_cuota" IS NULL OR "numero_cuota" > 0);
