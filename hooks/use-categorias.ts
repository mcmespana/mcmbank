"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import type { Categoria } from "@/lib/types/database"
import { useRevalidateOnFocusJitter } from "./use-app-status"
import { runQuery } from "@/lib/db/query"

export function useCategorias(
  delegacionId?: string | null,
  options?: { includeGlobal?: boolean },
) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const TIMEOUT_MS = 12000
  const includeGlobal = options?.includeGlobal ?? true

  const fetchCategorias = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    const ac = new AbortController()
    abortRef.current = ac
    timeoutRef.current = setTimeout(() => {
      if (!ac.signal.aborted) {
        ac.abort()
      }
    }, TIMEOUT_MS + 1000)

    try {
      if (!delegacionId && !includeGlobal) {
        setCategorias([])
        setLoading(false)
        return
      }

      setLoading(true)

      const { data, error } = await runQuery<Categoria[]>({
        label: 'fetch-categorias',
        table: 'categoria',
        timeoutMs: TIMEOUT_MS,
        externalSignal: ac.signal,
        build: async (signal) => {
          let query = supabase
            .from("categoria")
            .select("*")
            .order("orden", { ascending: true })
            .order("nombre", { ascending: true })
          if (delegacionId) {
            query = includeGlobal
              ? query.or(`delegacion_id.eq.${delegacionId},es_global.is.true`)
              : query.eq("delegacion_id", delegacionId)
          } else if (includeGlobal) {
            query = query.eq("es_global", true)
          }
          return await query.abortSignal(signal)
        }
      })

      if (error) {
        setError(error.message)
        return
      }

      if (ac.signal.aborted) {
        return
      }

      setCategorias(
        (data || []).sort((a, b) => {
          if (a.es_global !== b.es_global) {
            return a.es_global ? -1 : 1
          }
          return a.orden - b.orden
        }),
      )
    } catch (err) {
      const aborted = ac.signal.aborted || (err instanceof DOMException && err.name === "AbortError")
      if (!aborted) {
        setError(err instanceof Error ? err.message : "Error desconocido")
      }
    } finally {
      setLoading(false)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [delegacionId, includeGlobal])

  useEffect(() => {
    fetchCategorias()
    return () => {
      if (abortRef.current) abortRef.current.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [fetchCategorias])

  // Revalidate on focus
  useRevalidateOnFocusJitter(fetchCategorias, { minMs: 60, maxMs: 160 })

  const updateCategoria = async (id: string, updates: Partial<Categoria>) => {
    try {
      const { error } = await supabase.from("categoria").update(updates).eq("id", id)

      if (error) throw error

      setCategorias((prev) => prev.map((cat) => (cat.id === id ? { ...cat, ...updates } : cat)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar categoría")
    }
  }

  return { categorias, loading, error, updateCategoria, fetchCategorias }
}
