"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import type { MovimientoConRelaciones } from "@/lib/types/database"
import { useRevalidateOnFocus } from "./use-app-status"

interface MovimientosFilters {
  fechaDesde?: string
  fechaHasta?: string
  categoriaIds?: string[]
  cuentaId?: string
  busqueda?: string
  amountFrom?: number
  amountTo?: number
  uncategorized?: boolean
}

export function useMovimientos(delegacionId: string | null, filters?: MovimientosFilters) {
  const [movimientos, setMovimientos] = useState<MovimientoConRelaciones[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchIdRef = useRef(0)
  const lastQueryKeyRef = useRef<string | null>(null)

  const fetchMovimientos = useCallback(async () => {
    const queryKey = [
      delegacionId || "",
      filters?.fechaDesde || "",
      filters?.fechaHasta || "",
      (filters?.categoryIds || []).join(","),
      filters?.cuentaId || "",
      filters?.busqueda || "",
      filters?.amountFrom || "",
      filters?.amountTo || "",
      filters?.uncategorized || "",
    ].join("|")

    if (lastQueryKeyRef.current === queryKey) {
      return
    }
    lastQueryKeyRef.current = queryKey
    const fetchId = ++fetchIdRef.current
    if (!delegacionId) {
      setMovimientos([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from("movimiento")
        .select(`
          *,
          cuenta:cuenta_id (
            *,
            delegacion:delegacion_id (
              id,
              organizacion_id,
              codigo,
              nombre,
              creado_en
            )
          ),
          categoria:categoria_id (
            id,
            organizacion_id,
            nombre,
            tipo,
            emoji,
            orden,
            categoria_padre_id,
            creado_en
          )
        `)
        .eq("cuenta.delegacion_id", delegacionId)
        .order("fecha", { ascending: false })
        // Limit results to prevent UI freezing with large datasets
        .limit(100)

      if (filters?.fechaDesde) {
        query = query.gte("fecha", filters.fechaDesde)
      }
      if (filters?.fechaHasta) {
        query = query.lte("fecha", filters.fechaHasta)
      }
      if (filters?.categoryIds && filters.categoryIds.length > 0) {
        query = query.in("categoria_id", filters.categoryIds)
      }
      if (filters?.uncategorized) {
        query = query.is("categoria_id", null)
      }
      if (filters?.cuentaId) {
        query = query.eq("cuenta_id", filters.cuentaId)
      }
      if (filters?.busqueda) {
        query = query.or(`concepto.ilike.%${filters.busqueda}%,descripcion.ilike.%${filters.busqueda}%`)
      }
      if (filters?.amountFrom !== undefined) {
        query = query.gte("importe", filters.amountFrom)
      }
      if (filters?.amountTo !== undefined) {
        query = query.lte("importe", filters.amountTo)
      }

      const { data, error } = await query

      if (fetchId !== fetchIdRef.current) {
        return
      }

      if (error) throw error
      setMovimientos(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [
    delegacionId,
    filters?.fechaDesde,
    filters?.fechaHasta,
    filters?.categoriaId,
    filters?.cuentaId,
    filters?.busqueda,
  ])

  useEffect(() => {
    let cancelled = false
    const timeoutId = setTimeout(() => {
      if (!cancelled) {
        fetchMovimientos()
      }
    }, 80)
    return () => {
      cancelled = true
      clearTimeout(timeoutId)
    }
  }, [fetchMovimientos])

  // Revalidate on focus
  useRevalidateOnFocus(fetchMovimientos)

  const updateCategoria = async (movimientoId: string, categoriaId: string | null) => {
    try {
      const { error } = await supabase.from("movimiento").update({ categoria_id: categoriaId }).eq("id", movimientoId)

      if (error) throw error

      // Update local state
      setMovimientos((prev) =>
        prev.map((mov) => (mov.id === movimientoId ? { ...mov, categoria_id: categoriaId } : mov)),
      )
    } catch (err) {
      throw err
    }
  }

  return {
    movimientos,
    loading,
    error,
    refetch: fetchMovimientos,
    updateCategoria,
  }
}
