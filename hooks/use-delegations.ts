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
  const hasCachedDelegationsRef = useRef(false)

  const fetchDelegations = useCallback(async () => {
    if (!user) {
      setDelegations([])
      setLoading(false)
      return
    }

    if (abortControllerRef.current) abortControllerRef.current.abort()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    const abortController = new AbortController()
    abortControllerRef.current = abortController
    let didTimeout = false

    const fetchFromSupabase = async () => {
      const { data, error } = await runQuery<{ delegacion_id: string; delegacion: any }[]>({
        label: "fetch-delegaciones",
        table: "membresia",
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

      if (error) {
        throw error instanceof Error
          ? error
          : new Error(typeof error === "string" ? error : "Error cargando delegaciones")
      }

      const userDelegations = (data?.map((item: any) => item.delegacion).filter(Boolean) || []) as Delegacion[]
      setDelegations(userDelegations)
    }

    try {
      // Only show the blocking spinner when we have nothing cached
      if (!hasCachedDelegationsRef.current) {
        setLoading(true)
      }
      setError(null)

      timeoutRef.current = setTimeout(() => {
        didTimeout = true
        abortController.abort()
      }, timeout)

      const response = await fetch("/api/delegaciones", {
        method: "GET",
        headers: { Accept: "application/json" },
        signal: abortController.signal,
      })

      if (!response.ok) {
        if (response.status === 401) {
          setDelegations([])
          setError("Sesión no válida. Inicia sesión de nuevo.")
          return
        }

        let payload: any = null
        try {
          payload = await response.json()
        } catch {
          // no-op: keep generic error below
        }

        throw new Error(payload?.error ?? "Error cargando delegaciones")
      }

      const payload = (await response.json()) as { delegaciones?: Delegacion[] }
      const serverDelegations = (payload?.delegaciones ?? []) as Delegacion[]
      setDelegations(serverDelegations)
    } catch (err) {
      if (abortController.signal.aborted) {
        if (didTimeout) {
          setError("La solicitud de delegaciones tardó demasiado. Intenta nuevamente.")
        }
        return
      }

      console.warn("Fallo la API de delegaciones, usando Supabase como respaldo.", err)

      try {
        await fetchFromSupabase()
      } catch (fallbackError) {
        setError(
          fallbackError instanceof Error
            ? fallbackError.message
            : "Error cargando delegaciones",
        )
      }
    } finally {
      setLoading(false)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [user, timeout])

  useEffect(() => {
    hasCachedDelegationsRef.current = delegations.length > 0
  }, [delegations.length])

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
