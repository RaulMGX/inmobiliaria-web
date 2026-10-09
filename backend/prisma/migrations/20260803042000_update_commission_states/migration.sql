ALTER TYPE "EstadoComision" RENAME VALUE 'PENDIENTE_PAGO' TO 'PENDIENTE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'EstadoComision'
      AND e.enumlabel = 'APROBADA'
  ) THEN
    ALTER TYPE "EstadoComision" ADD VALUE 'APROBADA' AFTER 'PENDIENTE';
  END IF;
END $$;

