-- Crear tabla para gestionar archivos adjuntos a transacciones
CREATE TABLE IF NOT EXISTS public.movimiento_archivo (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    movimiento_id UUID NOT NULL REFERENCES public.movimiento(id) ON DELETE CASCADE,
    nombre_original TEXT NOT NULL,
    nombre_archivo TEXT NOT NULL,
    tipo_mime TEXT NOT NULL,
    tamaño_bytes INTEGER NOT NULL,
    bucket TEXT NOT NULL CHECK (bucket IN ('facturas', 'documentos')),
    path_storage TEXT NOT NULL,
    url_publica TEXT NOT NULL,
    es_factura BOOLEAN NOT NULL DEFAULT false,
    descripcion TEXT,
    subido_por UUID NOT NULL,
    subido_en TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(movimiento_id, path_storage)
);

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_movimiento_archivo_movimiento_id ON public.movimiento_archivo(movimiento_id);
CREATE INDEX IF NOT EXISTS idx_movimiento_archivo_bucket ON public.movimiento_archivo(bucket);
CREATE INDEX IF NOT EXISTS idx_movimiento_archivo_es_factura ON public.movimiento_archivo(es_factura);

-- RLS (Row Level Security)
ALTER TABLE public.movimiento_archivo ENABLE ROW LEVEL SECURITY;

-- Política para que los usuarios solo puedan ver archivos de sus propias delegaciones
CREATE POLICY "Users can view files from their delegations" ON public.movimiento_archivo
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.movimiento m
            JOIN public.cuenta c ON m.cuenta_id = c.id
            JOIN public.membresia mb ON c.delegacion_id = mb.delegacion_id
            WHERE m.id = movimiento_archivo.movimiento_id
            AND mb.usuario_id = auth.uid()
        )
    );

-- Política para que los usuarios solo puedan insertar archivos en transacciones de sus delegaciones
CREATE POLICY "Users can insert files to their delegations" ON public.movimiento_archivo
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.movimiento m
            JOIN public.cuenta c ON m.cuenta_id = c.id
            JOIN public.membresia mb ON c.delegacion_id = mb.delegacion_id
            WHERE m.id = movimiento_archivo.movimiento_id
            AND mb.usuario_id = auth.uid()
        )
    );

-- Política para que los usuarios solo puedan eliminar archivos de sus delegaciones
CREATE POLICY "Users can delete files from their delegations" ON public.movimiento_archivo
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.movimiento m
            JOIN public.cuenta c ON m.cuenta_id = c.id
            JOIN public.membresia mb ON c.delegacion_id = mb.delegacion_id
            WHERE m.id = movimiento_archivo.movimiento_id
            AND mb.usuario_id = auth.uid()
        )
    );
