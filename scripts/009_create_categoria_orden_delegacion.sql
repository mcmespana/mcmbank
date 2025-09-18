-- Tabla de orden de categorías por delegación
CREATE TABLE IF NOT EXISTS public.categoria_orden_delegacion (
  delegacion_id UUID NOT NULL REFERENCES public.delegacion (id) ON DELETE CASCADE,
  categoria_id UUID NOT NULL REFERENCES public.categoria (id) ON DELETE CASCADE,
  orden INTEGER NOT NULL,
  creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  actualizado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  PRIMARY KEY (delegacion_id, categoria_id)
);
