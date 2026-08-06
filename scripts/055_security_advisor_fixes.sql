-- =============================================================================
-- 055: fixes de advisors de seguridad (aplicados en producción vía MCP)
-- =============================================================================
-- APLICADA en producción el 2026-08-06 (3 migraciones vía MCP apply_migration:
-- fix_function_search_path_mutable, move_pg_net_extension_out_of_public
-- (falló, ver nota abajo), revoke_unintended_rpc_exposure). Se conserva aquí
-- para histórico del repo, como ya hacen 049/050.
--
-- 1. function_search_path_mutable (WARN, 6 funciones): ninguna fijaba
--    search_path, dejándolas expuestas a hijacking de resolución de nombres
--    sin cualificar si alguien lograra alterar el search_path de la sesión.
--
-- 2. extension_in_public (WARN, pg_net): NO SE PUDO MOVER — Postgres
--    rechaza `ALTER EXTENSION pg_net SET SCHEMA net` con "cannot move
--    extension into schema net because the extension contains the schema"
--    (pg_net crea su propio schema `net` como parte de la extensión; no se
--    puede reubicar la extensión dentro de un schema que ella misma posee).
--    Sus funciones (net.http_post, etc.) ya viven en `net`, no en `public`
--    — es solo el registro de la extensión el que apunta a `public`. Bajo
--    riesgo real, no accionable sin recrear la extensión (arriesgado). Se
--    deja así a propósito.
--
-- 3. anon/authenticated_security_definer_function_executable (WARN, 17
--    entradas): revocado EXECUTE de anon/authenticated en 3 funciones que
--    nunca debían ser invocables directamente vía /rest/v1/rpc/*:
--      - trigger_bank_sync_cron(): solo pg_cron debe invocarla (lo hace vía
--        SQL directo, sin pasar por PostgREST, así que el revoke no afecta
--        al cron). Antes, cualquiera podía forzar una sincronización
--        bancaria completa llamando al RPC sin autenticarse.
--      - handle_new_user(): trigger de auth.users; llamarla fuera de
--        contexto de trigger fallaría (NEW indefinido), pero no tenía
--        motivo para ser alcanzable por RPC.
--      - assert_delegacion_member(uuid): helper interno, llamado vía
--        PERFORM desde otros RPCs SECURITY DEFINER (get_financial_summary,
--        get_category_breakdown, get_monthly_trend,
--        get_cuenta_con_mas_movimientos, get_facturas_resumen,
--        get_pagos_mcm_resumen). Esas llamadas internas se ejecutan con los
--        privilegios del propietario de la función que las contiene (por
--        SECURITY DEFINER), no con los del rol original — revocar el grant
--        directo no las rompe. Confirmado que NINGUNA política RLS lo
--        referencia (a diferencia de is_gestor_central(), que sí se usa en
--        ~15 políticas RLS y se ha dejado intacto a propósito: revocarle a
--        `authenticated` habría roto la evaluación de RLS para todo
--        usuario autenticado).
--    Las 6 funciones get_*/RPC de agregación (get_financial_summary,
--    get_category_breakdown, get_monthly_trend, get_cuenta_con_mas_movimientos,
--    get_facturas_resumen, get_pagos_mcm_resumen) SÍ deben seguir siendo
--    ejecutables por authenticated (las usa la app vía supabase.rpc(...))
--    y ya llaman a assert_delegacion_member() internamente — confirmado que
--    NO son vulnerables, solo aparecían en el advisor porque son
--    "ejecutables", no porque falte el guard de pertenencia.
--
-- No accionados (fuera de alcance de una migración SQL, requieren el
-- dashboard de Supabase o una ventana de mantenimiento):
--   - auth_leaked_password_protection (WARN): toggle de Auth, se activa
--     desde Authentication → Policies en el dashboard.
--   - vulnerable_postgres_version (WARN): supabase-postgres-17.4.1.074
--     tiene parches pendientes; el upgrade es una operación de
--     infraestructura con downtime breve, requiere confirmación explícita
--     del operador antes de programarla.
--   - pg_graphql_anon/authenticated_table_exposed (WARN, 56 entradas):
--     comportamiento estándar de Supabase (grants SELECT a anon/authenticated
--     + RLS como barrera real de acceso por fila, no el grant de tabla).
--     La app no usa GraphQL. Revocar SELECT a anon en todas las tablas
--     rompería el patrón habitual de acceso vía anon-key antes de
--     autenticar; no se ha tocado.
-- =============================================================================

alter function public.is_gestor_central() set search_path = public, pg_temp;
alter function public.update_updated_at_column() set search_path = public, pg_temp;
alter function public.set_contacto_actualizado_en() set search_path = public, pg_temp;
alter function public.touch_actualizado_en() set search_path = public, pg_temp;
alter function public.handle_new_user() set search_path = public, pg_temp;
alter function public.trigger_bank_sync_cron() set search_path = public, extensions, net, vault, pg_temp;

revoke execute on function public.trigger_bank_sync_cron() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
revoke execute on function public.assert_delegacion_member(uuid) from anon, authenticated;
