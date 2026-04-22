-- =============================================================================
-- 036 Enable Banking schema
-- =============================================================================
-- Integración con Enable Banking (PSD2 AIS) para sincronización automática de
-- movimientos bancarios.
--
-- Añade:
--   1. Tabla banco_conexion    → una sesión autorizada en EB (session_id,
--      consentimiento, ventana de validez).
--   2. Campos en cuenta         → link a la conexión + flag sync_enabled +
--      metadatos del account remoto (uid + identification_hash).
--   3. Campos en movimiento     → external_id (+ fuente), booking_date,
--      value_date. Índice único parcial para dedup.
--   4. Tabla banco_sync_log    → histórico de ejecuciones (debug + telemetría).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabla banco_conexion
-- -----------------------------------------------------------------------------
-- Una fila por cada sesión autorizada. Una conexión puede estar asociada a una
-- o varias cuentas (el usuario, al autorizar en el banco, a veces concede
-- acceso a todas sus cuentas a la vez).
CREATE TABLE IF NOT EXISTS public.banco_conexion (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    delegacion_id UUID NOT NULL REFERENCES public.delegacion(id) ON DELETE CASCADE,

    -- Metadatos del ASPSP (banco)
    proveedor TEXT NOT NULL DEFAULT 'enablebanking',
    aspsp_name TEXT NOT NULL,
    aspsp_country TEXT NOT NULL,
    psu_type TEXT NOT NULL DEFAULT 'business',

    -- IDs que nos devuelve Enable Banking
    authorization_id TEXT,         -- devuelto por POST /auth
    session_id TEXT UNIQUE,        -- devuelto por POST /sessions
    psu_id_hash TEXT,

    -- Ventana de validez del consentimiento
    consent_valid_until TIMESTAMPTZ NOT NULL,

    -- Estado operacional
    estado TEXT NOT NULL DEFAULT 'autorizada'
        CHECK (estado IN ('pendiente', 'autorizada', 'expirada', 'revocada', 'error')),
    ultimo_error TEXT,

    -- Auditoría
    creado_por UUID NOT NULL,
    creado_en TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    actualizado_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_banco_conexion_delegacion ON public.banco_conexion(delegacion_id);
CREATE INDEX IF NOT EXISTS idx_banco_conexion_estado ON public.banco_conexion(estado);
CREATE INDEX IF NOT EXISTS idx_banco_conexion_valid_until ON public.banco_conexion(consent_valid_until);

ALTER TABLE public.banco_conexion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view bank connections of their delegations"
    ON public.banco_conexion FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.membresia m
        WHERE m.delegacion_id = banco_conexion.delegacion_id
          AND m.usuario_id = auth.uid()
    ));

CREATE POLICY "Users manage bank connections of their delegations"
    ON public.banco_conexion FOR ALL
    USING (EXISTS (
        SELECT 1 FROM public.membresia m
        WHERE m.delegacion_id = banco_conexion.delegacion_id
          AND m.usuario_id = auth.uid()
          AND m.rol IN ('gestor_central', 'tesorero')
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM public.membresia m
        WHERE m.delegacion_id = banco_conexion.delegacion_id
          AND m.usuario_id = auth.uid()
          AND m.rol IN ('gestor_central', 'tesorero')
    ));


-- -----------------------------------------------------------------------------
-- 2. Ampliación de cuenta
-- -----------------------------------------------------------------------------
ALTER TABLE public.cuenta
    ADD COLUMN IF NOT EXISTS banco_conexion_id UUID REFERENCES public.banco_conexion(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS external_account_uid TEXT,
    ADD COLUMN IF NOT EXISTS external_account_hash TEXT,
    ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS last_sync_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_sync_status TEXT,
    ADD COLUMN IF NOT EXISTS last_sync_error TEXT,
    ADD COLUMN IF NOT EXISTS sync_desde_fecha DATE;
    -- sync_desde_fecha: fecha mínima para traer históricos en el primer sync.
    -- null → lo decide la ruta (por defecto 90 días atrás).

-- Una cuenta concreta solo puede estar ligada a UN uid remoto a la vez
CREATE UNIQUE INDEX IF NOT EXISTS idx_cuenta_external_uid_unique
    ON public.cuenta(banco_conexion_id, external_account_uid)
    WHERE external_account_uid IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_cuenta_external_hash ON public.cuenta(external_account_hash)
    WHERE external_account_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_cuenta_sync_enabled ON public.cuenta(sync_enabled) WHERE sync_enabled = true;


-- -----------------------------------------------------------------------------
-- 3. Ampliación de movimiento
-- -----------------------------------------------------------------------------
ALTER TABLE public.movimiento
    ADD COLUMN IF NOT EXISTS external_id TEXT,
    ADD COLUMN IF NOT EXISTS external_id_source TEXT
        CHECK (external_id_source IN ('transaction_id', 'entry_reference', 'composite_hash')),
    ADD COLUMN IF NOT EXISTS booking_date DATE,
    ADD COLUMN IF NOT EXISTS value_date DATE,
    ADD COLUMN IF NOT EXISTS origen_sync TEXT
        CHECK (origen_sync IN ('manual', 'import_excel', 'enablebanking'));

-- Índice único compuesto por (cuenta_id, external_id). Parcial: solo aplica a
-- movimientos con origen sync. Permite insertar múltiples movimientos manuales
-- sin external_id sin colisionar.
CREATE UNIQUE INDEX IF NOT EXISTS idx_movimiento_external_id_unique
    ON public.movimiento(cuenta_id, external_id)
    WHERE external_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_movimiento_booking_date ON public.movimiento(booking_date)
    WHERE booking_date IS NOT NULL;


-- -----------------------------------------------------------------------------
-- 4. Tabla banco_sync_log
-- -----------------------------------------------------------------------------
-- Una fila por invocación de sync (cron o manual). Guarda el log verbose para
-- que el usuario pueda inspeccionarlo desde el UI sin tener que reproducir.
CREATE TABLE IF NOT EXISTS public.banco_sync_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    cuenta_id UUID REFERENCES public.cuenta(id) ON DELETE CASCADE,
    banco_conexion_id UUID REFERENCES public.banco_conexion(id) ON DELETE SET NULL,

    trigger TEXT NOT NULL CHECK (trigger IN ('cron', 'manual')),
    iniciado_por UUID,   -- usuario si trigger=manual

    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duracion_ms INTEGER,

    date_from DATE,
    date_to DATE,

    transacciones_recibidas INTEGER NOT NULL DEFAULT 0,
    transacciones_insertadas INTEGER NOT NULL DEFAULT 0,
    transacciones_duplicadas INTEGER NOT NULL DEFAULT 0,
    transacciones_error INTEGER NOT NULL DEFAULT 0,

    estado TEXT NOT NULL DEFAULT 'en_curso'
        CHECK (estado IN ('en_curso', 'ok', 'error', 'parcial')),
    error_mensaje TEXT,

    -- Log verbose estructurado. Array de pasos con timestamp, nivel, mensaje y payload.
    -- Ejemplo de step: {"t":"2026-04-22T06:00:01Z","level":"info","msg":"JWT generado","data":{...}}
    log JSONB NOT NULL DEFAULT '[]'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_banco_sync_log_cuenta ON public.banco_sync_log(cuenta_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_banco_sync_log_started ON public.banco_sync_log(started_at DESC);

ALTER TABLE public.banco_sync_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view sync logs of their delegations"
    ON public.banco_sync_log FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.cuenta c
        JOIN public.membresia m ON m.delegacion_id = c.delegacion_id
        WHERE c.id = banco_sync_log.cuenta_id
          AND m.usuario_id = auth.uid()
    ));

-- INSERT/UPDATE solo desde el service role (las rutas API usan admin client)
CREATE POLICY "Service role manages sync logs"
    ON public.banco_sync_log FOR ALL
    USING (auth.jwt()->>'role' = 'service_role')
    WITH CHECK (auth.jwt()->>'role' = 'service_role');


-- -----------------------------------------------------------------------------
-- 5. Trigger para mantener actualizado_en en banco_conexion
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_actualizado_en()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.actualizado_en = NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_banco_conexion_touch ON public.banco_conexion;
CREATE TRIGGER trg_banco_conexion_touch
    BEFORE UPDATE ON public.banco_conexion
    FOR EACH ROW EXECUTE FUNCTION public.touch_actualizado_en();
