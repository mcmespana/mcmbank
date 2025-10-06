"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
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

  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
  const abortRef = useRef<AbortController | null>(null)
  const fetchingRef = useRef(false)
  const lastFetchKeyRef = useRef<string>("")

  const serializedFilters = useMemo(() => {
    if (!filters) return "__no_filters__"
    const normalized = {
      ...filters,
      categoriaIds: filters.categoriaIds ? [...filters.categoriaIds].sort() : undefined,
    }
    try {
      return JSON.stringify(normalized)
    } catch (error) {
      console.warn("No se pudieron serializar los filtros de movimientos", error)
      return Math.random().toString(36)
    }
  }, [filters])

  const memoizedFilters = useMemo(() => {
    if (serializedFilters === "__no_filters__") return undefined
    try {
      const parsed = JSON.parse(serializedFilters) as MovimientosFilters
      return {
        ...parsed,
        categoriaIds: parsed.categoriaIds ? [...parsed.categoriaIds] : undefined,
      }
    } catch (error) {
      console.warn("No se pudieron deserializar los filtros de movimientos", error)
      return undefined
    }
  }, [serializedFilters])

  const fetchKey = useMemo(
    () => `${delegacionId || "null"}|${serializedFilters}`,
    [delegacionId, serializedFilters]
  )

  const fetchMovimientos = useCallback(
    async (pageIndex: number = 0, isAppend: boolean = false) => {
      if (!delegacionId) {
        setMovimientos([])
        setLoading(false)
        setError(null)
        setHasMore(false)
        return
      }

      // Prevent concurrent fetches
      if (fetchingRef.current) {
        console.log("[useMovimientos] Already fetching, skipping...")
        return
      }

      // Cancel previous request
      if (abortRef.current) {
        abortRef.current.abort()
      }

      const abortController = new AbortController()
      abortRef.current = abortController
      fetchingRef.current = true

      try {
        setLoading(true)
        setError(null)

        // Optimized query: removed delegacion JOIN and archivos JOIN
        let query = supabase
          .from("movimiento")
          .select(
            `
            id,
            delegacion_id,
            cuenta_id,
            fecha,
            concepto,
            descripcion,
            texto_extra_1,
            texto_extra_2,
            contraparte,
            importe,
            metodo,
            notas,
            ignorado,
            categoria_id,
            adjunto_principal_url,
            creado_por,
            creado_en,
            concepto_hash,
            cuenta:cuenta_id (
              id,
              delegacion_id,
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
          .eq("ignorado", false)
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
            const term = memoizedFilters.busqueda.replace(/%/g, "\\%").replace(/,/g, "\\,")
            query = query.or(`concepto.ilike.%${term}%,descripcion.ilike.%${term}%`)
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

        if (abortController.signal.aborted) {
          console.log("[useMovimientos] Request aborted")
          return
        }

        if (error) throw error

        const movimientosData = (data || []) as MovimientoConRelaciones[]
        const totalCount = count || 0

        if (isAppend && pageIndex > 0) {
          setMovimientos((prev) => [...prev, ...movimientosData])
        } else {
          setMovimientos(movimientosData)
        }

        setHasMore(movimientosData.length === pageSize && (pageIndex + 1) * pageSize < totalCount)
      } catch (err: any) {
        if (abortController.signal.aborted) {
          console.log("[useMovimientos] Caught aborted request")
          return
        }
        const errorMessage = err?.message || "Error desconocido"
        console.error("[useMovimientos] Error:", errorMessage)
        setError(errorMessage)
      } finally {
        setLoading(false)
        fetchingRef.current = false
      }
    },
    [delegacionId, memoizedFilters, pageSize]
  )

  // Main effect: fetch when key changes
  useEffect(() => {
    // Skip if same key and already fetched
    if (fetchKey === lastFetchKeyRef.current) {
      return
    }

    lastFetchKeyRef.current = fetchKey

    // Reset state
    setPage(0)
    setHasMore(true)

    // Fetch
    fetchMovimientos(0, false)

    // Cleanup
    return () => {
      if (abortRef.current) {
        abortRef.current.abort()
      }
    }
  }, [fetchKey, fetchMovimientos])

  // Revalidate on focus - with debouncing (only if not currently fetching)
  const revalidate = useCallback(() => {
    if (!fetchingRef.current && lastFetchKeyRef.current !== "") {
      console.log("[useMovimientos] Revalidating on focus")
      setPage(0)
      setHasMore(true)
      fetchMovimientos(0, false)
    }
  }, [fetchMovimientos])

  useRevalidateOnFocusJitter(revalidate, { minMs: 90, maxMs: 220 })

  const loadMore = useCallback(() => {
    if (loading || !hasMore || fetchingRef.current) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchMovimientos(nextPage, true)
  }, [loading, hasMore, page, fetchMovimientos])

  const createMovimiento = async (data: Partial<MovimientoConRelaciones>) => {
    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser()
      if (authError) throw authError
      if (!user) throw new Error("Usuario no autenticado")

      const payload: any = {
        ...data,
        categoria_id: (data as any)?.categoria_id || null,
        creado_por: user.id,
      }

      const { data: created, error } = await supabase
        .from("movimiento")
        .insert(payload)
        .select(
          `
          id,
          delegacion_id,
          cuenta_id,
          fecha,
          concepto,
          descripcion,
          texto_extra_1,
          texto_extra_2,
          contraparte,
          importe,
          metodo,
          notas,
          ignorado,
          categoria_id,
          adjunto_principal_url,
          creado_por,
          creado_en,
          concepto_hash,
          cuenta:cuenta_id (
            id,
            delegacion_id,
            nombre,
            tipo,
            origen,
            banco_nombre,
            color,
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
            delegacion_id,
            nombre,
            tipo,
            emoji,
            color,
            orden,
            categoria_padre_id,
            creado_en,
            es_global
          ),
          archivos:movimiento_archivo!movimiento_id (
            id,
            nombre_original,
            nombre_archivo,
            tipo_mime,
            tamaño_bytes,
            bucket,
            path_storage,
            url_publica,
            es_factura,
            descripcion,
            subido_por,
            subido_en
          )
        `)
        .single()

      if (error) throw error

      // Optimistically add to local state
      setMovimientos(prev => [created as MovimientoConRelaciones, ...prev])

      return created as MovimientoConRelaciones
    } catch (err) {
      throw err
    }
  }

  const updateMovimiento = async (movimientoId: string, patch: Partial<MovimientoConRelaciones>) => {
    try {
      const { error } = await supabase
        .from("movimiento")
        .update(patch as any)
        .eq("id", movimientoId)
      if (error) throw error

      // Optimistically update local state
      setMovimientos(prev =>
        prev.map(mov => (mov.id === movimientoId ? { ...mov, ...patch } : mov))
      )
    } catch (err) {
      throw err
    }
  }

  const deleteMovimientos = async (movimientoIds: string[]) => {
    if (movimientoIds.length === 0) return

    try {
      const { error } = await supabase.from("movimiento").delete().in("id", movimientoIds)
      if (error) throw error

      // Optimistically remove from local state
      const idsSet = new Set(movimientoIds)
      setMovimientos(prev => prev.filter(mov => !idsSet.has(mov.id)))
    } catch (err) {
      throw err
    }
  }

  const updateCategoria = async (movimientoId: string, categoriaId: string | null) => {
    try {
      const { error } = await supabase.from("movimiento").update({ categoria_id: categoriaId }).eq("id", movimientoId)
      if (error) throw error

      // Optimistically update local state
      setMovimientos(prev =>
        prev.map(mov => (mov.id === movimientoId ? { ...mov, categoria_id: categoriaId } : mov))
      )
    } catch (err) {
      throw err
    }
  }

  const refetch = useCallback(() => {
    lastFetchKeyRef.current = "" // Force refetch
    fetchMovimientos(0, false)
  }, [fetchMovimientos])

  return {
    movimientos,
    loading,
    error,
    refetch,
    updateCategoria,
    updateMovimiento,
    deleteMovimientos,
    createMovimiento,
    loadMore,
    hasMore,
  }
}
