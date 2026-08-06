"use client"

import { useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { DatabaseService } from "@/lib/services/database"
import { runQuery } from "@/lib/db/query"
import type { PagoMcmResumenRow } from "@/lib/types/database"

export interface PagosMcmResumen {
  borrador: number
  pendiente: number
  pagado: number
  cancelado: number
  total: number
  pendienteImporte: number
  pagadoImporte: number
}

const EMPTY_RESUMEN: PagosMcmResumen = {
  borrador: 0,
  pendiente: 0,
  pagado: 0,
  cancelado: 0,
  total: 0,
  pendienteImporte: 0,
  pagadoImporte: 0,
}

async function fetchPagosMcmResumen(delegacionId: string): Promise<PagoMcmResumenRow[]> {
  const { data, error } = await runQuery<PagoMcmResumenRow[]>({
    label: "pagos-mcm-resumen",
    table: "pago_mcm",
    build: async (signal) => {
      try {
        const rows = await DatabaseService.getPagosMcmResumen(delegacionId, signal)
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
 * Resumen de pagos MCM por estado, calculado en la base de datos
 * (get_pagos_mcm_resumen). Sustituye a la segunda invocación sin filtro de
 * usePagosMcm, que además nunca se refrescaba tras mutar (contadores
 * obsoletos): al vivir en su propia query se invalida junto a la lista.
 */
export function usePagosMcmResumen(delegacionId: string | null) {
  const query = useQuery({
    queryKey: ["pagos-mcm-resumen", delegacionId],
    queryFn: () => fetchPagosMcmResumen(delegacionId as string),
    enabled: Boolean(delegacionId),
  })

  const resumen = useMemo<PagosMcmResumen>(() => {
    const base: PagosMcmResumen = { ...EMPTY_RESUMEN }
    for (const row of query.data ?? []) {
      base[row.estado] += row.n
      base.total += row.n
      if (row.estado === "pendiente") base.pendienteImporte += row.importe_total
      if (row.estado === "pagado") base.pagadoImporte += row.importe_total
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
