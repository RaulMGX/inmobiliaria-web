ALTER TABLE "reservas"
ADD CONSTRAINT "reservas_monto_separacion_non_negative_check"
CHECK ("monto_separacion" >= 0);

ALTER TABLE "reservas"
ADD CONSTRAINT "reservas_fecha_vencimiento_gte_fecha_reserva_check"
CHECK ("fecha_vencimiento" >= "fecha_reserva");
