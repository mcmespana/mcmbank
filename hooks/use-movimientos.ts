"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import type { Movimiento } from "@/lib/types/database"
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

const PAGE_SIZE = 100

export function useMovimientos(delegacionId: string | null, filters: MovimientosFilters = {}) {
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const fetchMovimientos = useCallback(
    async (pageToFetch: number, append: boolean) => {
      if (!delegacionId) {
        setMovimientos([])
        setHasMore(false)
        setLoading(false)
        return
      }

      try {
        append ? setLoadingMore(true) : setLoading(true)
        setError(null)

        let query = supabase
          .from("movimiento")
          .select("*")
          .eq("delegacion_id", delegacionId)
          .order("fecha", { ascending: false })
          .order("creado_en", { ascending: false })
          .range(pageToFetch * PAGE_SIZE, pageToFetch * PAGE_SIZE + PAGE_SIZE - 1)

        if (filters.fechaDesde) {
          query = query.gte("fecha", filters.fechaDesde)
        }
        if (filters.fechaHasta) {
          query = query.lte("fecha", filters.fechaHasta)
        }
        if (filters.categoriaIds && filters.categoriaIds.length > 0) {
          query = query.in("categoria_id", filters.categoriaIds)
        }
        if (filters.uncategorized) {
          query = query.is("categoria_id", null)
        }
        if (filters.cuentaId) {
          query = query.eq("cuenta_id", filters.cuentaId)
        }
        if (filters.busqueda) {
          query = query.or(
            `concepto.ilike.%${filters.busqueda}%,descripcion.ilike.%${filters.busqueda}%`
          )
        }
        if (filters.amountFrom !== undefined) {
          query = query.gte("importe", filters.amountFrom)
        }
        if (filters.amountTo !== undefined) {
          query = query.lte("importe", filters.amountTo)
        }

        const { data, error } = await query
        if (error) throw error

        setMovimientos(prev => (append ? [...prev, ...(data || [])] : data || []))
        setHasMore((data?.length || 0) === PAGE_SIZE)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido")
      } finally {
        append ? setLoadingMore(false) : setLoading(false)
      }
    },
    [delegacionId, filters]
  )

  useEffect(() => {
    setMovimientos([])
    setPage(0)
    setHasMore(true)
    fetchMovimientos(0, false)
  }, [delegacionId, filters, fetchMovimientos])

  useRevalidateOnFocus(() => fetchMovimientos(0, false))

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchMovimientos(nextPage, true)
  }, [page, loadingMore, hasMore, fetchMovimientos])

  const updateCategoria = async (movimientoId: string, categoriaId: string | null) => {
    const { error } = await supabase
      .from("movimiento")
      .update({ categoria_id: categoriaId })
      .eq("id", movimientoId)
    if (error) throw error
    setMovimientos(prev =>
      prev.map(m => (m.id === movimientoId ? { ...m, categoria_id: categoriaId } : m))
    )
  }

  const refetch = useCallback(() => {
    setMovimientos([])
    setPage(0)
    setHasMore(true)
    return fetchMovimientos(0, false)
  }, [fetchMovimientos])

  return {
    movimientos,
    loading,
    error,
    loadMore,
    hasMore,
    loadingMore,
    refetch,
    updateCategoria,
  }
}

