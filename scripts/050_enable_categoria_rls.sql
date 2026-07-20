-- =============================================================================
-- 050: Habilitar RLS en categoria y categoria_orden_delegacion
-- =============================================================================
-- APLICADA en producción el 2026-07-18 (migración
-- `enable_categoria_rls_with_delegation_policy` vía MCP apply_migration).
--
-- Contexto: ambas tablas tenían políticas creadas pero RLS DESACTIVADO
-- (advisor ERROR policy_exists_rls_disabled) → cualquiera con la anon key
-- podía leer y escribir todas las categorías. Activar RLS a secas habría
-- roto a los tesoreros: la política viva "Gestionar categoria" solo dejaba
-- escribir a gestor_central, pero la app permite a tesoreros gestionar
-- categorías LOCALES de su delegación (components/categories/
-- category-list.tsx — los tesoreros siempre crean con es_global=false y su
-- delegacion_id; solo el gestor central escribe globales).
--
-- Modelo resultante:
--   * SELECT: cualquier autenticado ("Ver categoria" / "Ver orden categorias").
--   * Globales (es_global=true): escritura solo gestor_central ("Gestionar categoria").
--   * Locales: escritura para miembros de la delegación de la fila (política NUEVA).
--   * categoria_orden_delegacion: su política viva ya era correcta
--     (gestor_central O membresía en la delegación) — solo se activa RLS.
--   * service_role (sync, cron, admin) bypasea RLS como siempre.
--
-- Verificado en vivo tras aplicar (simulando usuarios reales):
--   * tesorero: SELECT 63 categorías ✓; INSERT/UPDATE/DELETE local de su
--     delegación ✓; INSERT en delegación ajena ✗ (42501); INSERT global ✗
--     (42501); UPDATE de una global → 0 filas (silencioso, como espera la
--     UI); INSERT/DELETE en categoria_orden_delegacion de su delegación ✓,
--     de delegación ajena ✗ (42501).
--   * gestor_central: UPDATE de categoría global ✓ (1 fila).
--   * anon: SELECT categoria → 0 filas ✓.
--   * rowsecurity = true en ambas tablas ✓.

CREATE POLICY "Gestionar categoria delegacion" ON public.categoria
  AS PERMISSIVE FOR ALL TO authenticated
  USING (
    es_global = false
    AND delegacion_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM membresia m
      WHERE m.delegacion_id = categoria.delegacion_id
        AND m.usuario_id = auth.uid()
    )
  )
  WITH CHECK (
    es_global = false
    AND delegacion_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM membresia m
      WHERE m.delegacion_id = categoria.delegacion_id
        AND m.usuario_id = auth.uid()
    )
  );

ALTER TABLE public.categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categoria_orden_delegacion ENABLE ROW LEVEL SECURITY;

-- ROLLBACK de emergencia (si algo de la app fallara, un minuto):
--   ALTER TABLE public.categoria DISABLE ROW LEVEL SECURITY;
--   ALTER TABLE public.categoria_orden_delegacion DISABLE ROW LEVEL SECURITY;
-- (las políticas pueden quedarse creadas; sin RLS activo son inertes)
