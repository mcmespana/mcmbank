"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import type { Movimiento, MovimientoConRelaciones } from "@/lib/types/database"
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

export function useMovimientos(delegacionId: string | null, filters?: MovimientosFilters) {
  const [movimientos, setMovimientos] = useState<MovimientoConRelaciones[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const fetchIdRef = useRef(0)

  const fetchMovimientos = useCallback(
    async (pageToLoad = 0, append = false) => {
      const fetchId = ++fetchIdRef.current

      if (!delegacionId) {
        setMovimientos([])
        setHasMore(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        const from = pageToLoad * PAGE_SIZE
        const to = from + PAGE_SIZE - 1

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
            )
          `,
            { count: "exact" }
          )
          .eq("delegacion_id", delegacionId)
          .order("fecha", { ascending: false })
          .order("creado_en", { ascending: false })
          .range(from, to)

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

        const { data, error } = await query

        if (fetchId !== fetchIdRef.current) return

        if (error) throw error

        setMovimientos(prev => (append ? [...prev, ...(data || [])] : (data || [])))
        if ((data || []).length < PAGE_SIZE) {
          setHasMore(false)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido")
      } finally {
        setLoading(false)
      }
    },
    [delegacionId, filters?.fechaDesde, filters?.fechaHasta, (filters?.categoriaIds || []).join(","), filters?.cuentaId, filters?.busqueda, filters?.amountFrom, filters?.amountTo, filters?.uncategorized]
  )

  useEffect(() => {
    setMovimientos([])
    setPage(0)
    setHasMore(true)
    fetchMovimientos(0, false)
  }, [delegacionId, filters?.fechaDesde, filters?.fechaHasta, (filters?.categoriaIds || []).join(","), filters?.cuentaId, filters?.busqueda, filters?.amountFrom, filters?.amountTo, filters?.uncategorized, fetchMovimientos])

  useRevalidateOnFocus(() => fetchMovimientos(0, false))

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchMovimientos(nextPage, true)
  }, [loading, hasMore, page, fetchMovimientos])

  const updateMovimiento = async (movimientoId: string, patch: Partial<Movimiento>) => {
    try {
      const { error } = await supabase.from("movimiento").update(patch).eq("id", movimientoId)
      if (error) throw error
      setMovimientos(prev => prev.map(mov => (mov.id === movimientoId ? { ...mov, ...patch } : mov)))
    } catch (err) {
      throw err
    }
  }

  const updateCategoria = (movimientoId: string, categoriaId: string | null) =>
    updateMovimiento(movimientoId, { categoria_id: categoriaId })

  const createMovimiento = async (data: Partial<Movimiento>) => {
    if (!delegacionId) throw new Error("Delegacion ID is required")
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const insertData = {
      ...data,
      categoria_id: data.categoria_id || null,
      delegacion_id: delegacionId,
      creado_por: user?.id || "",
      ignorado: false,
    }

    const { data: inserted, error } = await supabase
      .from("movimiento")
      .insert(insertData)
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
        )`
      )
      .single()

    if (error) throw error

    setMovimientos(prev => [inserted as MovimientoConRelaciones, ...prev])
    return inserted as MovimientoConRelaciones
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
    updateMovimiento,
    createMovimiento,
    loadMore,
    hasMore,
  }
}
