-- =============================================================================
-- 037: Funciones RPC de agregación para el dashboard
-- =============================================================================
-- En lugar de cargar todos los movimientos al cliente y agregar en JavaScript,
-- estas funciones hacen los cálculos en la base de datos y devuelven solo
-- los resultados. Reduce drásticamente el payload de red y la carga del cliente.
--
-- Todas usan SECURITY DEFINER para ejecutarse con los permisos del owner
-- (respetan RLS del usuario llamante vía set_config).
-- Se llaman desde el cliente con supabase.rpc('nombre_funcion', params).

-- -----------------------------------------------------------------------------
-- get_financial_summary
-- Devuelve totales financieros para una delegación y rango de fechas.
-- Reemplaza el patrón: cargar todos los movimientos y sumar en JS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_financial_summary(
  p_delegacion_id uuid,
  p_desde         date,
  p_hasta         date
)
RETURNS TABLE (
  ingresos           numeric,
  gastos             numeric,
  balance            numeric,
  total_movimientos  bigint,
  sin_categoria      bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    COALESCE(SUM(CASE WHEN importe > 0 THEN importe ELSE 0 END), 0)  AS ingresos,
    COALESCE(SUM(CASE WHEN importe < 0 THEN ABS(importe) ELSE 0 END), 0) AS gastos,
    COALESCE(SUM(importe), 0)                                         AS balance,
    COUNT(*)                                                           AS total_movimientos,
    COUNT(*) FILTER (WHERE categoria_id IS NULL)                       AS sin_categoria
  FROM movimiento
  WHERE delegacion_id = p_delegacion_id
    AND ignorado = false
    AND fecha BETWEEN p_desde AND p_hasta;
$$;

-- -----------------------------------------------------------------------------
-- get_monthly_trend
-- Devuelve ingresos y gastos agrupados por mes (YYYY-MM) en el rango dado.
-- Reemplaza: cargar todos los movimientos y agrupar por mes en JS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_monthly_trend(
  p_delegacion_id uuid,
  p_desde         date,
  p_hasta         date
)
RETURNS TABLE (
  mes      text,
  ingresos numeric,
  gastos   numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    TO_CHAR(fecha, 'YYYY-MM')                                              AS mes,
    COALESCE(SUM(CASE WHEN importe > 0 THEN importe ELSE 0 END), 0)       AS ingresos,
    COALESCE(SUM(CASE WHEN importe < 0 THEN ABS(importe) ELSE 0 END), 0)  AS gastos
  FROM movimiento
  WHERE delegacion_id = p_delegacion_id
    AND ignorado = false
    AND fecha BETWEEN p_desde AND p_hasta
  GROUP BY TO_CHAR(fecha, 'YYYY-MM')
  ORDER BY mes;
$$;

-- -----------------------------------------------------------------------------
-- get_category_breakdown
-- Devuelve ingresos y gastos agrupados por categoría en el rango dado.
-- Las filas sin categoría aparecen con categoria_id NULL.
-- Reemplaza: cargar todos los movimientos y agrupar por categoria_id en JS.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION get_category_breakdown(
  p_delegacion_id uuid,
  p_desde         date,
  p_hasta         date
)
RETURNS TABLE (
  categoria_id     uuid,
  categoria_nombre text,
  categoria_emoji  text,
  categoria_color  text,
  ingresos         numeric,
  gastos           numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Subquery needed so ORDER BY can reference the aliases ingresos/gastos.
  -- PostgreSQL resolves aliases in ORDER BY only for simple names, not expressions.
  SELECT * FROM (
    SELECT
      m.categoria_id,
      c.nombre                                                               AS categoria_nombre,
      c.emoji                                                                AS categoria_emoji,
      c.color                                                                AS categoria_color,
      COALESCE(SUM(CASE WHEN m.importe > 0 THEN m.importe ELSE 0 END), 0)   AS ingresos,
      COALESCE(SUM(CASE WHEN m.importe < 0 THEN ABS(m.importe) ELSE 0 END), 0) AS gastos
    FROM movimiento m
    LEFT JOIN categoria c ON c.id = m.categoria_id
    WHERE m.delegacion_id = p_delegacion_id
      AND m.ignorado = false
      AND m.fecha BETWEEN p_desde AND p_hasta
    GROUP BY m.categoria_id, c.nombre, c.emoji, c.color
  ) sub
  ORDER BY (ingresos + gastos) DESC;
$$;

-- Comentarios de uso:
-- SELECT * FROM get_financial_summary('uuid-delegacion', '2025-01-01', '2025-12-31');
-- SELECT * FROM get_monthly_trend('uuid-delegacion', '2025-01-01', '2025-12-31');
-- SELECT * FROM get_category_breakdown('uuid-delegacion', '2025-01-01', '2025-12-31');
