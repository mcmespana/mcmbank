-- =============================================================================
-- 049: Guard de pertenencia en las RPCs de agregación + revocar anon
-- =============================================================================
-- APLICADA en producción el 2026-07-18 (migración
-- `secure_aggregation_rpcs_membership_check` vía MCP apply_migration).
--
-- Problema: get_financial_summary / get_monthly_trend / get_category_breakdown
-- eran SECURITY DEFINER, ejecutables por `anon` y sin comprobar pertenencia:
-- cualquiera con la anon key podía leer los totales de cualquier delegación.
--
-- Solución: assert_delegacion_member() como primer paso de cada función
-- (misma condición que las políticas RLS vivas de cuenta/movimiento:
-- gestor_central O membresía en la delegación) + REVOKE EXECUTE FROM anon.
--
-- Verificado en vivo tras aplicar:
--   * sin identidad          -> ERROR 42501 "No eres miembro de esta delegación"
--   * tesorero, su delegación -> datos correctos (las 3 funciones)
--   * tesorero, delegación ajena -> ERROR 42501
--   * gestor_central, cualquier delegación -> datos correctos
--
-- NOTA: los cuerpos SELECT provienen de las definiciones EN VIVO (incluyen
-- JOIN cuenta + cu.activa = true), no del fichero 037 del repo, que estaba
-- desactualizado. 037 queda supersedido por este fichero.
--
-- PENDIENTE (decisión del mantenedor, NO aplicado): habilitar RLS en
-- `categoria` y `categoria_orden_delegacion`. Se comprobó que la política
-- viva "Gestionar categoria" solo permite escribir a gestor_central, pero la
-- app permite a tesoreros gestionar categorías de su delegación
-- (components/categories/category-list.tsx). Activar RLS hoy rompería eso:
-- antes hay que sustituir esa política por una que permita a miembros de la
-- delegación gestionar categorías NO globales de su delegación (es_global =
-- false y delegacion_id en su membresía) y reservar las globales a
-- gestor_central. Ver plans/014-*.md.

CREATE OR REPLACE FUNCTION public.assert_delegacion_member(p_delegacion_id uuid)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT (
    is_gestor_central()
    OR EXISTS (
      SELECT 1 FROM membresia m
      WHERE m.delegacion_id = p_delegacion_id
        AND m.usuario_id = auth.uid()
    )
  ) THEN
    RAISE EXCEPTION 'No eres miembro de esta delegación' USING ERRCODE = '42501';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_financial_summary(p_delegacion_id uuid, p_desde date, p_hasta date)
RETURNS TABLE(ingresos numeric, gastos numeric, balance numeric, total_movimientos bigint, sin_categoria bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM assert_delegacion_member(p_delegacion_id);
  RETURN QUERY
  SELECT
    COALESCE(SUM(CASE WHEN m.importe > 0 THEN m.importe ELSE 0 END), 0)  AS ingresos,
    COALESCE(SUM(CASE WHEN m.importe < 0 THEN ABS(m.importe) ELSE 0 END), 0) AS gastos,
    COALESCE(SUM(m.importe), 0)                                         AS balance,
    COUNT(*)                                                            AS total_movimientos,
    COUNT(*) FILTER (WHERE m.categoria_id IS NULL)                      AS sin_categoria
  FROM movimiento m
  JOIN cuenta cu ON cu.id = m.cuenta_id
  WHERE m.delegacion_id = p_delegacion_id
    AND m.ignorado = false
    AND cu.activa = true
    AND m.fecha BETWEEN p_desde AND p_hasta;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_monthly_trend(p_delegacion_id uuid, p_desde date, p_hasta date)
RETURNS TABLE(mes text, ingresos numeric, gastos numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM assert_delegacion_member(p_delegacion_id);
  RETURN QUERY
  SELECT
    TO_CHAR(m.fecha, 'YYYY-MM')                                            AS mes,
    COALESCE(SUM(CASE WHEN m.importe > 0 THEN m.importe ELSE 0 END), 0)    AS ingresos,
    COALESCE(SUM(CASE WHEN m.importe < 0 THEN ABS(m.importe) ELSE 0 END), 0) AS gastos
  FROM movimiento m
  JOIN cuenta cu ON cu.id = m.cuenta_id
  WHERE m.delegacion_id = p_delegacion_id
    AND m.ignorado = false
    AND cu.activa = true
    AND m.fecha BETWEEN p_desde AND p_hasta
  GROUP BY TO_CHAR(m.fecha, 'YYYY-MM')
  ORDER BY mes;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_category_breakdown(p_delegacion_id uuid, p_desde date, p_hasta date)
RETURNS TABLE(categoria_id uuid, categoria_nombre text, categoria_emoji text, categoria_color text, ingresos numeric, gastos numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM assert_delegacion_member(p_delegacion_id);
  RETURN QUERY
  SELECT * FROM (
    SELECT
      m.categoria_id,
      c.nombre                                                               AS c_nombre,
      c.emoji                                                                AS c_emoji,
      c.color                                                                AS c_color,
      COALESCE(SUM(CASE WHEN m.importe > 0 THEN m.importe ELSE 0 END), 0)   AS s_ingresos,
      COALESCE(SUM(CASE WHEN m.importe < 0 THEN ABS(m.importe) ELSE 0 END), 0) AS s_gastos
    FROM movimiento m
    JOIN cuenta cu ON cu.id = m.cuenta_id
    LEFT JOIN categoria c ON c.id = m.categoria_id
    WHERE m.delegacion_id = p_delegacion_id
      AND m.ignorado = false
      AND cu.activa = true
      AND m.fecha BETWEEN p_desde AND p_hasta
    GROUP BY m.categoria_id, c.nombre, c.emoji, c.color
  ) sub
  ORDER BY (sub.s_ingresos + sub.s_gastos) DESC;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_financial_summary(uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_monthly_trend(uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.get_category_breakdown(uuid, date, date) FROM anon;
REVOKE EXECUTE ON FUNCTION public.assert_delegacion_member(uuid) FROM anon;
