"use client"

import { useQuery } from "@tanstack/react-query"
import { useDelegationContext } from "@/contexts/delegation-context"
import { DatabaseService } from "@/lib/services/database"
import type { FinancialSummary } from "@/lib/types/database"

const EMPTY_SUMMARY: FinancialSummary = {
  ingresos: 0,
  gastos: 0,
  balance: 0,
  total_movimientos: 0,
  sin_categoria: 0,
}

/**
 * Resumen financiero para un rango de fechas. Migrado a TanStack Query (mismo
 * patrón que `useCategoryBreakdown`/`useCuentas`): caché compartida entre
 * páginas y llamadas con la misma key (p.ej. el "saldo en cuentas" de todo el
 * histórico se pide desde varios sitios con from="1970-01-01"), deduplicación
 * y revalidación al foco centralizadas por la librería en vez de un
 * `useRevalidateOnFocusJitter` por instancia.
 *
 * Mantiene el mismo contrato de salida que la versión anterior (summary,
 * loading, error, refresh) para no tocar a los consumidores.
 */
export function useFinancialSummary(from: string, to: string) {
  const { selectedDelegation } = useDelegationContext()

  const query = useQuery<FinancialSummary>({
    queryKey: ["financial-summary", selectedDelegation, from, to],
    queryFn: ({ signal }) =>
      DatabaseService.getFinancialSummary(selectedDelegation as string, from, to, signal),
    enabled: Boolean(selectedDelegation && from && to),
  })

  return {
    summary: query.data ?? EMPTY_SUMMARY,
    loading: query.isPending && query.fetchStatus !== "idle",
    error: query.error ? (query.error as Error).message : null,
    refresh: query.refetch,
  }
}
