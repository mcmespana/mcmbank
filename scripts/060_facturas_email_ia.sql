-- =============================================================================
-- 060: Buzón de facturas por delegación + lectura automática con IA
-- =============================================================================
-- Plan: plans/022-facturas-por-email-y-lectura-con-ia.md
--
-- Tres cosas, todas aditivas (ninguna rompe nada existente):
--
-- a) delegacion.alias_email — la etiqueta con la que una delegación recibe sus
--    facturas por correo: facturas+castellon@movimientoconsolacion.com. No se
--    reutiliza `codigo` porque los códigos reales son MCM-CS / MCM-BLO y lo que
--    se quiere escribir en el correo es "castellon"; además un cambio de código
--    no debe invalidar un buzón que la gente ya tenga guardado.
--
-- b) factura.categoria_id — dónde aterriza la sugerencia de categoría de la IA
--    una vez que una persona la acepta. La ausencia de esta columna es la
--    "desviación documentada" de la fase 2 del plan 021. Al conciliar, se
--    propaga al movimiento (que es donde la categoría cuenta para los
--    informes), igual que ya se propaga el contacto.
--
-- c) factura_email — registro de cada correo entrante. Sirve para tres cosas:
--    idempotencia (Resend reintenta los webhooks), diagnóstico ("mandé la
--    factura y no aparece") y para poder decidir más adelante, con datos, si
--    hace falta una lista blanca de remitentes.
--
-- Rollback: al final del archivo, comentado.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- a) Alias de correo por delegación
-- ---------------------------------------------------------------------------

ALTER TABLE public.delegacion
    ADD COLUMN IF NOT EXISTS alias_email TEXT;

COMMENT ON COLUMN public.delegacion.alias_email IS
    'Etiqueta del buzón de facturas de esta delegación: facturas+<alias_email>@dominio. Minúsculas, [a-z0-9-]. Ver plans/022 y docs/FACTURAS_EMAIL_IA.md.';

-- Slug a partir del nombre: sin acentos, sin el prefijo "MCM"/"-T" y sin las
-- palabras de relleno que ya ignora resolveDelegacion() en lib/api/delegaciones.ts.
CREATE OR REPLACE FUNCTION public.slug_alias_email(p_nombre TEXT)
RETURNS TEXT
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    t TEXT;
BEGIN
    t := lower(coalesce(p_nombre, ''));
    -- Acentos y eñe fuera (sin depender de la extensión unaccent).
    t := translate(t, 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc');
    -- Apóstrofes catalanes: "l'alcora" → "alcora", "d'en" → "en".
    t := regexp_replace(t, '\m[ld]''', '', 'g');
    -- Palabras de relleno.
    t := regexp_replace(t, '\m(mcm|delegacion|de|del|la|el)\M', ' ', 'g');
    -- Todo lo que no sea alfanumérico pasa a guion, y se colapsa.
    t := regexp_replace(t, '[^a-z0-9]+', '-', 'g');
    t := regexp_replace(t, '-{2,}', '-', 'g');
    t := trim(both '-' from t);
    RETURN nullif(t, '');
END;
$$;

COMMENT ON FUNCTION public.slug_alias_email(TEXT) IS
    'Convierte el nombre de una delegación en su alias de correo por defecto. Solo se usa al sembrar/añadir delegaciones; el alias definitivo es editable.';

-- Sembrado: solo rellena las que estén a NULL, y desempata con sufijo numérico
-- si dos nombres colapsan al mismo slug.
DO $$
DECLARE
    fila RECORD;
    candidato TEXT;
    intento INT;
BEGIN
    FOR fila IN
        SELECT id, nombre, codigo
        FROM public.delegacion
        WHERE alias_email IS NULL
        ORDER BY nombre
    LOOP
        candidato := public.slug_alias_email(fila.nombre);
        -- Si el nombre no da nada usable, se cae al código.
        IF candidato IS NULL THEN
            candidato := public.slug_alias_email(coalesce(fila.codigo, ''));
        END IF;
        IF candidato IS NULL THEN
            candidato := replace(fila.id::text, '-', '');
        END IF;

        intento := 1;
        WHILE EXISTS (SELECT 1 FROM public.delegacion WHERE alias_email = candidato) LOOP
            intento := intento + 1;
            candidato := public.slug_alias_email(fila.nombre) || '-' || intento::text;
        END LOOP;

        UPDATE public.delegacion SET alias_email = candidato WHERE id = fila.id;
    END LOOP;
END;
$$;

-- Único e insensible a mayúsculas (el alias siempre se guarda ya en minúsculas,
-- pero el índice lo garantiza aunque alguien edite a mano).
CREATE UNIQUE INDEX IF NOT EXISTS idx_delegacion_alias_email
    ON public.delegacion (lower(alias_email))
    WHERE alias_email IS NOT NULL;

-- El formato se comprueba también en base de datos: un alias con un '@' o un
-- espacio dentro haría que la dirección resultante no existiera.
ALTER TABLE public.delegacion DROP CONSTRAINT IF EXISTS delegacion_alias_email_chk;
ALTER TABLE public.delegacion
    ADD CONSTRAINT delegacion_alias_email_chk
    CHECK (alias_email IS NULL OR alias_email ~ '^[a-z0-9][a-z0-9-]{1,40}$');

-- ---------------------------------------------------------------------------
-- b) Categoría de la factura (destino de la sugerencia aceptada)
-- ---------------------------------------------------------------------------

ALTER TABLE public.factura
    ADD COLUMN IF NOT EXISTS categoria_id UUID REFERENCES public.categoria(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_factura_categoria
    ON public.factura(categoria_id)
    WHERE categoria_id IS NOT NULL;

COMMENT ON COLUMN public.factura.categoria_id IS
    'Categoría de la factura. La sugiere la IA en datos_ia, pero solo llega aquí cuando una persona la acepta; al conciliar se propaga al movimiento si este no tiene categoría.';

-- ---------------------------------------------------------------------------
-- c) Registro de correos entrantes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.factura_email (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- NULL cuando no se ha podido averiguar a qué delegación iba dirigido.
    delegacion_id UUID REFERENCES public.delegacion(id) ON DELETE SET NULL,

    -- Id del correo en Resend: la clave de idempotencia (los webhooks se
    -- reintentan, y un reintento no puede duplicar facturas).
    proveedor_email_id TEXT NOT NULL UNIQUE,
    message_id TEXT,

    remitente TEXT,
    destinatarios JSONB,
    asunto TEXT,
    alias_detectado TEXT,

    estado TEXT NOT NULL DEFAULT 'procesado'
        CHECK (estado IN ('procesado', 'sin_delegacion', 'sin_adjuntos', 'error', 'ignorado')),
    error TEXT,
    facturas_creadas INT NOT NULL DEFAULT 0,
    -- Extracto del cuerpo (recortado): sin él, un "no me aparece la factura"
    -- no hay forma de diagnosticarlo.
    cuerpo_extracto TEXT,

    recibido_en TIMESTAMPTZ,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

CREATE INDEX IF NOT EXISTS idx_factura_email_delegacion_creado
    ON public.factura_email(delegacion_id, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_factura_email_estado
    ON public.factura_email(estado, creado_en DESC);

COMMENT ON TABLE public.factura_email IS
    'Correos recibidos en el buzón de facturas. Idempotencia del webhook, diagnóstico y trazabilidad del remitente.';

ALTER TABLE public.factura_email ENABLE ROW LEVEL SECURITY;

-- Solo lectura, y solo para la oficina técnica: es un registro de operación,
-- no un dato de la delegación. La escritura la hace el service role (el
-- webhook), que no pasa por RLS.
DROP POLICY IF EXISTS "Gestores centrales can view factura_email" ON public.factura_email;
CREATE POLICY "Gestores centrales can view factura_email" ON public.factura_email
    FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND mb.rol = 'gestor_central'
        )
    );

-- ---------------------------------------------------------------------------
-- Verificación rápida (ejecutar a mano tras aplicar)
-- ---------------------------------------------------------------------------
-- SELECT codigo, nombre, alias_email FROM public.delegacion ORDER BY nombre;
-- SELECT count(*) FROM public.delegacion WHERE alias_email IS NULL;  -- debe ser 0

-- ---------------------------------------------------------------------------
-- Rollback
-- ---------------------------------------------------------------------------
-- DROP TABLE IF EXISTS public.factura_email;
-- DROP INDEX IF EXISTS public.idx_factura_categoria;
-- ALTER TABLE public.factura DROP COLUMN IF EXISTS categoria_id;
-- ALTER TABLE public.delegacion DROP CONSTRAINT IF EXISTS delegacion_alias_email_chk;
-- DROP INDEX IF EXISTS public.idx_delegacion_alias_email;
-- ALTER TABLE public.delegacion DROP COLUMN IF EXISTS alias_email;
-- DROP FUNCTION IF EXISTS public.slug_alias_email(TEXT);
