"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { supabase } from "@/lib/supabase/client"
import type { MovimientoConRelaciones } from "@/lib/types/database"
import { useRevalidateOnFocusJitter } from "./use-app-status"

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

const DEFAULT_PAGE_SIZE = 100

export function useMovimientos(
  delegacionId: string | null,
  filters?: MovimientosFilters,
    options: { timeoutMs?: number; pageSize?: number } = {}
  ) {
  const [movimientos, setMovimientos] = useState<MovimientoConRelaciones[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)

  const abortRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE

  // Memoize filters to avoid infinite re-renders
  const memoizedFilters = useMemo(() => filters, [filters])

  const fetchMovimientos = useCallback(
    async (pageIndex: number = 0, append: boolean = true) => {
      if (!delegacionId) {
        setMovimientos([])
        setLoading(false)
        setError(null)
        return { data: [], totalCount: 0 }
      }

      if (abortRef.current) {
        abortRef.current.abort()
      }

      const abortController = new AbortController()
      abortRef.current = abortController

      // Add timeout
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      try {
        if (!append || pageIndex === 0) {
          setLoading(true)
          setError(null)
        }

        // Build base query
        let query = supabase
          .from("movimiento")
          .select(
            `
            id,
            delegacion_id,
            cuenta_id,
            importe,
            fecha,
            descripcion,
            categoria_id,
            creado_en,
            modificado_en,
            es_conciliado,
            cuenta:cuenta_id (
              id,
              nombre,
              tipo,
              origen,
              banco_nombre,
              color
            ),
            categoria:categoria_id (
              id,
              nombre,
              color,
              tipo
            )
          `,
            { count: "exact" }
          )
          .eq("delegacion_id", delegacionId)
          .order("fecha", { ascending: false })
          .order("creado_en", { ascending: false })

        // Apply filters
        if (memoizedFilters) {
          if (memoizedFilters.fechaDesde) {
            query = query.gte("fecha", memoizedFilters.fechaDesde)
          }
          if (memoizedFilters.fechaHasta) {
            query = query.lte("fecha", memoizedFilters.fechaHasta)
          }
          if (memoizedFilters.categoriaIds && memoizedFilters.categoriaIds.length > 0) {
            query = query.in("categoria_id", memoizedFilters.categoriaIds)
          }
          if (memoizedFilters.cuentaId) {
            query = query.eq("cuenta_id", memoizedFilters.cuentaId)
          }
          if (memoizedFilters.busqueda) {
            query = query.ilike("descripcion", `%${memoizedFilters.busqueda}%`)
          }
          if (memoizedFilters.amountFrom !== undefined) {
            query = query.gte("importe", memoizedFilters.amountFrom)
          }
          if (memoizedFilters.amountTo !== undefined) {
            query = query.lte("importe", memoizedFilters.amountTo)
          }
          if (memoizedFilters.uncategorized) {
            query = query.is("categoria_id", null)
          }
        }

        // Apply pagination
        if (pageSize > 0) {
          query = query.range(pageIndex * pageSize, (pageIndex + 1) * pageSize - 1)
        }

        const { data, count, error } = await query.abortSignal(abortController.signal)

        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }

        if (abortController.signal.aborted) {
          return { data: [], totalCount: 0 }
        }

        if (error) throw error

        const movimientosData = data as any[]
        const totalCount = count || 0

        if (append && pageIndex > 0) {
          setMovimientos((prev) => [...prev, ...movimientosData])
        } else {
          setMovimientos(movimientosData)
        }

        setHasMore(movimientosData.length === pageSize && (pageIndex + 1) * pageSize < totalCount)

        return { data: movimientosData, totalCount }
      } catch (error: any) {
        const errorMessage = error?.message || "Error desconocido"
        console.error("Error fetching movimientos:", errorMessage)

        if (abortController.signal.aborted) {
          console.log("Request was cancelled")
          return { data: [], totalCount: 0 }
        }

        setError(errorMessage)
        return { data: [], totalCount: 0 }
      } finally {
        setLoading(false)
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current)
          timeoutRef.current = null
        }
      }
    },
    [delegacionId, memoizedFilters, pageSize]
  )

  useEffect(() => {
    // Cleanup any in-flight when dependencies change
    if (abortRef.current) abortRef.current.abort()

    // Reset pagination and fetch new data
    setPage(0)
    setHasMore(true)
    fetchMovimientos(0, false)
    
    return () => {
      if (abortRef.current) abortRef.current.abort()
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [delegacionId, memoizedFilters, pageSize, fetchMovimientos])

  useRevalidateOnFocusJitter(() => fetchMovimientos(0, false), { minMs: 90, maxMs: 220 })

  const loadMore = useCallback(() => {
    if (loading || !hasMore) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchMovimientos(nextPage, true)
  }, [loading, hasMore, page, fetchMovimientos])

  const createMovimiento = async (
    data: Partial<MovimientoConRelaciones>,
  ) => {
    try {
      // Ensure we have an authenticated user for creado_por
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) throw new Error("Usuario no autenticado")

      // Normalize payload: optional UUIDs must be null, not empty string
      const payload: any = {
        ...data,
        categoria_id: (data as any)?.categoria_id || null,
        creado_por: user.id,
      }

      const { data: created, error } = await supabase
        .from("movimiento")
        .insert(payload)
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
        `)
        .single()

      if (error) throw error
      setMovimientos(prev => [created as any, ...prev])
      return created as MovimientoConRelaciones
    } catch (err) {
      throw err
    }
  }

  const updateMovimiento = async (
    movimientoId: string,
    patch: Partial<MovimientoConRelaciones>,
  ) => {
    try {
      const { error } = await supabase
        .from("movimiento")
        .update(patch as any)
        .eq("id", movimientoId)
      if (error) throw error
      setMovimientos(prev =>
        prev.map(mov => (mov.id === movimientoId ? { ...mov, ...patch } : mov)),
      )
    } catch (err) {
      throw err
    }
  }

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
    updateMovimiento,
    createMovimiento,
    loadMore,
    hasMore,
  }
}
