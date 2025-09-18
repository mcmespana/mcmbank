-- Tablas de interacción para propuestas de mejora

-- Votos
CREATE TABLE IF NOT EXISTS public.propuesta_mejora_voto (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propuesta_id UUID NOT NULL REFERENCES public.propuesta_mejora(id) ON DELETE CASCADE,
  usuario_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  CONSTRAINT propuesta_mejora_voto_unique UNIQUE (propuesta_id, usuario_id)
);

ALTER TABLE public.propuesta_mejora_voto ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Propuestas - votos visibles" ON public.propuesta_mejora_voto
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Propuestas - votar" ON public.propuesta_mejora_voto
  FOR INSERT
  WITH CHECK (auth.uid() = usuario_id);

CREATE POLICY IF NOT EXISTS "Propuestas - retirar voto" ON public.propuesta_mejora_voto
  FOR DELETE
  USING (auth.uid() = usuario_id);

CREATE POLICY IF NOT EXISTS "Gestor central limpia votos" ON public.propuesta_mejora_voto
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.membresia m
      WHERE m.usuario_id = auth.uid()
        AND m.rol = 'gestor_central'
    )
  );

CREATE INDEX IF NOT EXISTS propuesta_mejora_voto_propuesta_idx ON public.propuesta_mejora_voto (propuesta_id);
CREATE INDEX IF NOT EXISTS propuesta_mejora_voto_usuario_idx ON public.propuesta_mejora_voto (usuario_id);

-- Comentarios
CREATE TABLE IF NOT EXISTS public.propuesta_mejora_comentario (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  propuesta_id UUID NOT NULL REFERENCES public.propuesta_mejora(id) ON DELETE CASCADE,
  contenido TEXT NOT NULL,
  creado_por UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  creado_por_nombre TEXT,
  creado_por_email TEXT,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

ALTER TABLE public.propuesta_mejora_comentario ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Propuestas - comentarios visibles" ON public.propuesta_mejora_comentario
  FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY IF NOT EXISTS "Propuestas - comentar" ON public.propuesta_mejora_comentario
  FOR INSERT
  WITH CHECK (auth.uid() = creado_por);

CREATE POLICY IF NOT EXISTS "Propuestas - autor edita comentario" ON public.propuesta_mejora_comentario
  FOR UPDATE
  USING (auth.uid() = creado_por)
  WITH CHECK (auth.uid() = creado_por);

CREATE POLICY IF NOT EXISTS "Propuestas - autor elimina comentario" ON public.propuesta_mejora_comentario
  FOR DELETE
  USING (auth.uid() = creado_por);

CREATE POLICY IF NOT EXISTS "Gestor central modera comentarios" ON public.propuesta_mejora_comentario
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.membresia m
      WHERE m.usuario_id = auth.uid()
        AND m.rol = 'gestor_central'
    )
  );

CREATE INDEX IF NOT EXISTS propuesta_mejora_comentario_propuesta_idx ON public.propuesta_mejora_comentario (propuesta_id);
CREATE INDEX IF NOT EXISTS propuesta_mejora_comentario_creado_en_idx ON public.propuesta_mejora_comentario (creado_en DESC);
