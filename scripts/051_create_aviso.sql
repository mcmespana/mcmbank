-- Avisos y tareas: apuntes cortos entre la oficina técnica (gestores centrales)
-- y cada delegación. Sirven para dejar constancia de lo que se ha tocado en la
-- contabilidad o de lo que queda pendiente, sin salir de la app.
--
-- Dos tipos:
--   - tarea  algo que hay que hacer; tiene estado pendiente/hecha
--   - nota   información breve ("hemos subido 3 facturas de Mercadona en julio")
--
-- Destinatario (a quién va dirigido):
--   - oficina_tecnica  a los gestores centrales
--   - delegacion       a los tesoreros de esa delegación
--
-- Aislamiento: un aviso pertenece SIEMPRE a una delegación. Los miembros de la
-- delegación A no ven nunca los avisos de la delegación B (ni los gestores
-- centrales que no sean miembros de esa delegación).
--
-- Las lecturas viven en aviso_lectura: una fila por (aviso, usuario) cuando ese
-- usuario lo ha leído. El indicador de "novedades" se calcula con su ausencia.

CREATE TABLE IF NOT EXISTS public.aviso (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegacion_id UUID NOT NULL REFERENCES public.delegacion(id) ON DELETE CASCADE,

    tipo TEXT NOT NULL CHECK (tipo IN ('tarea', 'nota')),
    contenido TEXT NOT NULL CHECK (char_length(btrim(contenido)) BETWEEN 1 AND 2000),
    -- Texto libre y corto para situar el aviso: "Hablar con David", "Lucía", ...
    referencia TEXT CHECK (referencia IS NULL OR char_length(referencia) <= 60),

    destinatario TEXT NOT NULL CHECK (destinatario IN ('oficina_tecnica', 'delegacion')),

    -- Para tareas: pendiente/hecha. Para notas, 'hecha' equivale a archivada.
    estado TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente', 'hecha')),
    completado_por UUID,
    completado_en TIMESTAMPTZ,

    -- Aviso por correo (Resend). Se rellena al pulsar "Notificar".
    notificado_en TIMESTAMPTZ,
    notificado_por UUID,

    creado_por UUID NOT NULL DEFAULT auth.uid(),
    creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

-- Listado principal del panel: por delegación, pendientes primero, recientes antes.
CREATE INDEX IF NOT EXISTS idx_aviso_delegacion_estado_creado
    ON public.aviso(delegacion_id, estado, creado_en DESC);

CREATE TABLE IF NOT EXISTS public.aviso_lectura (
    aviso_id UUID NOT NULL REFERENCES public.aviso(id) ON DELETE CASCADE,
    usuario_id UUID NOT NULL,
    leido_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
    PRIMARY KEY (aviso_id, usuario_id)
);

CREATE INDEX IF NOT EXISTS idx_aviso_lectura_usuario
    ON public.aviso_lectura(usuario_id);

-- Trigger: actualizado_en + coherencia de los campos de completado.
CREATE OR REPLACE FUNCTION public.set_aviso_actualizado_en()
RETURNS TRIGGER AS $$
BEGIN
    NEW.actualizado_en = timezone('utc', now());

    IF NEW.estado = 'hecha' AND OLD.estado <> 'hecha' THEN
        NEW.completado_en = timezone('utc', now());
        NEW.completado_por = COALESCE(NEW.completado_por, auth.uid());
    ELSIF NEW.estado = 'pendiente' AND OLD.estado = 'hecha' THEN
        NEW.completado_en = NULL;
        NEW.completado_por = NULL;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_aviso_actualizado_en ON public.aviso;
CREATE TRIGGER trg_aviso_actualizado_en
    BEFORE UPDATE ON public.aviso
    FOR EACH ROW
    EXECUTE FUNCTION public.set_aviso_actualizado_en();

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.aviso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aviso_lectura ENABLE ROW LEVEL SECURITY;

-- SELECT: cualquier miembro de la delegación (incluido solo lectura). La
-- pertenencia es la única puerta: nadie ve avisos de delegaciones ajenas.
DROP POLICY IF EXISTS "Ver avisos de mis delegaciones" ON public.aviso;
CREATE POLICY "Ver avisos de mis delegaciones" ON public.aviso
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.delegacion_id = aviso.delegacion_id
              AND mb.usuario_id = auth.uid()
        )
    );

-- INSERT: tesorero o gestor_central de esa delegación (o gestor_central global),
-- y siempre firmando con su propio usuario.
DROP POLICY IF EXISTS "Crear avisos en mis delegaciones" ON public.aviso;
CREATE POLICY "Crear avisos en mis delegaciones" ON public.aviso
    FOR INSERT
    WITH CHECK (
        creado_por = auth.uid()
        AND EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = aviso.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR mb.rol = 'gestor_central'
              )
        )
    );

-- UPDATE: mismos roles de escritura (marcar hecha, archivar, editar el texto).
DROP POLICY IF EXISTS "Actualizar avisos de mis delegaciones" ON public.aviso;
CREATE POLICY "Actualizar avisos de mis delegaciones" ON public.aviso
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = aviso.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR mb.rol = 'gestor_central'
              )
        )
    );

-- DELETE: solo el autor o un gestor central.
DROP POLICY IF EXISTS "Borrar avisos propios" ON public.aviso;
CREATE POLICY "Borrar avisos propios" ON public.aviso
    FOR DELETE
    USING (
        (
            creado_por = auth.uid()
            AND EXISTS (
                SELECT 1 FROM public.membresia mb
                WHERE mb.usuario_id = auth.uid()
                  AND mb.delegacion_id = aviso.delegacion_id
            )
        )
        OR (
            (SELECT public.is_gestor_central())
            AND EXISTS (
                SELECT 1 FROM public.membresia mb
                WHERE mb.usuario_id = auth.uid()
                  AND mb.delegacion_id = aviso.delegacion_id
            )
        )
    );

-- Lecturas: se ven las de cualquier aviso visible (para saber quién lo ha leído),
-- pero cada usuario solo puede marcar/desmarcar las suyas.
DROP POLICY IF EXISTS "Ver lecturas de avisos visibles" ON public.aviso_lectura;
CREATE POLICY "Ver lecturas de avisos visibles" ON public.aviso_lectura
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1
            FROM public.aviso a
            JOIN public.membresia mb ON mb.delegacion_id = a.delegacion_id
            WHERE a.id = aviso_lectura.aviso_id
              AND mb.usuario_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Marcar como leido" ON public.aviso_lectura;
CREATE POLICY "Marcar como leido" ON public.aviso_lectura
    FOR INSERT
    WITH CHECK (
        usuario_id = auth.uid()
        AND EXISTS (
            SELECT 1
            FROM public.aviso a
            JOIN public.membresia mb ON mb.delegacion_id = a.delegacion_id
            WHERE a.id = aviso_lectura.aviso_id
              AND mb.usuario_id = auth.uid()
        )
    );

DROP POLICY IF EXISTS "Desmarcar mis lecturas" ON public.aviso_lectura;
CREATE POLICY "Desmarcar mis lecturas" ON public.aviso_lectura
    FOR DELETE
    USING (usuario_id = auth.uid());

COMMENT ON TABLE public.aviso IS 'Avisos y tareas por delegación: apuntes cortos entre la oficina técnica y los tesoreros.';
COMMENT ON COLUMN public.aviso.tipo IS 'tarea (con estado pendiente/hecha) | nota (información breve).';
COMMENT ON COLUMN public.aviso.destinatario IS 'oficina_tecnica (gestores centrales) | delegacion (tesoreros de la delegación).';
COMMENT ON COLUMN public.aviso.referencia IS 'Texto libre y corto para situar el aviso: "Hablar con David", "Lucía"...';
COMMENT ON COLUMN public.aviso.estado IS 'pendiente | hecha. En notas, hecha equivale a archivada.';
COMMENT ON COLUMN public.aviso.notificado_en IS 'Fecha del último aviso por correo enviado con Resend.';
COMMENT ON TABLE public.aviso_lectura IS 'Una fila por (aviso, usuario) cuando ese usuario lo ha marcado como leído.';
