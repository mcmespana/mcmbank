-- ============================================================================
-- 044 · Desactivar cuentas: columna cuenta.activa
-- ============================================================================
-- Una cuenta desactivada (activa=false) se conserva con todos sus movimientos
-- como copia histórica, pero desaparece de estadísticas, dashboard y listados
-- de transacciones. Solo es visible en la página /cuentas (atenuada) para
-- poder reactivarla.
-- ============================================================================

ALTER TABLE public.cuenta
    ADD COLUMN IF NOT EXISTS activa boolean NOT NULL DEFAULT true;

-- ----------------------------------------------------------------------------
-- RPCs del dashboard: excluir movimientos de cuentas desactivadas
-- ----------------------------------------------------------------------------

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
$$;

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
$$;

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
  SELECT * FROM (
    SELECT
      m.categoria_id,
      c.nombre                                                               AS categoria_nombre,
      c.emoji                                                                AS categoria_emoji,
      c.color                                                                AS categoria_color,
      COALESCE(SUM(CASE WHEN m.importe > 0 THEN m.importe ELSE 0 END), 0)   AS ingresos,
      COALESCE(SUM(CASE WHEN m.importe < 0 THEN ABS(m.importe) ELSE 0 END), 0) AS gastos
    FROM movimiento m
    JOIN cuenta cu ON cu.id = m.cuenta_id
    LEFT JOIN categoria c ON c.id = m.categoria_id
    WHERE m.delegacion_id = p_delegacion_id
      AND m.ignorado = false
      AND cu.activa = true
      AND m.fecha BETWEEN p_desde AND p_hasta
    GROUP BY m.categoria_id, c.nombre, c.emoji, c.color
  ) sub
  ORDER BY (ingresos + gastos) DESC;
$$;
