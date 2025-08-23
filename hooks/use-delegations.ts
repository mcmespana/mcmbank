"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Delegacion } from "@/lib/types/database"
import { useRevalidateOnFocusJitter } from "@/hooks/use-app-status"
import { runQuery } from "@/lib/db/query"

// Robust delegations hook with timeout, cancelation, and focus revalidation
export function useDelegations({ timeout = 10000 }: { timeout?: number } = {}) {
  const [delegations, setDelegations] = useState<Delegacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const abortControllerRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  const fetchDelegations = useCallback(async () => {
    if (!user) {
      setDelegations([])
      setLoading(false)
      return
    }

    // Cancel previous pending request (if any)
    if (abortControllerRef.current) abortControllerRef.current.abort()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    const abortController = new AbortController()
    abortControllerRef.current = abortController

    const attempt = async () => {
      setLoading(true)
      setError(null)

      const { data, error } = await runQuery<{ delegacion_id: string; delegacion: any }[]>({
        label: 'fetch-delegaciones',
        table: 'membresia',
        timeoutMs: timeout,
        build: async (signal) =>
          await supabase
            .from("membresia")
            .select(`
              delegacion_id,
              delegacion:delegacion_id (
                id,
                organizacion_id,
                codigo,
                nombre,
                creado_en
              )
            `)
            .eq("usuario_id", user.id)
            .abortSignal(signal),
      })

      if (error) throw error

      const userDelegations = (data?.map((item: any) => item.delegacion).filter(Boolean) || []) as Delegacion[]
      setDelegations(userDelegations)
    }

    try {
      await attempt()
    } catch (err) {
      if (abortController.signal.aborted) {
        // Mark as not loading to avoid spinners stuck on abort/timeout
        setLoading(false)
        return
      }
      // Retry once after refreshing session in case token expired in background
      try {
        await supabase.auth.refreshSession()
        await attempt()
      } catch (e2) {
        setError(e2 instanceof Error ? e2.message : "Error cargando delegaciones")
      }
    } finally {
      // Always clear loading state; a new fetch will set it to true again
      setLoading(false)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [user, timeout])

  useEffect(() => {
    fetchDelegations()
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [fetchDelegations])

  // Revalidate on tab focus
  useRevalidateOnFocusJitter(fetchDelegations, { minMs: 40, maxMs: 140 })

  return { delegations, loading, error, refetch: fetchDelegations }
}
