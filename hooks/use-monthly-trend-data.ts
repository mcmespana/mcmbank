"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useDelegationContext } from "@/contexts/delegation-context"
import { DatabaseService } from "@/lib/services/database"
import { runQuery } from "@/lib/db/query"
import { useRevalidateOnFocusJitter } from "@/hooks/use-app-status"
import type { MonthlyTrendRow } from "@/lib/types/database"

const QUERY_TIMEOUT_MS = 15000

export function useMonthlyTrendData(from: string, to: string) {
  const { selectedDelegation } = useDelegationContext()

  const [trend, setTrend] = useState<MonthlyTrendRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestRef = useRef(0)
  const lastKeyRef = useRef<string | null>(null)

  const fetchTrend = useCallback(async () => {
    if (!selectedDelegation || !from || !to) {
      setTrend([])
      setLoading(false)
      setError(null)
      return
    }

    const key = `${selectedDelegation}|${from}|${to}`
    if (lastKeyRef.current !== key) {
      lastKeyRef.current = key
      setTrend([])
    }

    const fetchId = ++requestRef.current
    setLoading(true)
    setError(null)

    try {
      const result = await runQuery<MonthlyTrendRow[]>({
        label: "monthly-trend",
        table: "movimiento",
        timeoutMs: QUERY_TIMEOUT_MS,
        build: async (signal) => {
          const data = await DatabaseService.getMonthlyTrend(
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
        setError(result.error.message ?? "Error al cargar la tendencia mensual")
        setTrend([])
      } else {
        setTrend(result.data ?? [])
        setError(null)
      }
    } catch (err) {
      if (requestRef.current !== fetchId) return
      setTrend([])
      setError(err instanceof Error ? err.message : "Error al cargar la tendencia mensual")
    } finally {
      if (requestRef.current === fetchId) {
        setLoading(false)
      }
    }
  }, [selectedDelegation, from, to])

  useEffect(() => {
    fetchTrend()
  }, [fetchTrend])

  useRevalidateOnFocusJitter(fetchTrend, { minMs: 90, maxMs: 200 })

  return { trend, loading, error, refresh: fetchTrend }
}
