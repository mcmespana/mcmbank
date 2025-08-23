"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import type { Categoria } from "@/lib/types/database"
import { useRevalidateOnFocusJitter } from "./use-app-status"
import { runQuery } from "@/lib/db/query"

export function useCategorias(organizacionId?: string) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const TIMEOUT_MS = 12000

  const fetchCategorias = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    if (timeoutRef.current) clearTimeout(timeoutRef.current)

    const ac = new AbortController()
    abortRef.current = ac
    try {
      setLoading(true)

      const { data, error } = await runQuery<any[]>({
        label: 'fetch-categorias',
        table: 'categoria',
        timeoutMs: TIMEOUT_MS,
        build: async (signal) => {
          let query = supabase
            .from("categoria")
            .select("*")
            .order("orden", { ascending: true })
            .order("nombre", { ascending: true })
          if (organizacionId) query = query.eq("organizacion_id", organizacionId)
          return await query.abortSignal(signal)
        }
      })

      if (error) {
        setError(error.message)
        return
      }

      setCategorias(data || [])
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
  }, [organizacionId])

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
