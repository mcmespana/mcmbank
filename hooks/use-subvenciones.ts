"use client"

import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import {
  listarFinanciadores,
  listarMovimientosDeSubvencion,
  listarSubvenciones,
  obtenerSubvencion,
  type MovimientoDeSubvencion,
} from "@/lib/services/subvenciones"
import type { Financiador, SubvencionConResumen } from "@/lib/types/database"

// Referencias estables para "sin datos" (ver hooks/use-cuentas.ts).
const SIN_SUBVENCIONES: SubvencionConResumen[] = []
const SIN_MOVIMIENTOS: MovimientoDeSubvencion[] = []
const SIN_FINANCIADORES: Financiador[] = []

export const subvencionesKey = ["subvenciones"] as const

/**
 * Todas las subvenciones con su resumen. No depende de la delegación
 * seleccionada: una subvención es de la organización entera.
 */
export function useSubvenciones(options: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: subvencionesKey,
    queryFn: listarSubvenciones,
    enabled: options.enabled ?? true,
    staleTime: 30_000,
  })

  const invalidar = useCallback(
    () => queryClient.invalidateQueries({ queryKey: subvencionesKey }),
    [queryClient],
  )

  return {
    subvenciones: query.data ?? SIN_SUBVENCIONES,
    loading: query.isPending && query.fetchStatus !== "idle",
    error: query.error,
    refetch: query.refetch,
    invalidar,
  }
}

/** Una subvención y sus movimientos imputados. */
export function useSubvencion(id: string | null, options: { enabled?: boolean } = {}) {
  const queryClient = useQueryClient()
  const enabled = Boolean(id) && (options.enabled ?? true)

  const ficha = useQuery({
    queryKey: [...subvencionesKey, id, "ficha"],
    queryFn: () => obtenerSubvencion(id as string),
    enabled,
  })
  const movimientos = useQuery({
    queryKey: [...subvencionesKey, id, "movimientos"],
    queryFn: () => listarMovimientosDeSubvencion(id as string),
    enabled,
  })

  // Invalida también la lista: el resumen (nº de movimientos, importe) cambia.
  const invalidar = useCallback(
    () => queryClient.invalidateQueries({ queryKey: subvencionesKey }),
    [queryClient],
  )

  return {
    subvencion: ficha.data ?? null,
    movimientos: movimientos.data ?? SIN_MOVIMIENTOS,
    loading: ficha.isPending && ficha.fetchStatus !== "idle",
    movimientosLoading: movimientos.isPending && movimientos.fetchStatus !== "idle",
    movimientosFetching: movimientos.isFetching,
    error: ficha.error ?? movimientos.error,
    invalidar,
  }
}

/** Financiadores, para el selector del formulario. Van bajo la misma clave para invalidarse juntos. */
export function useFinanciadores(options: { enabled?: boolean } = {}) {
  const query = useQuery({
    queryKey: [...subvencionesKey, "financiadores"],
    queryFn: listarFinanciadores,
    enabled: options.enabled ?? true,
    staleTime: 60_000,
  })
  return { financiadores: query.data ?? SIN_FINANCIADORES, loading: query.isPending && query.fetchStatus !== "idle" }
}
