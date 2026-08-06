-- =============================================================================
-- 053 Enable Banking · verificación de setup
-- =============================================================================
-- Script de VERIFICACIÓN, no de reemplazo: asume que scripts/038 (schema) y
-- scripts/039 (cron) ya se aplicaron. Es seguro ejecutarlo solo, más de una
-- vez, y en cualquier momento después de esos dos — solo activa extensiones
-- (idempotente) y termina con un SELECT de diagnóstico, no toca tablas ni
-- reprograma el cron.
--
-- El secreto CRON_SECRET vive en Supabase Vault (`vault.decrypted_secrets`),
-- no en un setting de sesión de la base — ver scripts/056 para el porqué.
--
-- Uso: pégalo en Supabase → SQL Editor → Run, después de haber seguido
-- docs/ENABLE_BANKING.md §3.3–3.6. El resultado te dice qué falta.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Diagnóstico: ¿existe el secreto en Vault? + si el job de cron existe.
-- No se muestra nunca el valor completo del secreto (solo un prefijo), para
-- poder pegar este resultado en un ticket de soporte sin exponerlo.
SELECT
  EXISTS (
    SELECT 1 FROM vault.decrypted_secrets WHERE name = 'CRON_SECRET'
  ) AS cron_secret_configurado,
  (
    SELECT substring(decrypted_secret, 1, 6) || '...'
    FROM vault.decrypted_secrets
    WHERE name = 'CRON_SECRET'
  ) AS cron_secret_prefijo,
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
