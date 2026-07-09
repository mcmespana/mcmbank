-- Facturas: bandeja de entrada de facturas de la delegación.
-- Flujo principal: se sube el archivo (o llega por email en el futuro), se crea
-- la entidad factura con los datos básicos (proveedor, importe, fecha) y se
-- vincula a un movimiento bancario. No es una lista de "pendientes de pagar":
-- casi siempre estarán ya pagadas cuando se suban; lo importante es conciliar.
--
-- Estados:
--   - bandeja       recién subida, pendiente de revisar/completar datos
--   - sin_pagar     registrada pero aún no pagada
--   - pagada        pagada y vinculada a un movimiento de MCM Bank
--   - pagada_fuera  pagada, pero el pago se hizo fuera de MCM Bank (no hay movimiento)
--
-- Origen:
--   - subida        subida a mano desde la sección Facturas
--   - movimiento    creada automáticamente al subir una factura a un movimiento
--   - email         (futuro) recibida en el buzón de facturas de la delegación
--
-- Los archivos de la factura viven en archivo_adjunto con entidad='factura'.
-- Al vincular la factura a un movimiento se replican en movimiento_archivo
-- (mismo path de Storage) para que la UI de movimientos los muestre sin cambios.

CREATE TABLE IF NOT EXISTS public.factura (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegacion_id UUID NOT NULL REFERENCES public.delegacion(id) ON DELETE CASCADE,
    contacto_id UUID REFERENCES public.contacto(id) ON DELETE SET NULL,

    concepto TEXT,
    numero TEXT,
    fecha_emision DATE,
    importe NUMERIC(12, 2) CHECK (importe IS NULL OR importe > 0),
    moneda TEXT NOT NULL DEFAULT 'EUR',

    estado TEXT NOT NULL DEFAULT 'bandeja'
        CHECK (estado IN ('bandeja', 'sin_pagar', 'pagada', 'pagada_fuera')),

    -- Vínculo con movimiento (opcional, 1-a-1). Al vincular, estado pasa a 'pagada'.
    movimiento_id UUID UNIQUE REFERENCES public.movimiento(id) ON DELETE SET NULL,

    origen TEXT NOT NULL DEFAULT 'subida'
        CHECK (origen IN ('subida', 'movimiento', 'email')),
    -- Remitente del email (integración futura: buzón de facturas por delegación)
    email_remitente TEXT,
    -- Datos extraídos por IA (integración futura: Gemini / Document AI)
    datos_ia JSONB,

    notas TEXT,
    creado_por UUID,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_factura_delegacion_estado
    ON public.factura(delegacion_id, estado);

CREATE INDEX IF NOT EXISTS idx_factura_contacto
    ON public.factura(contacto_id)
    WHERE contacto_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_factura_movimiento
    ON public.factura(movimiento_id)
    WHERE movimiento_id IS NOT NULL;

-- Para el matching por importe de facturas sin conciliar
CREATE INDEX IF NOT EXISTS idx_factura_delegacion_importe_sin_movimiento
    ON public.factura(delegacion_id, importe)
    WHERE movimiento_id IS NULL;

-- Trigger BEFORE UPDATE: mantiene actualizado_en y sincroniza estado con movimiento_id
CREATE OR REPLACE FUNCTION public.set_factura_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = timezone('utc', now());

    -- Al vincular un movimiento, la factura queda pagada (y dentro de MCM Bank)
    IF NEW.movimiento_id IS NOT NULL AND NEW.estado <> 'pagada' THEN
        NEW.estado = 'pagada';
    END IF;

    -- Al desvincular, vuelve a 'sin_pagar' (el usuario puede marcarla pagada_fuera)
    IF NEW.movimiento_id IS NULL AND OLD.movimiento_id IS NOT NULL AND NEW.estado = 'pagada' THEN
        NEW.estado = 'sin_pagar';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_factura_actualizado_en ON public.factura;
CREATE TRIGGER trg_factura_actualizado_en
    BEFORE UPDATE ON public.factura
    FOR EACH ROW
    EXECUTE FUNCTION public.set_factura_actualizado_en();

-- Trigger BEFORE INSERT: coherencia inicial estado/movimiento_id
CREATE OR REPLACE FUNCTION public.set_factura_insert_defaults()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.movimiento_id IS NOT NULL AND NEW.estado <> 'pagada' THEN
        NEW.estado = 'pagada';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_factura_insert_defaults ON public.factura;
CREATE TRIGGER trg_factura_insert_defaults
    BEFORE INSERT ON public.factura
    FOR EACH ROW
    EXECUTE FUNCTION public.set_factura_insert_defaults();

-- RLS (mismo modelo que pago_mcm)
ALTER TABLE public.factura ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier miembro de la delegación (incluida solo lectura)
CREATE POLICY "Users can view facturas of their delegations" ON public.factura
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.delegacion_id = factura.delegacion_id
              AND mb.usuario_id = auth.uid()
        )
    );

-- INSERT / UPDATE / DELETE: tesorero / gestor_central de la delegación o gestor_central global
CREATE POLICY "Users can insert facturas in their delegations" ON public.factura
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = factura.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR (mb.rol = 'gestor_central')
              )
        )
    );

CREATE POLICY "Users can update facturas in their delegations" ON public.factura
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = factura.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR (mb.rol = 'gestor_central')
              )
        )
    );

CREATE POLICY "Users can delete facturas in their delegations" ON public.factura
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = factura.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR (mb.rol = 'gestor_central')
              )
        )
    );

-- Vínculo inverso desde movimiento (relación 1-a-1 con factura)
ALTER TABLE public.movimiento
    ADD COLUMN IF NOT EXISTS factura_id UUID UNIQUE REFERENCES public.factura(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movimiento_factura
    ON public.movimiento(factura_id)
    WHERE factura_id IS NOT NULL;

-- archivo_adjunto ahora acepta también entidad='factura'
ALTER TABLE public.archivo_adjunto DROP CONSTRAINT IF EXISTS archivo_adjunto_entidad_check;
ALTER TABLE public.archivo_adjunto
    ADD CONSTRAINT archivo_adjunto_entidad_check
    CHECK (entidad IN ('pago_mcm', 'movimiento', 'factura'));

COMMENT ON TABLE public.factura IS 'Bandeja de facturas por delegación: se suben archivos, se completan datos básicos y se concilian con movimientos bancarios.';
COMMENT ON COLUMN public.factura.estado IS 'bandeja | sin_pagar | pagada (vinculada a movimiento) | pagada_fuera (pagada fuera de MCM Bank). Pasa a pagada automáticamente al vincular movimiento_id.';
COMMENT ON COLUMN public.factura.origen IS 'subida | movimiento (creada al subir factura a un movimiento) | email (buzón de facturas, integración futura).';
COMMENT ON COLUMN public.factura.email_remitente IS 'Remitente del correo que originó la factura (integración futura de buzón por delegación).';
COMMENT ON COLUMN public.factura.datos_ia IS 'JSON con los datos extraídos por IA (proveedor, fecha, importe) en la integración futura de lectura automática.';
COMMENT ON COLUMN public.movimiento.factura_id IS 'Factura (1-a-1) conciliada con este movimiento.';
