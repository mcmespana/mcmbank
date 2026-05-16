-- Pagos MCM: registro de pagos internos pendientes (reembolsos, ayudas, etc.)
-- Una persona del equipo adelanta un gasto y la delegación debe transferirle.
-- Cada pago se asocia a un contacto y, opcionalmente, se vincula a un movimiento
-- (creado a mano desde aquí o conciliado más tarde con un movimiento del banco).

CREATE TABLE IF NOT EXISTS public.pago_mcm (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegacion_id UUID NOT NULL REFERENCES public.delegacion(id) ON DELETE CASCADE,
    contacto_id UUID NOT NULL REFERENCES public.contacto(id) ON DELETE RESTRICT,

    concepto TEXT NOT NULL,
    descripcion TEXT,
    importe NUMERIC(12, 2) NOT NULL CHECK (importe > 0),
    moneda TEXT NOT NULL DEFAULT 'EUR',

    estado TEXT NOT NULL DEFAULT 'pendiente'
        CHECK (estado IN ('borrador', 'pendiente', 'pagado', 'cancelado')),

    -- Tipo de cálculo y datos asociados (todos opcionales salvo el tipo)
    tipo_calculo TEXT NOT NULL DEFAULT 'manual'
        CHECK (tipo_calculo IN ('manual', 'gasolina_tickets', 'gasolina_km', 'gasolina_avanzado')),

    -- Datos gasolina por km
    gasolina_km_un_trayecto NUMERIC(10, 2),
    gasolina_ida_vuelta BOOLEAN NOT NULL DEFAULT false,
    gasolina_precio_km NUMERIC(5, 4),
    gasolina_preset TEXT
        CHECK (gasolina_preset IS NULL OR gasolina_preset IN (
            'ivaj_0_12', 'min_0_18', 'max_0_20', 'estandar_0_26', 'personalizado'
        )),

    categoria_id_sugerida UUID REFERENCES public.categoria(id) ON DELETE SET NULL,
    notas TEXT,

    -- Vínculo con movimiento (opcional). Cuando existe, estado pasa a 'pagado'.
    movimiento_id UUID UNIQUE REFERENCES public.movimiento(id) ON DELETE SET NULL,

    creado_por UUID,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_pago_mcm_delegacion_estado
    ON public.pago_mcm(delegacion_id, estado);

CREATE INDEX IF NOT EXISTS idx_pago_mcm_contacto
    ON public.pago_mcm(contacto_id);

CREATE INDEX IF NOT EXISTS idx_pago_mcm_movimiento
    ON public.pago_mcm(movimiento_id)
    WHERE movimiento_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pago_mcm_delegacion_importe
    ON public.pago_mcm(delegacion_id, importe)
    WHERE estado = 'pendiente';

-- Trigger BEFORE UPDATE para mantener actualizado_en y sincronizar estado con movimiento_id
CREATE OR REPLACE FUNCTION public.set_pago_mcm_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = timezone('utc', now());

    -- Si se vincula a un movimiento, marca como pagado automáticamente
    -- (a menos que el caller esté forzando 'cancelado').
    IF NEW.movimiento_id IS NOT NULL AND NEW.estado NOT IN ('pagado', 'cancelado') THEN
        NEW.estado = 'pagado';
    END IF;

    -- Si se desvincula, vuelve a 'pendiente' (salvo borrador o cancelado explícitos)
    IF NEW.movimiento_id IS NULL AND OLD.movimiento_id IS NOT NULL AND NEW.estado = 'pagado' THEN
        NEW.estado = 'pendiente';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pago_mcm_actualizado_en ON public.pago_mcm;
CREATE TRIGGER trg_pago_mcm_actualizado_en
    BEFORE UPDATE ON public.pago_mcm
    FOR EACH ROW
    EXECUTE FUNCTION public.set_pago_mcm_actualizado_en();

-- Trigger BEFORE INSERT para coherencia inicial estado/movimiento_id
CREATE OR REPLACE FUNCTION public.set_pago_mcm_insert_defaults()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.movimiento_id IS NOT NULL AND NEW.estado NOT IN ('pagado', 'cancelado') THEN
        NEW.estado = 'pagado';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pago_mcm_insert_defaults ON public.pago_mcm;
CREATE TRIGGER trg_pago_mcm_insert_defaults
    BEFORE INSERT ON public.pago_mcm
    FOR EACH ROW
    EXECUTE FUNCTION public.set_pago_mcm_insert_defaults();

-- RLS
ALTER TABLE public.pago_mcm ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier miembro de la delegación (cualquier rol, incluida solo lectura)
CREATE POLICY "Users can view pagos_mcm of their delegations" ON public.pago_mcm
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.delegacion_id = pago_mcm.delegacion_id
              AND mb.usuario_id = auth.uid()
        )
    );

-- INSERT / UPDATE / DELETE: tesorero / gestor_central de la delegación o gestor_central global.
-- (solo_lectura sólo puede leer.)
CREATE POLICY "Users can insert pagos_mcm in their delegations" ON public.pago_mcm
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = pago_mcm.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR (mb.rol = 'gestor_central')
              )
        )
    );

CREATE POLICY "Users can update pagos_mcm in their delegations" ON public.pago_mcm
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = pago_mcm.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR (mb.rol = 'gestor_central')
              )
        )
    );

CREATE POLICY "Users can delete pagos_mcm in their delegations" ON public.pago_mcm
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = pago_mcm.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR (mb.rol = 'gestor_central')
              )
        )
    );

-- Vínculo inverso desde movimiento (relación 1-a-1 con pago_mcm)
ALTER TABLE public.movimiento
    ADD COLUMN IF NOT EXISTS pago_mcm_id UUID UNIQUE REFERENCES public.pago_mcm(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movimiento_pago_mcm
    ON public.movimiento(pago_mcm_id)
    WHERE pago_mcm_id IS NOT NULL;

COMMENT ON TABLE public.pago_mcm IS 'Pagos internos pendientes de transferencia (reembolsos, ayudas) vinculados a un contacto y, opcionalmente, a un movimiento bancario.';
COMMENT ON COLUMN public.pago_mcm.estado IS 'borrador | pendiente | pagado | cancelado. Pasa a pagado automáticamente al vincular movimiento_id.';
COMMENT ON COLUMN public.pago_mcm.tipo_calculo IS 'manual | gasolina_tickets | gasolina_km | gasolina_avanzado (este último deshabilitado en UI por ahora).';
COMMENT ON COLUMN public.movimiento.pago_mcm_id IS 'Pago MCM (1-a-1) que origina este movimiento o al que se concilia.';
