"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useDelegationContext } from "@/contexts/delegation-context"
import { DatabaseService } from "@/lib/services/database"
import { runQuery } from "@/lib/db/query"
import { useRevalidateOnFocusJitter } from "@/hooks/use-app-status"
import type { FinancialSummary } from "@/lib/types/database"

const EMPTY_SUMMARY: FinancialSummary = {
  ingresos: 0,
  gastos: 0,
  balance: 0,
  total_movimientos: 0,
  sin_categoria: 0,
}

const QUERY_TIMEOUT_MS = 15000

export function useFinancialSummary(from: string, to: string) {
  const { selectedDelegation } = useDelegationContext()

  const [summary, setSummary] = useState<FinancialSummary>(EMPTY_SUMMARY)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestRef = useRef(0)
  const lastKeyRef = useRef<string | null>(null)

  const fetchSummary = useCallback(async () => {
    if (!selectedDelegation || !from || !to) {
      setSummary(EMPTY_SUMMARY)
      setLoading(false)
      setError(null)
      return
    }

    const key = `${selectedDelegation}|${from}|${to}`
    if (lastKeyRef.current !== key) {
      lastKeyRef.current = key
      setSummary(EMPTY_SUMMARY)
    }

    const fetchId = ++requestRef.current
    setLoading(true)
    setError(null)

    try {
      const result = await runQuery<FinancialSummary>({
        label: "financial-summary",
        table: "movimiento",
        timeoutMs: QUERY_TIMEOUT_MS,
        build: async (signal) => {
          const data = await DatabaseService.getFinancialSummary(
            selectedDelegation,
            from,
            to,
            signal,
          )
          return { data, error: null }
        },
      })

      if (requestRef.current !== fetchId) return

      if (result.error) {
        setError(result.error.message ?? "Error al calcular el resumen financiero")
        setSummary(EMPTY_SUMMARY)
      } else {
        setSummary(result.data ?? EMPTY_SUMMARY)
        setError(null)
      }
    } catch (err) {
      if (requestRef.current !== fetchId) return
      setSummary(EMPTY_SUMMARY)
      setError(err instanceof Error ? err.message : "Error al calcular el resumen financiero")
    } finally {
      if (requestRef.current === fetchId) {
        setLoading(false)
      }
    }
  }, [selectedDelegation, from, to])

  useEffect(() => {
    fetchSummary()
  }, [fetchSummary])

  useRevalidateOnFocusJitter(fetchSummary, { minMs: 90, maxMs: 200 })

  return { summary, loading, error, refresh: fetchSummary }
}
