"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import type { Categoria } from "@/lib/types/database"
import { useRevalidateOnFocus } from "./use-app-status"

export function useCategorias(organizacionId?: string) {
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCategorias = useCallback(async () => {
    try {
      setLoading(true)

      let query = supabase
        .from("categoria")
        .select("*")
        .order("orden", { ascending: true })
        .order("nombre", { ascending: true })

      if (organizacionId) {
        query = query.eq("organizacion_id", organizacionId)
      }

      const { data, error } = await query

      if (error) {
        setError(error.message)
        return
      }

      setCategorias(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [organizacionId])

  useEffect(() => {
    fetchCategorias()
  }, [fetchCategorias])

  // Revalidate on focus
  useRevalidateOnFocus(fetchCategorias)

  const updateCategoria = async (id: string, updates: Partial<Categoria>) => {
    try {
      const { error } = await supabase.from("categoria").update(updates).eq("id", id)

      if (error) throw error

      setCategorias((prev) => prev.map((cat) => (cat.id === id ? { ...cat, ...updates } : cat)))
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar categoría")
    }
  }

  return { categorias, loading, error, updateCategoria }
}
