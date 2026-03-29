-- =============================================================================
-- 036: Índices de rendimiento para la tabla movimiento
-- =============================================================================
-- La tabla movimiento carece de índices en las columnas más consultadas.
-- Todas las queries del dashboard filtran por delegacion_id + ignorado + fecha,
-- causando full table scans. Estos índices cubren los patrones de acceso reales.

-- Índice compuesto principal: cubre el filtro base de TODAS las queries del
-- dashboard (WHERE delegacion_id = X AND ignorado = false ORDER BY fecha DESC).
-- Partial index sobre ignorado = false porque el 99% de queries excluyen ignorados.
CREATE INDEX IF NOT EXISTS idx_movimiento_delegacion_activo_fecha
  ON movimiento (delegacion_id, fecha DESC)
  WHERE ignorado = false;

-- Índice para filtros por categoría (pantalla de categorías, category-analysis).
-- También cubre la query de "sin categoría" (categoria_id IS NULL).
CREATE INDEX IF NOT EXISTS idx_movimiento_delegacion_categoria
  ON movimiento (delegacion_id, categoria_id);

-- Índice para queries de movimientos ignorados (si se necesitaran en el futuro)
-- y para la tabla completa sin el filtro de ignorado.
CREATE INDEX IF NOT EXISTS idx_movimiento_delegacion_fecha
  ON movimiento (delegacion_id, fecha DESC);

-- Índice para búsquedas por cuenta dentro de una delegación
CREATE INDEX IF NOT EXISTS idx_movimiento_cuenta
  ON movimiento (cuenta_id);
