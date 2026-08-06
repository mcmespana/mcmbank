-- =============================================================================
-- 052: RPCs de resumen para Facturas/Pagos MCM, N+1 de cuenta sugerida,
--      índice de facturas reparado y WITH CHECK en las políticas UPDATE.
-- =============================================================================
-- Fase 1 de plans/021-redesign-facturas-pagos.md. Mismo patrón que 049:
-- assert_delegacion_member() como primer paso, SECURITY DEFINER STABLE,
-- REVOKE anon/public + GRANT authenticated.
--
-- a) get_facturas_resumen / get_pagos_mcm_resumen: sustituyen la segunda
--    consulta completa (sin filtro, sólo para contadores) que hoy lanza cada
--    manager. importe_pendiente usa la misma fórmula que
--    importePendienteFactura() (lib/utils/facturas.ts) y
--    recalcular_estado_factura() (048): GREATEST(importe - pagado, 0).
-- b) get_cuenta_con_mas_movimientos: sustituye el N+1 de
--    getCuentaConMasMovimientos (database.ts), que lanzaba una query count
--    por cada cuenta de la delegación.
-- c) Índice roto: idx_factura_delegacion_importe_sin_movimiento (047) es
--    parcial sobre `movimiento_id IS NULL`, columna eliminada por 048. Se
--    sustituye por un índice vivo sobre los estados que aún admiten vínculos.
-- d) Índices de orden explícito para las listas (fase 1 de hooks a
--    TanStack Query con .range()).
-- e) WITH CHECK en las políticas UPDATE de pago_mcm/factura/archivo_adjunto:
--    tenían USING pero no WITH CHECK, así que una fila editable se podía
--    mover a otra delegación.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- a) RPCs de resumen
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_facturas_resumen(p_delegacion_id uuid)
RETURNS TABLE(estado text, n bigint, importe_total numeric, importe_pendiente numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM assert_delegacion_member(p_delegacion_id);
  RETURN QUERY
  SELECT
    f.estado,
    COUNT(*) AS n,
    COALESCE(SUM(f.importe), 0) AS importe_total,
    COALESCE(SUM(GREATEST(COALESCE(f.importe, 0) - COALESCE(mv.pagado, 0), 0)), 0) AS importe_pendiente
  FROM factura f
  LEFT JOIN LATERAL (
    SELECT SUM(ABS(m.importe)) AS pagado
    FROM movimiento m
    WHERE m.factura_id = f.id
  ) mv ON true
  WHERE f.delegacion_id = p_delegacion_id
  GROUP BY f.estado;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_pagos_mcm_resumen(p_delegacion_id uuid)
RETURNS TABLE(estado text, n bigint, importe_total numeric)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  PERFORM assert_delegacion_member(p_delegacion_id);
  RETURN QUERY
  SELECT
    p.estado,
    COUNT(*) AS n,
    COALESCE(SUM(p.importe), 0) AS importe_total
  FROM pago_mcm p
  WHERE p.delegacion_id = p_delegacion_id
  GROUP BY p.estado;
END;
$$;

-- ---------------------------------------------------------------------------
-- b) Cuenta con más movimientos (sugerencia por defecto al convertir un pago)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.get_cuenta_con_mas_movimientos(p_delegacion_id uuid)
RETURNS uuid
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_cuenta_id uuid;
BEGIN
  PERFORM assert_delegacion_member(p_delegacion_id);
  SELECT m.cuenta_id INTO v_cuenta_id
  FROM movimiento m
  JOIN cuenta c ON c.id = m.cuenta_id
  WHERE c.delegacion_id = p_delegacion_id
  GROUP BY m.cuenta_id
  ORDER BY COUNT(*) DESC
  LIMIT 1;
  RETURN v_cuenta_id; -- NULL si la delegación no tiene movimientos; el caller cae a cuentas[0]
END;
$$;

REVOKE ALL ON FUNCTION public.get_facturas_resumen(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.get_pagos_mcm_resumen(uuid) FROM anon, public;
REVOKE ALL ON FUNCTION public.get_cuenta_con_mas_movimientos(uuid) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.get_facturas_resumen(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pagos_mcm_resumen(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_cuenta_con_mas_movimientos(uuid) TO authenticated;

-- ---------------------------------------------------------------------------
-- c) Índice roto: idx_factura_delegacion_importe_sin_movimiento (047) es
--    parcial sobre `movimiento_id IS NULL`, columna que 048 elimina. El
--    índice que sostenía la búsqueda de candidatos por importe ya no existe.
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS idx_factura_delegacion_importe_sin_movimiento;

CREATE INDEX IF NOT EXISTS idx_factura_delegacion_importe_abierta
  ON public.factura (delegacion_id, importe)
  WHERE estado IN ('bandeja', 'sin_pagar', 'pagada_parcial');

-- ---------------------------------------------------------------------------
-- d) Índices de orden explícito (las listas dejan de depender sólo de
--    creado_en). Los de (delegacion_id, estado) ya existen (047, 041).
-- ---------------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS idx_factura_delegacion_fecha_emision
  ON public.factura (delegacion_id, fecha_emision DESC NULLS LAST, creado_en DESC);

CREATE INDEX IF NOT EXISTS idx_pago_mcm_delegacion_creado
  ON public.pago_mcm (delegacion_id, creado_en DESC);

-- ---------------------------------------------------------------------------
-- e) WITH CHECK en las políticas UPDATE: sin él, una fila que puedes editar
--    se puede mover a otra delegación (el USING sólo protege la fila
--    ANTES del update, no el valor nuevo de delegacion_id).
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can update pagos_mcm in their delegations" ON public.pago_mcm;
CREATE POLICY "Users can update pagos_mcm in their delegations" ON public.pago_mcm
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = pago_mcm.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR (mb.rol = 'gestor_central')
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = pago_mcm.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR (mb.rol = 'gestor_central')
              )
        )
    );

DROP POLICY IF EXISTS "Users can update facturas in their delegations" ON public.factura;
CREATE POLICY "Users can update facturas in their delegations" ON public.factura
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = factura.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR (mb.rol = 'gestor_central')
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = factura.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR (mb.rol = 'gestor_central')
              )
        )
    );

DROP POLICY IF EXISTS "Users can update archivos in their delegations" ON public.archivo_adjunto;
CREATE POLICY "Users can update archivos in their delegations" ON public.archivo_adjunto
    FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = archivo_adjunto.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR (mb.rol = 'gestor_central')
              )
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.membresia mb
            WHERE mb.usuario_id = auth.uid()
              AND (
                (mb.delegacion_id = archivo_adjunto.delegacion_id AND mb.rol IN ('tesorero', 'gestor_central'))
                OR (mb.rol = 'gestor_central')
              )
        )
    );

COMMENT ON FUNCTION public.get_facturas_resumen(uuid) IS 'Resumen de facturas por estado (n, importe_total, importe_pendiente) para los contadores de pestaña y KPI de /facturas. importe_pendiente = GREATEST(importe - pagado, 0), igual que importePendienteFactura().';
COMMENT ON FUNCTION public.get_pagos_mcm_resumen(uuid) IS 'Resumen de pagos MCM por estado (n, importe_total) para los contadores de pestaña y la línea de resumen de /pagos-mcm.';
COMMENT ON FUNCTION public.get_cuenta_con_mas_movimientos(uuid) IS 'Cuenta de la delegación con más movimientos, para sugerir por defecto al convertir un pago MCM en movimiento. NULL si la delegación no tiene movimientos.';

-- ---------------------------------------------------------------------------
-- f) PENDIENTE (no aplicado en esta migración): búsqueda de facturas también
--    por nombre de proveedor. Hoy el ILIKE de getFacturasByDelegacion
--    (lib/services/database.ts) sólo llega a concepto/numero/notas porque el
--    proveedor vive en la tabla contacto. La mejora limpia es una columna
--    generada `tsvector` sobre factura (concepto, numero, notas) más un
--    JOIN a contacto.nombre indexado con GIN, o desnormalizar el nombre del
--    proveedor en factura. Requiere decidir el mantenedor: no se ejecuta aquí.
-- ---------------------------------------------------------------------------
