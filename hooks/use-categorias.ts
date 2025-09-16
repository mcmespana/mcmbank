"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import type { Categoria } from "@/lib/types/database"
import { useRevalidateOnFocusJitter } from "./use-app-status"
import { runQuery } from "@/lib/db/query"

export function useCategorias(delegacionId?: string) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const TIMEOUT_MS = 12000

  const fetchCategorias = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    if (!delegacionId) {
      setCategorias([])
      setLoading(false)
      setError(null)
      return
    }

    const ac = new AbortController()
    abortRef.current = ac
    try {
      setLoading(true)

      const { data, error } = await runQuery<Categoria[]>({
        label: 'fetch-categorias',
        table: 'categoria',
        timeoutMs: TIMEOUT_MS,
        build: async (signal) => {
          return await supabase
            .from("categoria")
            .select("*")
            .in("delegacion_id", [delegacionId, null])
            .order("orden", { ascending: true })
            .order("nombre", { ascending: true })
            .abortSignal(signal)
        }
      })

      if (error) {
        setError(error.message)
        return
      }

      const filtered = (data || []).filter(
        (cat) => cat.es_global || cat.delegacion_id === delegacionId,
      )

      setCategorias(filtered)
    } catch (err) {
      if (!ac.signal.aborted) {
        setError(err instanceof Error ? err.message : "Error desconocido")
      }
    } finally {
      setLoading(false)
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [delegacionId])

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

      setCategorias((prev) =>
        prev
          .map((cat) => (cat.id === id ? { ...cat, ...updates } : cat))
          .filter((cat) => cat.es_global || cat.delegacion_id === delegacionId),
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar categoría")
    }
  }

  return { categorias, loading, error, updateCategoria, fetchCategorias }
}
