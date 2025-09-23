-- Añade control de visibilidad por delegación a las categorías
ALTER TABLE public.categoria_orden_delegacion
ADD COLUMN IF NOT EXISTS esta_activa boolean;

UPDATE public.categoria_orden_delegacion
SET esta_activa = true
WHERE esta_activa IS NULL;

ALTER TABLE public.categoria_orden_delegacion
ALTER COLUMN esta_activa SET NOT NULL;

ALTER TABLE public.categoria_orden_delegacion
ALTER COLUMN esta_activa SET DEFAULT true;
