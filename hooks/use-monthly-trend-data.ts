"use client"

import { useQuery } from "@tanstack/react-query"
import { useDelegationContext } from "@/contexts/delegation-context"
import { DatabaseService } from "@/lib/services/database"
import type { MonthlyTrendRow } from "@/lib/types/database"

/**
 * Tendencia mensual para un rango de fechas. Migrado a TanStack Query (mismo
 * patrón que `useCategoryBreakdown`): caché compartida, deduplicación y
 * revalidación al foco centralizadas por la librería.
 *
 * Mantiene el mismo contrato de salida que la versión anterior (trend,
 * loading, error, refresh) para no tocar a los consumidores.
 */
export function useMonthlyTrendData(from: string, to: string) {
  const { selectedDelegation } = useDelegationContext()

  const query = useQuery<MonthlyTrendRow[]>({
    queryKey: ["monthly-trend", selectedDelegation, from, to],
    queryFn: ({ signal }) =>
      DatabaseService.getMonthlyTrend(selectedDelegation as string, from, to, signal),
    enabled: Boolean(selectedDelegation && from && to),
  })

  return {
    trend: query.data ?? [],
    loading: query.isPending && query.fetchStatus !== "idle",
    error: query.error ? (query.error as Error).message : null,
    refresh: query.refetch,
  }
}
