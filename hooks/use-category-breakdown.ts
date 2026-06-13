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
export function useCategoryBreakdown(from: string, to: string) {
  const { selectedDelegation } = useDelegationContext()

  const query = useQuery<CategoryBreakdownRow[]>({
    queryKey: ["category-breakdown", selectedDelegation, from, to],
    queryFn: ({ signal }) =>
      DatabaseService.getCategoryBreakdown(selectedDelegation as string, from, to, signal),
    enabled: Boolean(selectedDelegation && from && to),
  })

  return {
    breakdown: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: query.error ? (query.error as Error).message : null,
    refresh: query.refetch,
  }
}
