"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { useDelegationContext } from "@/contexts/delegation-context"
import { DatabaseService } from "@/lib/services/database"
import { runQuery } from "@/lib/db/query"
import { useRevalidateOnFocusJitter } from "@/hooks/use-app-status"
import type { CategoryBreakdownRow } from "@/lib/types/database"

const QUERY_TIMEOUT_MS = 15000

export function useCategoryBreakdown(from: string, to: string) {
  const { selectedDelegation } = useDelegationContext()

  const [breakdown, setBreakdown] = useState<CategoryBreakdownRow[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const requestRef = useRef(0)
  const lastKeyRef = useRef<string | null>(null)

  const fetchBreakdown = useCallback(async () => {
    if (!selectedDelegation || !from || !to) {
      setBreakdown([])
      setLoading(false)
      setError(null)
      return
    }

    const key = `${selectedDelegation}|${from}|${to}`
    if (lastKeyRef.current !== key) {
      lastKeyRef.current = key
      setBreakdown([])
    }

    const fetchId = ++requestRef.current
    setLoading(true)
    setError(null)

    try {
      const result = await runQuery<CategoryBreakdownRow[]>({
        label: "category-breakdown",
        table: "movimiento",
        timeoutMs: QUERY_TIMEOUT_MS,
        build: async (signal) => {
          const data = await DatabaseService.getCategoryBreakdown(
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
        setError(result.error.message ?? "Error al cargar el desglose por categoría")
        setBreakdown([])
      } else {
        setBreakdown(result.data ?? [])
        setError(null)
      }
    } catch (err) {
      if (requestRef.current !== fetchId) return
      setBreakdown([])
      setError(err instanceof Error ? err.message : "Error al cargar el desglose por categoría")
    } finally {
      if (requestRef.current === fetchId) {
        setLoading(false)
      }
    }
  }, [selectedDelegation, from, to])

  useEffect(() => {
    fetchBreakdown()
  }, [fetchBreakdown])

  useRevalidateOnFocusJitter(fetchBreakdown, { minMs: 90, maxMs: 200 })

  return { breakdown, loading, error, refresh: fetchBreakdown }
}
