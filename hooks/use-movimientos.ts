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
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [total, setTotal] = useState(0)
  const pageSize = 100

  const fetchIdRef = useRef(0)
  const lastQueryKeyRef = useRef<string | null>(null)

  const fetchMovimientos = useCallback(
    async (pageArg = 0, append = false, forceRefresh = false) => {
      const queryKey = [
        delegacionId || "",
        filters?.fechaDesde || "",
        filters?.fechaHasta || "",
        (filters?.categoriaIds || []).join(","),
        filters?.cuentaId || "",
        filters?.busqueda || "",
        filters?.amountFrom || "",
        filters?.amountTo || "",
        filters?.uncategorized || "",
      ].join("|")

      if (!forceRefresh && !append && lastQueryKeyRef.current === queryKey) {
        return
      }
      lastQueryKeyRef.current = queryKey
      const fetchId = ++fetchIdRef.current

      if (!delegacionId) {
        setMovimientos([])
        setLoading(false)
        setHasMore(false)
        setTotal(0)
        return
      }

      try {
        append ? setLoadingMore(true) : setLoading(true)
        setError(null)

        let query = supabase
          .from("movimiento")
          .select(
            `
            *,
            cuenta:cuenta_id (*),
            categoria:categoria_id (*)
            `,
            { count: "exact" },
          )
          .eq("delegacion_id", delegacionId)
          .order("fecha", { ascending: false })
          .order("creado_en", { ascending: false })
          .range(pageArg * pageSize, pageArg * pageSize + pageSize - 1)

        if (filters?.fechaDesde) {
          query = query.gte("fecha", filters.fechaDesde)
        }
        if (filters?.fechaHasta) {
          query = query.lte("fecha", filters.fechaHasta)
        }
        if (filters?.categoriaIds && filters.categoriaIds.length > 0) {
          query = query.in("categoria_id", filters.categoriaIds)
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

        const { data, error, count } = await query

        if (fetchId !== fetchIdRef.current) {
          return
        }

        if (error) throw error
        setTotal(count || 0)
        if (append) {
          setMovimientos((prev) => [...prev, ...(data || [])])
        } else {
          setMovimientos(data || [])
        }
        setHasMore((data?.length || 0) === pageSize)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido")
      } finally {
        append ? setLoadingMore(false) : setLoading(false)
      }
    },
    [
      delegacionId,
      filters?.fechaDesde,
      filters?.fechaHasta,
      filters?.categoriaIds,
      filters?.cuentaId,
      filters?.busqueda,
      filters?.amountFrom,
      filters?.amountTo,
      filters?.uncategorized,
      pageSize,
    ],
  )

  useEffect(() => {
    setPage(0)
    setHasMore(true)
    fetchMovimientos(0, false, true)
  }, [fetchMovimientos])

  // Revalidate on focus
  useRevalidateOnFocus(() => fetchMovimientos(0, false, true))

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchMovimientos(nextPage, true, true)
  }, [fetchMovimientos, hasMore, loadingMore, page])

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
    loadingMore,
    error,
    hasMore,
    total,
    loadMore,
    refetch: () => {
      lastQueryKeyRef.current = null
      return fetchMovimientos(0, false, true)
    },
    updateCategoria,
  }
}
