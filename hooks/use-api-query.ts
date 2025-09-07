"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useRevalidateOnFocusJitter } from "./use-app-status"

interface UseApiQueryOptions<T> {
  queryFn: (signal: AbortSignal) => Promise<T>
  key: any[]
  enabled?: boolean
  ttlMs?: number // Time to live for cache
}

export function useApiQuery<T>({
  queryFn,
  key,
  enabled = true,
  ttlMs = 30000,
}: UseApiQueryOptions<T>) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const lastFetchAtRef = useRef<number>(0)
  const lastKeyRef = useRef<string | null>(null)

  const serializedKey = JSON.stringify(key)

  const fetchData = useCallback(
    async (force = false) => {
      if (!enabled) {
        setLoading(false)
        return
      }

      const now = Date.now()
      const isSameKey = serializedKey === lastKeyRef.current
      const isFresh = now - lastFetchAtRef.current < ttlMs

      if (!force && isSameKey && isFresh && data) {
        return
      }

      lastKeyRef.current = serializedKey
      abortControllerRef.current?.abort()
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      setLoading(true)
      setError(null)

      try {
        const result = await queryFn(abortController.signal)
        if (!abortController.signal.aborted) {
          setData(result)
          lastFetchAtRef.current = Date.now()
        }
      } catch (err) {
        if (err.name !== "AbortError") {
          const errorMessage = err instanceof Error ? err.message : "Error desconocido"
          setError(errorMessage)
        }
      } finally {
        if (!abortController.signal.aborted) {
          setLoading(false)
        }
      }
    },
    [queryFn, enabled, serializedKey, ttlMs, data]
  )

  useEffect(() => {
    fetchData()
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [fetchData])

  useRevalidateOnFocusJitter(() => fetchData(true), { minMs: 70, maxMs: 180 })

  const forceRefresh = useCallback(() => {
    fetchData(true)
  }, [fetchData])

  return { data, loading, error, refetch: fetchData, forceRefresh, setData }
}
