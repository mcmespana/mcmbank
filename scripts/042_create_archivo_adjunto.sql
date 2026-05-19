-- Tabla polimórfica para archivos adjuntos.
--
-- Se usa para Pagos MCM (entidad='pago_mcm') y en el futuro puede extenderse
-- a otras entidades sin crear más tablas.
--
-- NOTA: deliberadamente NO tocamos la tabla movimiento_archivo. Los archivos
-- de movimientos siguen viviendo allí sin cambios (cero riesgo de regresión).
-- Cuando un Pago MCM se convierte/vincula a un movimiento, replicamos la
-- fila en movimiento_archivo apuntando al mismo path de Storage, de modo
-- que la UI existente sigue mostrándolos sin tocar ni una línea.

CREATE TABLE IF NOT EXISTS public.archivo_adjunto (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entidad TEXT NOT NULL CHECK (entidad IN ('pago_mcm', 'movimiento')),
    entidad_id UUID NOT NULL,
    delegacion_id UUID NOT NULL REFERENCES public.delegacion(id) ON DELETE CASCADE,

    nombre_original TEXT NOT NULL,
    nombre_archivo TEXT NOT NULL,
    tipo_mime TEXT NOT NULL,
    -- Usamos "tamano_bytes" (sin ñ) porque movimiento_archivo usa "tamaño_bytes"
    -- y mejor evitar caracteres no-ASCII en nombres de columnas nuevas.
    tamano_bytes INTEGER NOT NULL,
    bucket TEXT NOT NULL CHECK (bucket IN ('facturas', 'documentos')),
    path_storage TEXT NOT NULL,
    url_publica TEXT NOT NULL,
    es_factura BOOLEAN NOT NULL DEFAULT false,
    descripcion TEXT,
    subido_por UUID NOT NULL,
    subido_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),

    UNIQUE (entidad, entidad_id, path_storage)
);

CREATE INDEX IF NOT EXISTS idx_archivo_adjunto_entidad
    ON public.archivo_adjunto(entidad, entidad_id);

CREATE INDEX IF NOT EXISTS idx_archivo_adjunto_delegacion
    ON public.archivo_adjunto(delegacion_id);

-- RLS
ALTER TABLE public.archivo_adjunto ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier miembro de la delegación a la que pertenece el adjunto.
CREATE POLICY "Users can view archivos in their delegations" ON public.archivo_adjunto
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.delegacion_id = archivo_adjunto.delegacion_id
              AND mb.usuario_id = auth.uid()
        )
    );

-- INSERT/UPDATE/DELETE: gestores de la delegación (tesorero/gestor_central) o
-- gestor_central global.
CREATE POLICY "Users can insert archivos in their delegations" ON public.archivo_adjunto
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = archivo_adjunto.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR (mb.rol = 'gestor_central')
              )
        )
    );

CREATE POLICY "Users can update archivos in their delegations" ON public.archivo_adjunto
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = archivo_adjunto.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR (mb.rol = 'gestor_central')
              )
        )
    );

CREATE POLICY "Users can delete archivos in their delegations" ON public.archivo_adjunto
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = archivo_adjunto.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR (mb.rol = 'gestor_central')
              )
        )
    );

COMMENT ON TABLE public.archivo_adjunto IS 'Adjuntos polimorficos para pago_mcm (y, en el futuro, otras entidades). Para movimientos seguimos usando movimiento_archivo por compatibilidad.';
COMMENT ON COLUMN public.archivo_adjunto.entidad IS 'pago_mcm | movimiento. Hoy solo se inserta pago_mcm; movimiento queda reservado para una futura unificacion.';
