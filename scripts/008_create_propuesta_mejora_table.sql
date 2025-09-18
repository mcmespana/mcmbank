-- Tabla de propuestas de mejora para el panel colaborativo
CREATE TABLE IF NOT EXISTS public.propuesta_mejora (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  impacto TEXT,
  tipo TEXT NOT NULL DEFAULT 'idea' CHECK (
    tipo IN ('idea', 'error')
  ),
  estado TEXT NOT NULL DEFAULT 'nueva_idea' CHECK (
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
  ),
  creado_por UUID NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  creado_por_nombre TEXT,
  creado_por_email TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  actualizado_en TIMESTAMPTZ
);

COMMENT ON TABLE public.propuesta_mejora IS 'Ideas de mejora y errores detectados aportados por la comunidad';
COMMENT ON COLUMN public.propuesta_mejora.tipo IS 'Clasificación de la propuesta: idea o error';
COMMENT ON COLUMN public.propuesta_mejora.estado IS 'Workflow ideas: nueva_idea → en_estudio → lo_haremos → en_desarrollo → hechisimo; errores: error_detectado → resolviendo → resuelto';

ALTER TABLE public.propuesta_mejora ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Propuestas visibles para usuarios" ON public.propuesta_mejora
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Cualquier persona autenticada puede proponer" ON public.propuesta_mejora
  FOR INSERT
  WITH CHECK (auth.uid() = creado_por);

CREATE POLICY IF NOT EXISTS "Quien crea puede editar su idea" ON public.propuesta_mejora
  FOR UPDATE
  USING (auth.uid() = creado_por)
  WITH CHECK (auth.uid() = creado_por);

CREATE POLICY IF NOT EXISTS "Gestor central puede gestionar propuestas" ON public.propuesta_mejora
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.membresia m
      WHERE m.usuario_id = auth.uid()
        AND m.rol = 'gestor_central'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.membresia m
      WHERE m.usuario_id = auth.uid()
        AND m.rol = 'gestor_central'
    )
  );

CREATE POLICY IF NOT EXISTS "Gestor central puede eliminar propuestas" ON public.propuesta_mejora
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.membresia m
      WHERE m.usuario_id = auth.uid()
        AND m.rol = 'gestor_central'
    )
  );

CREATE INDEX IF NOT EXISTS propuesta_mejora_estado_idx ON public.propuesta_mejora (estado);
CREATE INDEX IF NOT EXISTS propuesta_mejora_tipo_idx ON public.propuesta_mejora (tipo);
CREATE INDEX IF NOT EXISTS propuesta_mejora_creado_en_idx ON public.propuesta_mejora (creado_en DESC);
