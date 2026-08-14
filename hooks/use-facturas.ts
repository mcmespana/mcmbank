"use client"

import { useCallback, useMemo } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { DatabaseService } from "@/lib/services/database"
import { runQuery } from "@/lib/db/query"
import type {
  Factura,
  FacturaConRelaciones,
  FacturaEstado,
  FacturaInsert,
  FacturaUpdate,
} from "@/lib/types/database"

const QUERY_TIMEOUT_MS = 12000
const PAGE_SIZE = 100

export interface UseFacturasOptions {
  estados?: FacturaEstado[]
  contactoId?: string
  busqueda?: string
}

// Referencia estable para el caso "sin datos": evita que `query.data ?? []`
// devuelva un array nuevo en cada render (lo que dispararía efectos en bucle).
const EMPTY: FacturaConRelaciones[] = []

async function fetchFacturasPage(
  delegacionId: string,
  offset: number,
  options: { estados?: FacturaEstado[]; contactoId?: string; busqueda?: string },
): Promise<FacturaConRelaciones[]> {
  const { data, error } = await runQuery<FacturaConRelaciones[]>({
    label: "fetch-facturas",
    table: "factura",
    timeoutMs: QUERY_TIMEOUT_MS,
    build: async (signal) => {
      try {
        const rows = await DatabaseService.getFacturasByDelegacion(delegacionId, {
          ...options,
          offset,
          limit: PAGE_SIZE,
          signal,
        })
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
 * Facturas de una delegación, migrado a TanStack Query (plantilla:
 * hooks/use-cuentas.ts) con scroll infinito (páginas de 100, como
 * transaction-list.tsx). El resumen por estado vive aparte en
 * useFacturasResumen: ya no hay una segunda invocación sin filtro sólo para
 * contadores.
 */
export function useFacturas(delegacionId?: string | null, options: UseFacturasOptions = {}) {
  const queryClient = useQueryClient()

  const estados = options.estados
  const contactoId = options.contactoId
  const busqueda = options.busqueda?.trim() || undefined
  const estadosKey = useMemo(() => (estados ? [...estados].sort().join(",") : ""), [estados])

  const queryKey = ["facturas", delegacionId ?? null, estadosKey, contactoId ?? "", busqueda ?? ""] as const

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchFacturasPage(delegacionId as string, pageParam, { estados, contactoId, busqueda }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    enabled: Boolean(delegacionId),
  })

  const facturas = useMemo(() => query.data?.pages.flat() ?? EMPTY, [query.data])

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["facturas", delegacionId ?? null] })
    queryClient.invalidateQueries({ queryKey: ["facturas-resumen", delegacionId ?? null] })
  }, [queryClient, delegacionId])

  const createFactura = useCallback(
    async (payload: Omit<FacturaInsert, "creado_en" | "actualizado_en">) => {
      const created = await DatabaseService.createFactura(payload)
      invalidate()
      return created
    },
    [invalidate],
  )

  const updateFactura = useCallback(
    async (id: string, updates: FacturaUpdate) => {
      await DatabaseService.updateFactura(id, updates)
      invalidate()
    },
    [invalidate],
  )

  const deleteFactura = useCallback(
    async (id: string) => {
      await DatabaseService.deleteFactura(id)
      invalidate()
    },
    [invalidate],
  )

  const linkToMovimiento = useCallback(
    async (facturaId: string, movimientoId: string, creadoPor?: string) => {
      await DatabaseService.linkFacturaToMovimiento(facturaId, movimientoId, creadoPor)
      invalidate()
    },
    [invalidate],
  )

  const unlinkFromMovimiento = useCallback(
    async (facturaId: string, movimientoId: string) => {
      await DatabaseService.unlinkFacturaFromMovimiento(facturaId, movimientoId)
      invalidate()
    },
    [invalidate],
  )

  return {
    facturas,
    loading: query.isPending && query.fetchStatus !== "idle",
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
    /** Invalida lista y contadores: lo que necesita la UI tras una lectura con IA. */
    refrescar: invalidate,
    hasMore: Boolean(query.hasNextPage),
    onLoadMore: query.fetchNextPage,
    isFetchingMore: query.isFetchingNextPage,
    createFactura,
    updateFactura,
    deleteFactura,
    linkToMovimiento,
    unlinkFromMovimiento,
  }
}

export type UseFacturasReturn = ReturnType<typeof useFacturas>
export type { Factura, FacturaConRelaciones }
