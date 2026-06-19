"use client"

import { useCallback } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { InformesService } from "@/lib/services/informes"
import type { InformeConArchivos, InformeInsert, InformeUpdate } from "@/lib/types/database"

interface UseInformesState {
  informes: InformeConArchivos[]
  loading: boolean
  error: string | null
  refetch: () => Promise<unknown>
  createInforme: (payload: Omit<InformeInsert, "delegacion_id">) => Promise<InformeConArchivos>
  updateInforme: (id: string, patch: InformeUpdate) => Promise<void>
  deleteInforme: (informe: InformeConArchivos) => Promise<void>
}

function informesKey(delegacionId: string | null) {
  return ["informes", delegacionId] as const
}

// Referencia estable para el caso "sin datos": evita que `data ?? []` devuelva un
// array nuevo en cada render (lo que podría disparar efectos en bucle).
const EMPTY: InformeConArchivos[] = []

/**
 * Informes de una delegación. Migrado a TanStack Query (mismo patrón que
 * `useCuentas`): caché compartida por delegación, deduplicación y revalidación al
 * foco las gestiona la librería. Las mutaciones actualizan la caché de forma
 * optimista para no esperar a un refetch completo.
 *
 * Mantiene el contrato anterior (informes, loading, error, refetch,
 * createInforme, updateInforme, deleteInforme) para no tocar a los consumidores.
 */
export function useInformes(delegacionId: string | null): UseInformesState {
  const queryClient = useQueryClient()

  const query = useQuery<InformeConArchivos[], Error>({
    queryKey: informesKey(delegacionId),
    queryFn: () => InformesService.list(delegacionId as string),
    enabled: Boolean(delegacionId),
    staleTime: 30000,
  })

  const setCache = useCallback(
    (updater: (prev: InformeConArchivos[]) => InformeConArchivos[]) => {
      queryClient.setQueryData<InformeConArchivos[]>(informesKey(delegacionId), (prev) =>
        updater(prev ?? []),
      )
    },
    [queryClient, delegacionId],
  )

  const createInforme = useCallback(
    async (payload: Omit<InformeInsert, "delegacion_id">) => {
      if (!delegacionId) throw new Error("No hay delegación seleccionada")
      const informe = await InformesService.create({ ...payload, delegacion_id: delegacionId })
      const withArchivos: InformeConArchivos = { ...informe, archivos: [] }
      setCache((prev) => [withArchivos, ...prev])
      return withArchivos
    },
    [delegacionId, setCache],
  )

  const updateInforme = useCallback(
    async (id: string, patch: InformeUpdate) => {
      const updated = await InformesService.update(id, patch)
      setCache((prev) => prev.map((i) => (i.id === id ? { ...i, ...updated } : i)))
    },
    [setCache],
  )

  const deleteInforme = useCallback(
    async (informe: InformeConArchivos) => {
      await InformesService.remove(informe)
      setCache((prev) => prev.filter((i) => i.id !== informe.id))
    },
    [setCache],
  )

  return {
    informes: query.data ?? EMPTY,
    loading: query.isPending && query.fetchStatus !== "idle",
    error: query.error ? query.error.message : null,
    refetch: () => query.refetch(),
    createInforme,
    updateInforme,
    deleteInforme,
  }
}

export default useInformes
