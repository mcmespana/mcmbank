-- 074 — Las funciones de trigger de 071/072 no se pueden llamar por RPC
--
-- `revoke ... from anon, authenticated` no basta: en Postgres las funciones
-- nacen con EXECUTE para PUBLIC, y anon/authenticated lo heredan de ahí. El
-- linter de Supabase lo marcó al aplicar 071 y 072 en producción.
revoke execute on function public.mcm_movimiento_en_subvencion_no_se_borra() from public, anon, authenticated;
revoke execute on function public.mcm_subvencion_movimiento_reparto() from public, anon, authenticated;
