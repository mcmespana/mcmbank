-- Añade columna tipo y amplía el workflow para gestionar errores reportados
ALTER TABLE public.propuesta_mejora
  ADD COLUMN IF NOT EXISTS tipo TEXT;

-- Aseguramos valores por defecto antes de aplicar restricciones nuevas
UPDATE public.propuesta_mejora
SET tipo = COALESCE(tipo, 'idea');

ALTER TABLE public.propuesta_mejora
  ALTER COLUMN tipo SET DEFAULT 'idea';

ALTER TABLE public.propuesta_mejora
  ALTER COLUMN tipo SET NOT NULL;

ALTER TABLE public.propuesta_mejora
  DROP CONSTRAINT IF EXISTS propuesta_mejora_tipo_check;

ALTER TABLE public.propuesta_mejora
  ADD CONSTRAINT propuesta_mejora_tipo_check
  CHECK (tipo IN ('idea', 'error'));

ALTER TABLE public.propuesta_mejora
  DROP CONSTRAINT IF EXISTS propuesta_mejora_estado_check;

ALTER TABLE public.propuesta_mejora
  ADD CONSTRAINT propuesta_mejora_estado_check
  CHECK (
    estado IN (
      'nueva_idea',
      'en_estudio',
      'lo_haremos',
      'en_desarrollo',
      'hechisimo',
      'error_detectado',
      'resolviendo',
      'resuelto'
    )
  );

COMMENT ON COLUMN public.propuesta_mejora.tipo IS 'Clasificación de la propuesta: idea o error';
COMMENT ON COLUMN public.propuesta_mejora.estado IS 'Workflow ideas: nueva_idea → en_estudio → lo_haremos → en_desarrollo → hechisimo; errores: error_detectado → resolviendo → resuelto';

CREATE INDEX IF NOT EXISTS propuesta_mejora_tipo_idx ON public.propuesta_mejora (tipo);
