ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS hora_inicio_turno VARCHAR(5);
ALTER TABLE public.usuarios ADD COLUMN IF NOT EXISTS hora_fin_turno VARCHAR(5);
