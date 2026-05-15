-- Crear tabla de contactos: directorio reutilizable por delegación con 3 tipos:
--   - proveedor: empresa o autónomo que nos factura
--   - persona_mcm: socio, voluntario, monitor, miembro de equipo (reembolsable)
--   - destinatario_mcm: destinatario final de actividades o su familia (origen de ingresos)
-- Incluye soporte para contactos globales (compartidos por toda la organización),
-- solo creables por usuarios con rol gestor_central.

CREATE TABLE IF NOT EXISTS public.contacto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegacion_id UUID REFERENCES public.delegacion(id) ON DELETE CASCADE,
    es_global BOOLEAN NOT NULL DEFAULT false,
    tipo TEXT NOT NULL CHECK (tipo IN ('proveedor', 'persona_mcm', 'destinatario_mcm')),
    nombre TEXT NOT NULL,
    emoji TEXT,
    color TEXT,
    identificador_fiscal TEXT,
    iban TEXT,
    email TEXT,
    telefono TEXT,
    direccion TEXT,
    ciudad TEXT,
    codigo_postal TEXT,
    categoria_id_predeterminada UUID REFERENCES public.categoria(id) ON DELETE SET NULL,
    notas TEXT,
    archivado BOOLEAN NOT NULL DEFAULT false,
    creado_por UUID,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

    -- Un contacto es global (sin delegación) o de delegación (con delegación), pero no ambos
    CONSTRAINT contacto_scope_chk CHECK (
        (es_global = true AND delegacion_id IS NULL)
        OR (es_global = false AND delegacion_id IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_contacto_delegacion_tipo ON public.contacto(delegacion_id, tipo);
CREATE INDEX IF NOT EXISTS idx_contacto_delegacion_archivado_nombre ON public.contacto(delegacion_id, archivado, nombre);
CREATE INDEX IF NOT EXISTS idx_contacto_es_global ON public.contacto(es_global) WHERE es_global = true;
CREATE INDEX IF NOT EXISTS idx_contacto_categoria_pred ON public.contacto(categoria_id_predeterminada) WHERE categoria_id_predeterminada IS NOT NULL;

-- Trigger BEFORE UPDATE para mantener actualizado_en
CREATE OR REPLACE FUNCTION public.set_contacto_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = timezone('utc', now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_contacto_actualizado_en ON public.contacto;
CREATE TRIGGER trg_contacto_actualizado_en
    BEFORE UPDATE ON public.contacto
    FOR EACH ROW
    EXECUTE FUNCTION public.set_contacto_actualizado_en();

-- RLS
ALTER TABLE public.contacto ENABLE ROW LEVEL SECURITY;

-- SELECT: contactos de mis delegaciones o globales (visibles a cualquier usuario autenticado con membresía)
CREATE POLICY "Users can view contactos in their delegations or globals" ON public.contacto
    FOR SELECT
    USING (
        es_global = true
        OR EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.delegacion_id = contacto.delegacion_id
              AND mb.usuario_id = auth.uid()
        )
    );

-- INSERT: contactos de delegación si soy miembro; globales solo si soy gestor_central en alguna delegación
CREATE POLICY "Users can insert contactos in their delegations" ON public.contacto
    FOR INSERT
    WITH CHECK (
        (es_global = false AND EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.delegacion_id = contacto.delegacion_id
              AND mb.usuario_id = auth.uid()
        ))
        OR (es_global = true AND EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND mb.rol = 'gestor_central'
        ))
    );

-- UPDATE: mismas reglas
CREATE POLICY "Users can update contactos in their delegations" ON public.contacto
    FOR UPDATE
    USING (
        (es_global = false AND EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.delegacion_id = contacto.delegacion_id
              AND mb.usuario_id = auth.uid()
        ))
        OR (es_global = true AND EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND mb.rol = 'gestor_central'
        ))
    );

-- DELETE: mismas reglas
CREATE POLICY "Users can delete contactos in their delegations" ON public.contacto
    FOR DELETE
    USING (
        (es_global = false AND EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.delegacion_id = contacto.delegacion_id
              AND mb.usuario_id = auth.uid()
        ))
        OR (es_global = true AND EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND mb.rol = 'gestor_central'
        ))
    );

-- Añadir vínculo opcional desde movimiento a contacto
ALTER TABLE public.movimiento
    ADD COLUMN IF NOT EXISTS contacto_id UUID REFERENCES public.contacto(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_movimiento_contacto_id
    ON public.movimiento(contacto_id)
    WHERE contacto_id IS NOT NULL;

COMMENT ON TABLE public.contacto IS 'Directorio de contactos: proveedores, personas MCM (reembolsables) y destinatarios MCM (origen de ingresos).';
COMMENT ON COLUMN public.contacto.es_global IS 'Si true, contacto global visible y editable por gestores centrales. Si false, scope por delegacion_id.';
COMMENT ON COLUMN public.contacto.tipo IS 'proveedor | persona_mcm | destinatario_mcm';
COMMENT ON COLUMN public.contacto.categoria_id_predeterminada IS 'Categoría sugerida al crear un movimiento vinculado a este contacto.';
COMMENT ON COLUMN public.movimiento.contacto_id IS 'Contacto opcional vinculado al movimiento (sustituye al texto libre contraparte).';
