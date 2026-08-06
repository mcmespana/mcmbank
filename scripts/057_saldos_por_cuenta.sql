-- =============================================================================
-- 057: RPC de saldos por cuenta (arregla N+1 + truncado silencioso a 1000 filas)
-- =============================================================================
-- Problema: components/cuentas/cuentas-manager.tsx calculaba el saldo de cada
-- cuenta con una query por cuenta (`select importe from movimiento where
-- cuenta_id = ...`) y sumaba en el cliente. Dos defectos:
--
--   1. N+1: con 12 cuentas eran 12 round-trips.
--   2. Sin paginar: PostgREST corta la respuesta en `db-max-rows` (1000 por
--      defecto en Supabase). Al pasar de 1000 movimientos, la suma se calcula
--      sobre un subconjunto y el saldo sale MAL, sin ningún error visible.
--      En el momento de escribir esto la cuenta mayor tenía 548 movimientos,
--      así que el fallo era latente pero inevitable (las cuentas sincronizan
--      del banco automáticamente).
--
-- Solución: agregar en Postgres con SUM() y devolver una fila por cuenta.
-- Mismo guard de pertenencia que las demás RPCs de agregación (049).
--
-- Comportamiento preservado a propósito: se suman TODOS los movimientos de la
-- cuenta, incluidos los marcados `ignorado`, porque el saldo debe reflejar el
-- extracto real del banco. `ignorado` solo excluye de informes, no del saldo.
-- Se devuelven también las cuentas sin movimientos (saldo 0) vía LEFT JOIN,
-- igual que hacía el cliente.

CREATE OR REPLACE FUNCTION public.get_saldos_por_cuenta(p_delegacion_id uuid)
RETURNS TABLE(cuenta_id uuid, saldo numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM assert_delegacion_member(p_delegacion_id);
  RETURN QUERY
  SELECT c.id AS cuenta_id,
         COALESCE(SUM(m.importe), 0)::numeric AS saldo
  FROM cuenta c
  LEFT JOIN movimiento m ON m.cuenta_id = c.id
  WHERE c.delegacion_id = p_delegacion_id
  GROUP BY c.id;
END;
$$;

-- Igual que en 049: la API externa/anon no debe poder invocarla.
REVOKE EXECUTE ON FUNCTION public.get_saldos_por_cuenta(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.get_saldos_por_cuenta(uuid) TO authenticated;
