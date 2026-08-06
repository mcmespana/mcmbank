"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { DatabaseService } from "@/lib/services/database"
import { runQuery } from "@/lib/db/query"
import type { FacturaResumenRow } from "@/lib/types/database"

export interface FacturasResumen {
  bandeja: number
  sin_pagar: number
  pagada_parcial: number
  pagada: number
  pagada_fuera: number
  total: number
  /** Suma de importe_pendiente de las facturas sin_pagar + pagada_parcial. */
  sinPagarImporte: number
}

const EMPTY_RESUMEN: FacturasResumen = {
  bandeja: 0,
  sin_pagar: 0,
  pagada_parcial: 0,
  pagada: 0,
  pagada_fuera: 0,
  total: 0,
  sinPagarImporte: 0,
}

async function fetchFacturasResumen(delegacionId: string): Promise<FacturaResumenRow[]> {
  const { data, error } = await runQuery<FacturaResumenRow[]>({
    label: "facturas-resumen",
    table: "factura",
    build: async (signal) => {
      try {
        const rows = await DatabaseService.getFacturasResumen(delegacionId, signal)
        return { data: rows, error: null }
      } catch (err) {
        return { data: null, error: err }
      }
    },
  })
  if (error) throw error
  return data ?? []
}

/**
 * Resumen de facturas por estado, calculado en la base de datos
 * (get_facturas_resumen). Sustituye a la segunda invocación sin filtro de
 * useFacturas: una sola query en vez de repetir la lista completa.
 */
export function useFacturasResumen(delegacionId: string | null) {
  const query = useQuery({
    queryKey: ["facturas-resumen", delegacionId],
    queryFn: () => fetchFacturasResumen(delegacionId as string),
    enabled: Boolean(delegacionId),
  })

  const resumen = useMemo<FacturasResumen>(() => {
    const base: FacturasResumen = { ...EMPTY_RESUMEN }
    for (const row of query.data ?? []) {
      base[row.estado] += row.n
      base.total += row.n
      if (row.estado === "sin_pagar" || row.estado === "pagada_parcial") {
        base.sinPagarImporte += row.importe_pendiente
      }
    }
    return base
  }, [query.data])

  return {
    resumen,
    loading: query.isPending && query.fetchStatus !== "idle",
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
  }
}
