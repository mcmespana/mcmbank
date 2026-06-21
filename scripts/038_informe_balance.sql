-- ============================================================
-- 038_informe_balance: campos económicos opcionales en informe
--   Aplicada vía MCP Supabase (apply_migration "038_informe_balance_fields").
--   Se conserva aquí para histórico del repo.
-- ============================================================

ALTER TABLE public.informe
  ADD COLUMN IF NOT EXISTS balance_anual numeric,
  ADD COLUMN IF NOT EXISTS disponible_final numeric;

COMMENT ON COLUMN public.informe.balance_anual IS 'Balance del año (ingresos - gastos) en €, opcional, informado a mano';
COMMENT ON COLUMN public.informe.disponible_final IS 'Disponible a final de año (saldo) en €, opcional, informado a mano';
