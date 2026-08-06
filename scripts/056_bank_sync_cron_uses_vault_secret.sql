-- =============================================================================
-- 056: documentar (y re-versionar) que trigger_bank_sync_cron ya usa Vault
-- =============================================================================
-- HALLAZGO al revisar el proyecto en vivo el 2026-08-06: la función
-- `trigger_bank_sync_cron()` que hoy corre en producción NO coincide con
-- `scripts/039_enable_banking_cron.sql` — en algún momento se editó
-- directamente en el SQL Editor de Supabase (fuera de una migración
-- rastreada, mismo "reproducibility gap" ya señalado en plans/README.md
-- para las políticas RLS) para leer `CRON_SECRET` desde Supabase Vault
-- (`vault.decrypted_secrets`) en vez de `current_setting('app.mcmbank_cron_key')`.
--
-- Confirmado en vivo: `current_setting('app.mcmbank_cron_key', true)` es
-- NULL — el `ALTER DATABASE postgres SET app.mcmbank_cron_key = ...` de
-- docs/ENABLE_BANKING.md §3.5 nunca se aplicó (o se revirtió) y no hace
-- falta: el secreto vive únicamente en Vault, con nombre 'CRON_SECRET'.
--
-- Esto es una MEJORA de seguridad respecto al diseño original (el secreto
-- ya no vive en un setting de sesión de la base, sino cifrado en Vault) —
-- este script solo la deja rastreada en el repo, sin cambiar el
-- comportamiento en vivo (CREATE OR REPLACE con el mismo cuerpo exacto que
-- ya está desplegado).
--
-- docs/ENABLE_BANKING.md §3.5 y scripts/053 se han actualizado en el mismo
-- commit para dejar de mencionar el `ALTER DATABASE SET` obsoleto.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.trigger_bank_sync_cron()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, net, vault, pg_temp
AS $$
DECLARE
    -- La URL no es secreta (dominio público). El CRON_SECRET vive cifrado en
    -- Supabase Vault, NO en el cuerpo de la función.
    v_url TEXT := 'https://bank.movimientoconsolacion.com';
    v_key TEXT;
    v_request_id BIGINT;
BEGIN
    SELECT decrypted_secret INTO v_key
    FROM vault.decrypted_secrets
    WHERE name = 'CRON_SECRET';

    IF v_key IS NULL OR v_key = '' THEN
        RAISE EXCEPTION 'No se encontró el secreto CRON_SECRET en Vault';
    END IF;

    SELECT net.http_post(
        url := v_url || '/api/bank-sync/run',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_key
        ),
        body := jsonb_build_object('trigger', 'cron'),
        timeout_milliseconds := 55000
    ) INTO v_request_id;

    RETURN v_request_id;
END;
$$;
