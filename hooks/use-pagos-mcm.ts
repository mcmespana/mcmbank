"use client"

import { useCallback, useMemo } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { DatabaseService } from "@/lib/services/database"
import { runQuery } from "@/lib/db/query"
import type {
  PagoMcm,
  PagoMcmConRelaciones,
  PagoMcmEstado,
  PagoMcmInsert,
  PagoMcmUpdate,
} from "@/lib/types/database"

const QUERY_TIMEOUT_MS = 12000
const PAGE_SIZE = 100

export interface UsePagosMcmOptions {
  estados?: PagoMcmEstado[]
  contactoId?: string
  busqueda?: string
}

// Referencia estable para el caso "sin datos": evita que `query.data ?? []`
// devuelva un array nuevo en cada render (lo que dispararía efectos en bucle).
const EMPTY: PagoMcmConRelaciones[] = []

async function fetchPagosPage(
  delegacionId: string,
  offset: number,
  options: { estados?: PagoMcmEstado[]; contactoId?: string; busqueda?: string },
): Promise<PagoMcmConRelaciones[]> {
  const { data, error } = await runQuery<PagoMcmConRelaciones[]>({
    label: "fetch-pagos-mcm",
    table: "pago_mcm",
    timeoutMs: QUERY_TIMEOUT_MS,
    build: async (signal) => {
      try {
        const rows = await DatabaseService.getPagosMcmByDelegacion(delegacionId, {
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
 * Pagos MCM de una delegación, migrado a TanStack Query (plantilla:
 * hooks/use-cuentas.ts) con scroll infinito (páginas de 100). El resumen por
 * estado vive aparte en usePagosMcmResumen: al invalidarse junto a la lista
 * en cada mutación, los contadores de pestaña ya no quedan obsoletos.
 */
export function usePagosMcm(delegacionId?: string | null, options: UsePagosMcmOptions = {}) {
  const queryClient = useQueryClient()

  const estados = options.estados
  const contactoId = options.contactoId
  const busqueda = options.busqueda?.trim() || undefined
  const estadosKey = useMemo(() => (estados ? [...estados].sort().join(",") : ""), [estados])

  const queryKey = ["pagos-mcm", delegacionId ?? null, estadosKey, contactoId ?? "", busqueda ?? ""] as const

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam }) =>
      fetchPagosPage(delegacionId as string, pageParam, { estados, contactoId, busqueda }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) =>
      lastPage.length === PAGE_SIZE ? allPages.length * PAGE_SIZE : undefined,
    enabled: Boolean(delegacionId),
  })

  const pagos = useMemo(() => query.data?.pages.flat() ?? EMPTY, [query.data])

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["pagos-mcm", delegacionId ?? null] })
    queryClient.invalidateQueries({ queryKey: ["pagos-mcm-resumen", delegacionId ?? null] })
  }, [queryClient, delegacionId])

  const createPago = useCallback(
    async (payload: Omit<PagoMcmInsert, "creado_en" | "actualizado_en">) => {
      const created = await DatabaseService.createPagoMcm(payload)
      invalidate()
      return created
    },
    [invalidate],
  )

  const updatePago = useCallback(
    async (id: string, updates: PagoMcmUpdate) => {
      await DatabaseService.updatePagoMcm(id, updates)
      invalidate()
    },
    [invalidate],
  )

  const deletePago = useCallback(
    async (id: string) => {
      await DatabaseService.deletePagoMcm(id)
      invalidate()
    },
    [invalidate],
  )

  const convertToMovimiento = useCallback(
    async (
      pagoId: string,
      opts: { cuentaId: string; fecha: string; delegacionId: string; creadoPor: string },
    ) => {
      const result = await DatabaseService.convertPagoToMovimiento(pagoId, opts)
      invalidate()
      return result
    },
    [invalidate],
  )

  const linkToMovimiento = useCallback(
    async (pagoId: string, movimientoId: string, creadoPor?: string) => {
      await DatabaseService.linkPagoToMovimiento(pagoId, movimientoId, creadoPor)
      invalidate()
    },
    [invalidate],
  )

  const unlinkFromMovimiento = useCallback(
    async (pagoId: string) => {
      await DatabaseService.unlinkPagoFromMovimiento(pagoId)
      invalidate()
    },
    [invalidate],
  )

  return {
    pagos,
    loading: query.isPending && query.fetchStatus !== "idle",
    error: query.error ? (query.error as Error).message : null,
    refetch: query.refetch,
    hasMore: Boolean(query.hasNextPage),
    onLoadMore: query.fetchNextPage,
    isFetchingMore: query.isFetchingNextPage,
    createPago,
    updatePago,
    deletePago,
    convertToMovimiento,
    linkToMovimiento,
    unlinkFromMovimiento,
  }
}

export type UsePagosMcmReturn = ReturnType<typeof usePagosMcm>
export type { PagoMcm, PagoMcmConRelaciones }
