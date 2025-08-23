"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import type { MovimientoConRelaciones } from "@/lib/types/database"
import { useRevalidateOnFocusJitter } from "./use-app-status"
import { runQuery } from "@/lib/db/query"

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

export function useMovimientos(
  delegacionId: string | null,
  filters?: MovimientosFilters,
  options: { timeoutMs?: number } = {}
) {
  const [movimientos, setMovimientos] = useState<MovimientoConRelaciones[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const fetchIdRef = useRef(0)
  const abortRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const timeoutMs = options.timeoutMs ?? 15000

  const fetchMovimientos = useCallback(
    async (pageToLoad = 0, append = false) => {
      const fetchId = ++fetchIdRef.current

      if (!delegacionId) {
        setMovimientos([])
        setHasMore(false)
        return
      }

      // Cancel previous in-flight query
      if (abortRef.current) abortRef.current.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)

      const ac = new AbortController()
      abortRef.current = ac

      try {
        setLoading(true)
        setError(null)

        const from = pageToLoad * PAGE_SIZE
        const to = from + PAGE_SIZE - 1

        const build = async (signal: AbortSignal) => {
          let query = supabase
            .from("movimiento")
            .select(
              `*,
              cuenta:cuenta_id (*),
              categoria:categoria_id (
                id,
                organizacion_id,
                nombre,
                tipo,
                emoji,
                orden,
                categoria_padre_id,
                creado_en
              ),
              archivos:movimiento_archivo!movimiento_id (
                id,
                nombre_original,
                es_factura,
                bucket
              )
            `,
              { count: "exact" }
            )
            .eq("delegacion_id", delegacionId)
            .order("fecha", { ascending: false })
            .order("creado_en", { ascending: false })
            .range(from, to)
            .abortSignal(signal)

          if (filters?.fechaDesde) query = query.gte("fecha", filters.fechaDesde)
          if (filters?.fechaHasta) query = query.lte("fecha", filters.fechaHasta)
          if (filters?.categoriaIds && filters.categoriaIds.length > 0) query = query.in("categoria_id", filters.categoriaIds)
          if (filters?.uncategorized) query = query.is("categoria_id", null)
          if (filters?.cuentaId) query = query.eq("cuenta_id", filters.cuentaId)
          if (filters?.busqueda) query = query.or(`concepto.ilike.%${filters.busqueda}%,descripcion.ilike.%${filters.busqueda}%`)
          if (filters?.amountFrom !== undefined) query = query.gte("importe", filters.amountFrom)
          if (filters?.amountTo !== undefined) query = query.lte("importe", filters.amountTo)
          return await query
        }

        timeoutRef.current = setTimeout(() => ac.abort(), timeoutMs)
        const { data, error } = await runQuery<any[]>({
          label: 'fetch-movimientos',
          table: 'movimiento',
          timeoutMs,
          build
        })

        if (fetchId !== fetchIdRef.current) return

        if (error) throw error

        setMovimientos(prev => (append ? [...prev, ...(data || [])] : (data || [])))
        if ((data || []).length < PAGE_SIZE) {
          setHasMore(false)
        }
      } catch (err) {
        if (ac.signal.aborted) {
          setError(null)
        } else {
          setError(err instanceof Error ? err.message : "Error desconocido")
        }
      } finally {
        setLoading(false)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }
    },
    [delegacionId, filters?.fechaDesde, filters?.fechaHasta, (filters?.categoriaIds || []).join(","), filters?.cuentaId, filters?.busqueda, filters?.amountFrom, filters?.amountTo, filters?.uncategorized, timeoutMs]
  )

  useEffect(() => {
    // Cleanup any in-flight when dependencies change
    if (abortRef.current) abortRef.current.abort()

    // keep current data to avoid empty flash if new fetch fails; replace on success
    setPage(0)
    setHasMore(true)
    fetchMovimientos(0, false)
    return () => {
      if (abortRef.current) abortRef.current.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [delegacionId, filters?.fechaDesde, filters?.fechaHasta, (filters?.categoriaIds || []).join(","), filters?.cuentaId, filters?.busqueda, filters?.amountFrom, filters?.amountTo, filters?.uncategorized, fetchMovimientos])

  useRevalidateOnFocusJitter(() => fetchMovimientos(0, false), { minMs: 90, maxMs: 220 })

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchMovimientos(nextPage, true)
  }, [loading, hasMore, page, fetchMovimientos])

  const updateCategoria = async (movimientoId: string, categoriaId: string | null) => {
    try {
      const { error } = await supabase.from("movimiento").update({ categoria_id: categoriaId }).eq("id", movimientoId)
      if (error) throw error
      setMovimientos(prev => prev.map(mov => (mov.id === movimientoId ? { ...mov, categoria_id: categoriaId } : mov)))
    } catch (err) {
      throw err
    }
  }

  const refetch = () => {
    setMovimientos([])
    setPage(0)
    setHasMore(true)
    return fetchMovimientos(0, false)
  }

  return {
    movimientos,
    loading,
    error,
    refetch,
    updateCategoria,
    loadMore,
    hasMore,
  }
}
