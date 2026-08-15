-- 067: `actualizado_en` en movimiento
--
-- Hace falta para sincronizar el concepto entre una factura y el movimiento al
-- que se vincula: los dos describen el mismo gasto, así que al vincularlos el
-- concepto bueno es el que se haya tocado más tarde. La factura ya tenía
-- `actualizado_en` (scripts/047 y 048); el movimiento no, y sin él no había
-- forma de saber cuál de los dos textos es el reciente.
--
-- Se rellena con `creado_en` para las filas que ya existen: un movimiento que
-- nadie ha editado sigue teniendo el concepto que trajo el banco, y esa es
-- justo la fecha que lo describe.

ALTER TABLE public.movimiento
  ADD COLUMN IF NOT EXISTS actualizado_en timestamptz;

UPDATE public.movimiento SET actualizado_en = creado_en WHERE actualizado_en IS NULL;

ALTER TABLE public.movimiento
  ALTER COLUMN actualizado_en SET DEFAULT now(),
  ALTER COLUMN actualizado_en SET NOT NULL;

CREATE OR REPLACE FUNCTION public.movimiento_touch_actualizado_en()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.actualizado_en := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS movimiento_touch_actualizado_en ON public.movimiento;
CREATE TRIGGER movimiento_touch_actualizado_en
  BEFORE UPDATE ON public.movimiento
  FOR EACH ROW
  EXECUTE FUNCTION public.movimiento_touch_actualizado_en();
