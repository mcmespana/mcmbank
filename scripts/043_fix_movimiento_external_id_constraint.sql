-- ============================================================================
-- 043 · Fix dedup Enable Banking: ON CONFLICT no puede inferir índices parciales
-- ============================================================================
-- El upsert de sync (lib/enable-banking/sync.ts) usa
--   onConflict: "cuenta_id,external_id"
-- pero 038 creó un índice único PARCIAL (WHERE external_id IS NOT NULL).
-- PostgREST no envía el predicado del índice en la cláusula ON CONFLICT, así
-- que Postgres falla con:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Solución: constraint UNIQUE normal sobre (cuenta_id, external_id).
-- Los movimientos manuales tienen external_id NULL y los NULL no colisionan
-- entre sí en un UNIQUE de Postgres, así que el parcial era innecesario.
-- ============================================================================

DROP INDEX IF EXISTS public.idx_movimiento_external_id_unique;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'movimiento_cuenta_external_id_unique'
          AND conrelid = 'public.movimiento'::regclass
    ) THEN
        ALTER TABLE public.movimiento
            ADD CONSTRAINT movimiento_cuenta_external_id_unique
            UNIQUE (cuenta_id, external_id);
    END IF;
END $$;
