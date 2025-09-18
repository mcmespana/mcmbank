"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { CategoriaConOrdenEfectivo } from "@/lib/types/database"
import { useRevalidateOnFocusJitter } from "./use-app-status"
import { DatabaseService } from "@/lib/services/database"

type CategoriaOrdenChange = {
  categoriaId: string
  orden: number | null
}

const sortCategorias = (categorias: CategoriaConOrdenEfectivo[]) =>
  [...categorias].sort((a, b) => {
    if (a.orden_efectivo !== b.orden_efectivo) {
      return a.orden_efectivo - b.orden_efectivo
    }
    return a.nombre.localeCompare(b.nombre)
  })

export function useCategorias(
  delegacionId?: string | null,
  options?: { includeGlobal?: boolean },
) {
  const [categorias, setCategorias] = useState<CategoriaConOrdenEfectivo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const includeGlobal = options?.includeGlobal ?? true

  const fetchCategorias = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()

    const ac = new AbortController()
    abortRef.current = ac
    try {
      if (!delegacionId && !includeGlobal) {
        setCategorias([])
        setLoading(false)
        return
      }

      setLoading(true)

      const data = await DatabaseService.getCategoriasByDelegacion(delegacionId, {
        includeGlobal,
        signal: ac.signal,
      })

      setCategorias(data)
      setError(null)
    } catch (err) {
      if (!ac.signal.aborted) {
        setError(err instanceof Error ? err.message : "Error desconocido")
      }
    } finally {
      setLoading(false)
    }
  }, [delegacionId, includeGlobal])

  useEffect(() => {
    fetchCategorias()
    return () => {
      if (abortRef.current) abortRef.current.abort()
    }
  }, [fetchCategorias])

  // Revalidate on focus
  useRevalidateOnFocusJitter(fetchCategorias, { minMs: 60, maxMs: 160 })

  const updateCategoria = async (id: string, updates: Partial<CategoriaConOrdenEfectivo>) => {
    try {
      await DatabaseService.updateCategoria(id, updates)

      setCategorias((prev) => {
        const next = prev.map((cat) => {
          if (cat.id !== id) return cat
          const orden_base = updates.orden ?? cat.orden_base ?? cat.orden
          const orden_override = cat.orden_override
          const orden_efectivo = orden_override ?? orden_base
          return {
            ...cat,
            ...updates,
            orden: orden_base,
            orden_base,
            orden_efectivo,
          }
        })
        return sortCategorias(next)
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al actualizar categoría")
      throw err
    }
  }

  const saveCategoriaOrdenes = async (changes: CategoriaOrdenChange[]) => {
    if (!delegacionId) {
      throw new Error("Se requiere una delegación para guardar el orden")
    }

    try {
      await Promise.all(
        changes.map((change) =>
          change.orden === null
            ? DatabaseService.clearDelegacionCategoryOrder(delegacionId, change.categoriaId)
            : DatabaseService.setDelegacionCategoryOrder(delegacionId, change.categoriaId, change.orden),
        ),
      )

      setCategorias((prev) => {
        const changeMap = new Map(changes.map((change) => [change.categoriaId, change]))
        const next = prev.map((cat) => {
          const change = changeMap.get(cat.id)
          if (!change) return cat
          const orden_override = change.orden
          const orden_base = cat.orden_base ?? cat.orden
          const orden_efectivo = orden_override ?? orden_base
          return {
            ...cat,
            orden_override,
            orden_efectivo,
          }
        })
        return sortCategorias(next)
      })
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar el orden de categorías")
      throw err
    }
  }

  return { categorias, loading, error, updateCategoria, fetchCategorias, saveCategoriaOrdenes }
}
