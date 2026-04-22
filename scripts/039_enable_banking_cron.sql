-- =============================================================================
-- 037 Enable Banking · cron nocturno
-- =============================================================================
-- Programa un job pg_cron que ejecuta la sincronización bancaria cada día a
-- las 06:00 UTC (≈ 07:00 España en invierno / 08:00 en verano).
--
-- Requisitos previos (ejecutar una vez desde Database → Extensions):
--     create extension if not exists pg_cron;
--     create extension if not exists pg_net;
--
-- Variables que debes configurar ANTES de aplicar esta migración (como
-- superuser, desde SQL Editor):
--     alter database postgres set app.mcmbank_url       = 'https://<tu-dominio>';
--     alter database postgres set app.mcmbank_cron_key  = '<CRON_SECRET>';
--
-- Genera CRON_SECRET con: openssl rand -hex 32
-- Y mete el MISMO valor en Vercel como variable CRON_SECRET.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- -----------------------------------------------------------------------------
-- Helper: wrapper que llama a la ruta /api/bank-sync/run
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.trigger_bank_sync_cron()
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_url TEXT := current_setting('app.mcmbank_url', true);
    v_key TEXT := current_setting('app.mcmbank_cron_key', true);
    v_request_id BIGINT;
BEGIN
    IF v_url IS NULL OR v_key IS NULL THEN
        RAISE EXCEPTION 'app.mcmbank_url / app.mcmbank_cron_key no configurados';
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


-- -----------------------------------------------------------------------------
-- Programación del job
-- -----------------------------------------------------------------------------
-- Primero desactivamos cualquier job existente con el mismo nombre (idempotente).
SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'mcmbank_bank_sync_daily';

-- Programa nuevo: 06:00 UTC todos los días.
SELECT cron.schedule(
    'mcmbank_bank_sync_daily',
    '0 6 * * *',
    $$SELECT public.trigger_bank_sync_cron();$$
);

-- Para ver estado:
--     SELECT * FROM cron.job WHERE jobname = 'mcmbank_bank_sync_daily';
--     SELECT * FROM cron.job_run_details WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'mcmbank_bank_sync_daily') ORDER BY start_time DESC LIMIT 10;
