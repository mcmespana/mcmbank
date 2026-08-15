"use client"

import { useQuery } from "@tanstack/react-query"
import { useDelegationContext } from "@/contexts/delegation-context"
import { DatabaseService } from "@/lib/services/database"
import type { CategoryBreakdownRow } from "@/lib/types/database"

/**
 * Desglose por categoría para un rango de fechas. Migrado a TanStack Query:
 * caché compartida entre páginas, deduplicación y revalidación al foco sin
 * gestionar manualmente abort controllers ni refs anti-carrera.
 *
 * Mantiene el mismo contrato de salida que la versión anterior
 * (breakdown, loading, error, refresh) para no tocar a los consumidores.
 */
export function useCategoryBreakdown(from: string, to: string, contactoId?: string | null) {
  const { selectedDelegation } = useDelegationContext()

  const query = useQuery<CategoryBreakdownRow[]>({
    // El contacto va en la clave: si no, al filtrar se seguiría enseñando el
    // desglose cacheado de "todos los contactos".
    queryKey: ["category-breakdown", selectedDelegation, from, to, contactoId ?? null],
    queryFn: ({ signal }) =>
      DatabaseService.getCategoryBreakdown(selectedDelegation as string, from, to, signal, contactoId),
    enabled: Boolean(selectedDelegation && from && to),
  })

  return {
    breakdown: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: query.error ? (query.error as Error).message : null,
    refresh: query.refetch,
  }
}
