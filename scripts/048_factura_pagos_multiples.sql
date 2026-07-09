-- Una factura puede tener 0, 1 o varios movimientos vinculados (pago en varios
-- plazos: p.ej. una factura de 3.000 € pagada en dos transferencias de 1.500 €).
-- Pasamos de 1-a-1 a 1 factura -> N movimientos: cada movimiento apunta a lo
-- sumo a una factura (movimiento.factura_id), pero varios movimientos pueden
-- apuntar a la misma factura. El campo factura.movimiento_id (1-a-1) se elimina;
-- el estado de la factura se recalcula automáticamente comparando el importe
-- de la factura con la suma de los movimientos vinculados.

-- 1) movimiento.factura_id deja de ser único (varios movimientos -> misma factura)
ALTER TABLE public.movimiento DROP CONSTRAINT IF EXISTS movimiento_factura_id_key;

-- 2) factura.movimiento_id (1-a-1) ya no tiene sentido: el vínculo vive solo
--    del lado movimiento.factura_id.
DROP INDEX IF EXISTS idx_factura_movimiento;
ALTER TABLE public.factura DROP COLUMN IF EXISTS movimiento_id;

-- 3) Nuevo estado intermedio: pagada parcialmente.
ALTER TABLE public.factura DROP CONSTRAINT IF EXISTS factura_estado_check;
ALTER TABLE public.factura
    ADD CONSTRAINT factura_estado_check
    CHECK (estado IN ('bandeja', 'sin_pagar', 'pagada_parcial', 'pagada', 'pagada_fuera'));

-- 4) Los triggers antiguos dependían de factura.movimiento_id: se sustituyen.
DROP TRIGGER IF EXISTS trg_factura_actualizado_en ON public.factura;
DROP TRIGGER IF EXISTS trg_factura_insert_defaults ON public.factura;
DROP FUNCTION IF EXISTS public.set_factura_actualizado_en();
DROP FUNCTION IF EXISTS public.set_factura_insert_defaults();

-- Mantiene actualizado_en en cualquier UPDATE (sin lógica de movimiento_id: eso
-- ahora lo gestiona recalcular_estado_factura desde el lado movimiento).
CREATE OR REPLACE FUNCTION public.set_factura_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

CREATE TRIGGER trg_factura_actualizado_en
    BEFORE UPDATE ON public.factura
    FOR EACH ROW
    EXECUTE FUNCTION public.set_factura_actualizado_en();

-- 5) Recalcula el estado de una factura a partir de la suma de sus movimientos
--    vinculados. Un 2% de margen (mínimo 0,50 €) para no exigir centavo exacto.
--    'pagada_fuera' es una marca manual que se respeta mientras no haya ningún
--    movimiento real vinculado (si lo hay, la realidad manda).
CREATE OR REPLACE FUNCTION public.recalcular_estado_factura(p_factura_id UUID)
RETURNS VOID AS $$
DECLARE
    v_total_pagado NUMERIC;
    v_importe NUMERIC;
    v_estado_actual TEXT;
    v_margen NUMERIC;
    v_nuevo_estado TEXT;
BEGIN
    SELECT importe, estado INTO v_importe, v_estado_actual
    FROM public.factura WHERE id = p_factura_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    SELECT COALESCE(SUM(ABS(importe)), 0) INTO v_total_pagado
    FROM public.movimiento WHERE factura_id = p_factura_id;

    v_margen := GREATEST(COALESCE(v_importe, 0) * 0.02, 0.5);

    IF v_total_pagado = 0 THEN
        v_nuevo_estado := CASE
            WHEN v_estado_actual IN ('bandeja', 'pagada_fuera') THEN v_estado_actual
            ELSE 'sin_pagar'
        END;
    ELSIF v_importe IS NOT NULL AND v_total_pagado >= (v_importe - v_margen) THEN
        v_nuevo_estado := 'pagada';
    ELSE
        v_nuevo_estado := 'pagada_parcial';
    END IF;

    IF v_nuevo_estado IS DISTINCT FROM v_estado_actual THEN
        UPDATE public.factura SET estado = v_nuevo_estado WHERE id = p_factura_id;
    END IF;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

-- 6) Trigger en movimiento: cualquier alta/baja/cambio de factura_id o importe
--    recalcula el estado de la(s) factura(s) afectada(s).
CREATE OR REPLACE FUNCTION public.trg_movimiento_recalcular_factura()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        IF OLD.factura_id IS NOT NULL THEN
            PERFORM public.recalcular_estado_factura(OLD.factura_id);
        END IF;
        RETURN OLD;
    END IF;

    IF TG_OP = 'INSERT' THEN
        IF NEW.factura_id IS NOT NULL THEN
            PERFORM public.recalcular_estado_factura(NEW.factura_id);
        END IF;
        RETURN NEW;
    END IF;

    -- UPDATE
    IF OLD.factura_id IS DISTINCT FROM NEW.factura_id THEN
        IF OLD.factura_id IS NOT NULL THEN
            PERFORM public.recalcular_estado_factura(OLD.factura_id);
        END IF;
        IF NEW.factura_id IS NOT NULL THEN
            PERFORM public.recalcular_estado_factura(NEW.factura_id);
        END IF;
    ELSIF NEW.factura_id IS NOT NULL AND OLD.importe IS DISTINCT FROM NEW.importe THEN
        PERFORM public.recalcular_estado_factura(NEW.factura_id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_movimiento_recalcular_factura ON public.movimiento;
CREATE TRIGGER trg_movimiento_recalcular_factura
    AFTER INSERT OR UPDATE OF factura_id, importe OR DELETE ON public.movimiento
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_movimiento_recalcular_factura();

-- 7) Cambiar el importe de la factura también debe recalcular su estado
--    (p.ej. si se corrige el importe total tras vincular algún pago parcial).
CREATE OR REPLACE FUNCTION public.trg_factura_importe_recalcular()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM public.recalcular_estado_factura(NEW.id);
    RETURN NULL; -- AFTER trigger: el valor de retorno se ignora
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_factura_importe_recalcular ON public.factura;
CREATE TRIGGER trg_factura_importe_recalcular
    AFTER UPDATE OF importe ON public.factura
    FOR EACH ROW
    EXECUTE FUNCTION public.trg_factura_importe_recalcular();

COMMENT ON FUNCTION public.recalcular_estado_factura(UUID) IS 'Recalcula factura.estado comparando su importe con la suma de movimiento.importe de los movimientos vinculados (factura_id). pagada si cubre el importe (con margen del 2%, mín 0,50€), pagada_parcial si cubre una parte, sin_pagar si ninguna.';
COMMENT ON COLUMN public.factura.estado IS 'bandeja | sin_pagar | pagada_parcial | pagada | pagada_fuera. Se recalcula automáticamente al vincular/desvincular movimientos, salvo pagada_fuera (marca manual) y bandeja (estado inicial sin tocar).';

-- ---------------------------------------------------------------------------
-- Marca manual "falta factura" en movimientos. No todos los movimientos
-- llevan factura (nóminas, comisiones bancarias, etc.), pero el equipo puede
-- marcar a mano los que sí deberían tenerla y aún no se ha subido, para
-- poder filtrarlos y no perderlos de vista.
-- ---------------------------------------------------------------------------

ALTER TABLE public.movimiento
    ADD COLUMN IF NOT EXISTS factura_pendiente BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_movimiento_factura_pendiente
    ON public.movimiento(delegacion_id, factura_pendiente)
    WHERE factura_pendiente = true;

COMMENT ON COLUMN public.movimiento.factura_pendiente IS 'Marca manual: a este movimiento le falta subir/vincular su factura. No se pone automáticamente; el equipo la activa cuando corresponde.';
