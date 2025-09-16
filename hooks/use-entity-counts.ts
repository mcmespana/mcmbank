"use client"

import { useCallback, useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"

type EntityCounts = {
  movimientos: number | null
  categorias: number | null
  cuentas: number | null
}

interface UseEntityCountsOptions {
  delegacionId: string | null
  organizacionId: string | null
  timeoutMs?: number
}

const DEFAULT_TIMEOUT_MS = 15000

function isAbortError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "AbortError"
  }
  if (typeof error === "object" && error !== null && "name" in error) {
    const name = (error as { name?: unknown }).name
    return typeof name === "string" && name === "AbortError"
  }
  return false
}

export function useEntityCounts({
  delegacionId,
  organizacionId,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: UseEntityCountsOptions) {
  const [counts, setCounts] = useState<EntityCounts>({
    movimientos: null,
    categorias: null,
    cuentas: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchCount = useCallback(
    async (
      table: "movimiento" | "cuenta" | "categoria",
      filters: ReadonlyArray<{ column: string; value: string | number | boolean | null }>,
      signal: AbortSignal,
    ) => {
      let query = supabase.from(table).select("id", { count: "exact", head: true })
      for (const filter of filters) {
        query = query.eq(filter.column, filter.value)
      }
      const { count, error } = await query.abortSignal(signal)
      if (error) {
        throw error
      }
      return count ?? 0
    },
    [],
  )

  const loadCounts = useCallback(
    async (signal: AbortSignal): Promise<EntityCounts> => {
      if (!delegacionId) {
        return {
          movimientos: null,
          categorias: null,
          cuentas: null,
        }
      }

      const tasks: Array<[keyof EntityCounts, Promise<number>]> = [
        [
          "movimientos",
          fetchCount(
            "movimiento",
            [{ column: "delegacion_id", value: delegacionId }],
            signal,
          ),
        ],
        [
          "cuentas",
          fetchCount(
            "cuenta",
            [{ column: "delegacion_id", value: delegacionId }],
            signal,
          ),
        ],
      ]

      if (organizacionId) {
        tasks.push([
          "categorias",
          fetchCount(
            "categoria",
            [{ column: "organizacion_id", value: organizacionId }],
            signal,
          ),
        ])
      }

      const results = await Promise.all(tasks.map(([, promise]) => promise))

      const nextCounts: EntityCounts = {
        movimientos: 0,
        categorias: organizacionId ? 0 : null,
        cuentas: 0,
      }

      tasks.forEach(([key], index) => {
        nextCounts[key] = results[index]
      })

      if (!organizacionId) {
        nextCounts.categorias = null
      }

      return nextCounts
    },
    [delegacionId, organizacionId, fetchCount],
  )

  const refetch = useCallback(async () => {
    if (!delegacionId) {
      const emptyCounts: EntityCounts = {
        movimientos: null,
        categorias: null,
        cuentas: null,
      }
      setCounts(emptyCounts)
      setError(null)
      setLoading(false)
      return emptyCounts
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
      setLoading(true)
      setError(null)
      const result = await loadCounts(controller.signal)
      setCounts(result)
      return result
    } catch (err) {
      if (isAbortError(err)) {
        return counts
      }
      const message = err instanceof Error ? err.message : "Error al obtener los contadores"
      setError(message)
      throw err
    } finally {
      clearTimeout(timeoutId)
      setLoading(false)
    }
  }, [counts, delegacionId, loadCounts, timeoutMs])

  useEffect(() => {
    if (!delegacionId) {
      setCounts({ movimientos: null, categorias: null, cuentas: null })
      setError(null)
      setLoading(false)
      return
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    let isActive = true

    setLoading(true)
    setError(null)

    loadCounts(controller.signal)
      .then((result) => {
        if (!isActive) return
        setCounts(result)
      })
      .catch((err) => {
        if (!isActive || isAbortError(err)) return
        const message = err instanceof Error ? err.message : "Error al obtener los contadores"
        setError(message)
      })
      .finally(() => {
        clearTimeout(timeoutId)
        if (isActive) {
          setLoading(false)
        }
      })

    return () => {
      isActive = false
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [delegacionId, loadCounts, timeoutMs])

  return { counts, loading, error, refetch }
}
