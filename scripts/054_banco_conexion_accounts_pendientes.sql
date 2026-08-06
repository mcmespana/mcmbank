-- =============================================================================
-- 053 Enable Banking · cuentas pendientes de emparejar manualmente
-- =============================================================================
-- Cuando el callback de EB recibe varias cuentas y ninguna casa por IBAN con
-- la cuenta de MCM Bank, hoy se pierde la lista de accounts candidatos (solo
-- vivían en la request, nunca se persistían) y el usuario tiene que reautorizar
-- desde cero. Esta columna guarda esos candidatos para que un selector manual
-- en la UI pueda completar el enlace sin repetir el consentimiento SCA.
-- =============================================================================

ALTER TABLE public.banco_conexion
  ADD COLUMN IF NOT EXISTS accounts_pendientes JSONB;

COMMENT ON COLUMN public.banco_conexion.accounts_pendientes IS
  'Lista de accounts (EBAccountResource[]) devueltos por Enable Banking cuando ninguno hizo match automático por IBAN. Se limpia (NULL) tras el linkado manual.';
