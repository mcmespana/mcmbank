-- =============================================================================
-- 052 Enable Banking · verificación de setup
-- =============================================================================
-- Script de VERIFICACIÓN, no de reemplazo: asume que scripts/038 (schema) y
-- scripts/039 (cron) ya se aplicaron. Es seguro ejecutarlo solo, más de una
-- vez, y en cualquier momento después de esos dos — solo activa extensiones
-- (idempotente) y termina con un SELECT de diagnóstico, no toca tablas ni
-- reprograma el cron.
--
-- Uso: pégalo en Supabase → SQL Editor → Run, después de haber seguido
-- docs/ENABLE_BANKING.md §3.3–3.6. El resultado te dice qué falta.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Diagnóstico: settings de sesión de cron + si el job existe.
-- No se muestra nunca el valor completo de app.mcmbank_cron_key (solo un
-- prefijo), para poder pegar este resultado en un ticket de soporte sin
-- exponer el secreto.
SELECT
  current_setting('app.mcmbank_url', true) IS NOT NULL AS mcmbank_url_configurado,
  current_setting('app.mcmbank_url', true) AS mcmbank_url,
  current_setting('app.mcmbank_cron_key', true) IS NOT NULL AS mcmbank_cron_key_configurado,
  CASE
    WHEN current_setting('app.mcmbank_cron_key', true) IS NULL THEN NULL
    ELSE substring(current_setting('app.mcmbank_cron_key', true), 1, 6) || '...'
  END AS mcmbank_cron_key_prefijo,
  EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'mcmbank_bank_sync_daily'
  ) AS cron_job_existe;

-- Detalle del job de cron (vacío si no se ha programado con scripts/039).
SELECT jobid, schedule, jobname, active
FROM cron.job
WHERE jobname = 'mcmbank_bank_sync_daily';

-- Últimas ejecuciones del job (vacío si nunca se ha ejecutado).
SELECT jrd.start_time, jrd.end_time, jrd.status, jrd.return_message
FROM cron.job_run_details jrd
JOIN cron.job j ON jrd.jobid = j.jobid
WHERE j.jobname = 'mcmbank_bank_sync_daily'
ORDER BY jrd.start_time DESC
LIMIT 5;
