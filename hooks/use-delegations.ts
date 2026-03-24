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
  const isRevalidatingRef = useRef(false)

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

    const t0 = performance.now()
    const silent = isRevalidatingRef.current
    console.log(`[MCM:Net:delegations] → Fetching${silent ? ' (stale-while-revalidate)' : ''}`)

    const attempt = async () => {
      if (!silent) {
        setLoading(true)
      }
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
      const sortedDelegations = [...userDelegations].sort((a, b) =>
        (a?.nombre || "").localeCompare(b?.nombre || "", "es", { sensitivity: "base" }),
      )
      // Only update state if data actually changed (prevents DelegationContext cascade)
      setDelegations(prev => {
        if (prev.length === sortedDelegations.length &&
            prev.every((d, i) => d.id === sortedDelegations[i].id && d.nombre === sortedDelegations[i].nombre)) {
          console.log(`[MCM:Net:delegations] ← Same data, skipping state update (${(performance.now() - t0).toFixed(0)}ms)`)
          return prev
        }
        console.log(`[MCM:Net:delegations] ← Updated: ${sortedDelegations.length} delegations in ${(performance.now() - t0).toFixed(0)}ms`)
        return sortedDelegations
      })
    }

    try {
      await attempt()
    } catch (err) {
      console.error("useDelegations: initial fetch failed", err)
      if (abortController.signal.aborted) {
        // Mark as not loading to avoid spinners stuck on abort/timeout
        setLoading(false)
        return
      }
      // Retry once — runQuery and useAppStatus already handle session refresh
      try {
        await attempt()
      } catch (e2) {
        setError(e2 instanceof Error ? e2.message : "Error cargando delegaciones")
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
      isRevalidatingRef.current = false
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [user?.id, timeout])

  // Ref to avoid effect cleanup aborting in-flight requests on callback identity change
  const fetchDelegationsRef = useRef(fetchDelegations)
  fetchDelegationsRef.current = fetchDelegations

  useEffect(() => {
    fetchDelegationsRef.current()
    return () => {
      if (abortControllerRef.current) abortControllerRef.current.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Revalidate on tab focus
  useRevalidateOnFocusJitter(() => {
    isRevalidatingRef.current = true
    fetchDelegationsRef.current()
  }, { minMs: 40, maxMs: 140 })

  return { delegations, loading, error, refetch: fetchDelegations }
}
