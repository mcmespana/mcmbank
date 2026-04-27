"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import type { CategoriaConOrdenEfectivo } from "@/lib/types/database"
import { useRevalidateOnFocusJitter } from "./use-app-status"
import { DatabaseService } from "@/lib/services/database"
import { registerAC, unregisterAC } from "@/lib/db/in-flight"

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

const QUERY_TIMEOUT_MS = 12000

export function useCategorias(
  delegacionId?: string | null,
  options?: { includeGlobal?: boolean; includeInactive?: boolean },
) {
  const [categorias, setCategorias] = useState<CategoriaConOrdenEfectivo[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const categoriasRef = useRef(categorias)
  categoriasRef.current = categorias
  const includeGlobal = options?.includeGlobal ?? true
  const includeInactive = options?.includeInactive ?? false

  const fetchCategorias = useCallback(async () => {
    // Abort previous in-flight request
    if (abortRef.current) {
      abortRef.current.abort()
      unregisterAC(abortRef.current)
    }

    const ac = new AbortController()
    abortRef.current = ac
    registerAC(ac)

    try {
      if (!delegacionId && !includeGlobal) {
        setCategorias([])
        setLoading(false)
        return
      }

      // Only show full spinner on initial load; keep existing data visible on refresh
      if (categoriasRef.current.length === 0) {
        setLoading(true)
      }

      // Hard timeout so zombie fetches resolve instead of hanging forever
      const data = await Promise.race([
        DatabaseService.getCategoriasByDelegacion(delegacionId, {
          includeGlobal,
          includeInactive,
          signal: ac.signal,
        }),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`categorias timeout after ${QUERY_TIMEOUT_MS}ms`)), QUERY_TIMEOUT_MS),
        ),
      ])

      if (ac.signal.aborted) return

      setCategorias(data)
      setError(null)
    } catch (err) {
      if (ac.signal.aborted) return
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      unregisterAC(ac)
      // Only clear loading if this request wasn't superseded by a newer one
      if (!ac.signal.aborted) setLoading(false)
    }
  }, [delegacionId, includeGlobal, includeInactive])

  const fetchCategoriasRef = useRef(fetchCategorias)
  fetchCategoriasRef.current = fetchCategorias

  useEffect(() => {
    fetchCategoriasRef.current()
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
        unregisterAC(abortRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [delegacionId, includeGlobal, includeInactive])

  useRevalidateOnFocusJitter(() => fetchCategoriasRef.current(), { minMs: 60, maxMs: 160 })

  const updateCategoria = async (id: string, updates: Partial<CategoriaConOrdenEfectivo>) => {
    try {
      await DatabaseService.updateCategoria(id, updates)

      setCategorias((prev) => {
        const next = prev.map((cat) => {
          if (cat.id !== id) return cat
          const orden_base = updates.orden ?? cat.orden_base ?? cat.orden
          const orden_override = cat.orden_override
          const orden_efectivo = orden_override ?? orden_base
          const esta_activa = updates.esta_activa ?? cat.esta_activa
          const esta_activa_override = cat.esta_activa_override
          const esta_activa_efectiva =
            esta_activa_override !== null ? esta_activa_override : esta_activa
          return {
            ...cat,
            ...updates,
            orden: orden_base,
            orden_base,
            orden_efectivo,
            esta_activa,
            esta_activa_override,
            esta_activa_efectiva,
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
            has_override: orden_override !== null || cat.has_override,
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
