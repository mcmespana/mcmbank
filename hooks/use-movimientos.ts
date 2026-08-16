"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import type { Movimiento, MovimientoConRelaciones } from "@/lib/types/database"
import { useRevalidateOnFocusJitter } from "./use-app-status"
import { registerAC, unregisterAC } from "@/lib/db/in-flight"
import { applyAbsoluteAmountFilter } from "@/lib/db/amount-filter"

interface MovimientosFilters {
  fechaDesde?: string
  fechaHasta?: string
  categoriaIds?: string[]
  cuentaId?: string
  contactoIds?: string[]
  contactoTipos?: ("proveedor" | "persona_mcm" | "destinatario_mcm")[]
  busqueda?: string
  amountFrom?: number
  amountTo?: number
  uncategorized?: boolean
  facturaPendiente?: boolean
}

const DEFAULT_PAGE_SIZE = 100

// Reexportado desde lib/db/amount-filter.ts (función pura y testeable).
// Se mantiene aquí para no romper imports existentes.
export { applyAbsoluteAmountFilter }

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
  // Total de movimientos que cumplen los filtros, no los que se han cargado.
  // Supabase ya lo devuelve en cada página (`count: "exact"`), así que enseñar
  // "100 de 956" no cuesta ninguna consulta extra.
  const [total, setTotal] = useState(0)

  const pageSize = options.pageSize ?? DEFAULT_PAGE_SIZE
  const timeoutMs = options.timeoutMs ?? 15000
  const abortRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const fetchingRef = useRef(false)
  const inFlightKeyRef = useRef<string>("")
  const lastFetchKeyRef = useRef<string>("")
  const isRevalidatingRef = useRef(false)

  const serializedFilters = useMemo(() => {
    if (!filters) return "__no_filters__"
    const normalized = {
      ...filters,
      categoriaIds: filters.categoriaIds ? [...filters.categoriaIds].sort() : undefined,
      contactoIds: filters.contactoIds ? [...filters.contactoIds].sort() : undefined,
      contactoTipos: filters.contactoTipos ? [...filters.contactoTipos].sort() : undefined,
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
        contactoIds: parsed.contactoIds ? [...parsed.contactoIds] : undefined,
        contactoTipos: parsed.contactoTipos ? [...parsed.contactoTipos] : undefined,
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
        setTotal(0)
        return
      }

      // Prevent concurrent fetches for the SAME key/page (duplicate calls,
      // e.g. an accidental double-invoke). A fetch for a DIFFERENT key (the
      // delegation or filters changed while a previous fetch was still in
      // flight) must NOT be silently dropped — it aborts the stale one and
      // proceeds, otherwise the list would keep showing the previous
      // filter's data forever.
      if (fetchingRef.current) {
        if (isAppend) return
        if (inFlightKeyRef.current === fetchKey) return
      }

      // Cancel previous request and clear timeout
      if (abortRef.current) {
        abortRef.current.abort()
        unregisterAC(abortRef.current)
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }

      const abortController = new AbortController()
      abortRef.current = abortController
      registerAC(abortController)
      fetchingRef.current = true
      if (!isAppend) {
        inFlightKeyRef.current = fetchKey
      }

      // Set safety timeout
      timeoutRef.current = setTimeout(() => {
        console.warn(`[useMovimientos] Request timed out after ${timeoutMs}ms`)
        abortController.abort()
      }, timeoutMs)

      try {
        if (!isRevalidatingRef.current) {
          setLoading(true)
        }
        setError(null)

        // Resolve contacto IDs to filter by when filtering by name match or tipo
        let contactoIdsExtra: string[] | null = null
        if (memoizedFilters?.busqueda || (memoizedFilters?.contactoTipos && memoizedFilters.contactoTipos.length > 0)) {
          const term = memoizedFilters.busqueda?.replace(/%/g, "\\%")
          let contactoLookup = supabase
            .from("contacto")
            .select("id")
            .or(`delegacion_id.eq.${delegacionId},es_global.is.true`)
            .limit(500)
          if (term) {
            contactoLookup = contactoLookup.ilike("nombre", `%${term}%`)
          }
          if (memoizedFilters.contactoTipos && memoizedFilters.contactoTipos.length > 0) {
            contactoLookup = contactoLookup.in("tipo", memoizedFilters.contactoTipos)
          }
          const { data: matchedContactos } = await contactoLookup.abortSignal(abortController.signal)
          contactoIdsExtra = (matchedContactos ?? []).map((c: any) => c.id)
        }

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
            contacto_id,
            pago_mcm_id,
            factura_id,
            factura_pendiente,
            adjunto_principal_url,
            creado_por,
            creado_en,
            concepto_hash,
            cuenta:cuenta_id!inner (
              id,
              delegacion_id,
              nombre,
              tipo,
              origen,
              banco_nombre,
              color,
              activa
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
            ),
            contacto:contacto_id (
              id,
              nombre,
              tipo,
              emoji,
              color,
              logo_url,
              es_global
            )
          `,
            { count: "exact" }
          )
          .eq("delegacion_id", delegacionId)
          .eq("ignorado", false)
          // Excluir movimientos de cuentas desactivadas (inner join obligatorio para que filtre)
          .eq("cuenta.activa", true)
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
          if (memoizedFilters.contactoIds && memoizedFilters.contactoIds.length > 0) {
            query = query.in("contacto_id", memoizedFilters.contactoIds)
          }
          if (memoizedFilters.contactoTipos && memoizedFilters.contactoTipos.length > 0) {
            // Restringe a movimientos cuyo contacto coincide con uno de los tipos
            query = query.in("contacto_id", contactoIdsExtra && contactoIdsExtra.length > 0 ? contactoIdsExtra : ["00000000-0000-0000-0000-000000000000"])
          }
          if (memoizedFilters.busqueda) {
            const term = memoizedFilters.busqueda.replace(/%/g, "\\%").replace(/,/g, "\\,")
            const orParts = [`concepto.ilike.%${term}%`, `descripcion.ilike.%${term}%`]
            if (contactoIdsExtra && contactoIdsExtra.length > 0) {
              orParts.push(`contacto_id.in.(${contactoIdsExtra.join(",")})`)
            }
            query = query.or(orParts.join(","))
          }
          // Filter by absolute amount value so -150 matches range [100, 300]
          query = applyAbsoluteAmountFilter(query, memoizedFilters.amountFrom, memoizedFilters.amountTo)
          if (memoizedFilters.uncategorized) {
            query = query.is("categoria_id", null)
          }
          if (memoizedFilters.facturaPendiente) {
            query = query.eq("factura_pendiente", true)
          }
        }

        // Apply pagination
        if (pageSize > 0) {
          query = query.range(pageIndex * pageSize, (pageIndex + 1) * pageSize - 1)
        }

        const { data, count, error } = await query.abortSignal(abortController.signal)

        if (abortController.signal.aborted) return

        if (error) throw error

        const movimientosData = (data || []) as unknown as MovimientoConRelaciones[]
        const totalCount = count || 0

        if (isAppend && pageIndex > 0) {
          setMovimientos((prev) => [...prev, ...movimientosData])
        } else {
          setMovimientos(movimientosData)
        }

        setTotal(totalCount)
        setHasMore(movimientosData.length === pageSize && (pageIndex + 1) * pageSize < totalCount)
      } catch (err: any) {
        if (abortController.signal.aborted) {
          return
        }
        const errorMessage = err?.message || "Error desconocido"
        console.error("[useMovimientos] Error:", errorMessage)
        setError(errorMessage)
      } finally {
        unregisterAC(abortController)
        // Only the request that's still "current" (not superseded by a
        // newer key's fetch, which reassigns abortRef.current before this
        // runs) may clear the shared loading/fetching flags or the shared
        // timeout — otherwise a stale request's cleanup could clobber the
        // state of the request that replaced it.
        if (abortRef.current === abortController) {
          if (!isRevalidatingRef.current) {
            setLoading(false)
          }
          isRevalidatingRef.current = false
          fetchingRef.current = false
          if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
            timeoutRef.current = null
          }
        }
      }
    },
    [delegacionId, memoizedFilters, pageSize, timeoutMs, fetchKey]
  )

  // Keep a ref to the latest fetchMovimientos so the effect below does not
  // need it as a dependency (which would cause cleanup/abort on identity changes)
  const fetchMovimientosRef = useRef(fetchMovimientos)
  fetchMovimientosRef.current = fetchMovimientos

  // Main effect: fetch when key changes — ONLY depends on fetchKey
  useEffect(() => {
    // Skip if same key and already fetched
    if (fetchKey === lastFetchKeyRef.current) {
      return
    }

    lastFetchKeyRef.current = fetchKey

    // Reset state
    setPage(0)
    setHasMore(true)

    // Fetch using ref to avoid stale closure
    fetchMovimientosRef.current(0, false)

    // Cleanup: reset refs so the next mount (including React Strict Mode's
    // double-invoke) will re-fetch instead of skipping.
    return () => {
      lastFetchKeyRef.current = ""
      inFlightKeyRef.current = ""
      fetchingRef.current = false
      isRevalidatingRef.current = false
      if (abortRef.current) {
        abortRef.current.abort()
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
     
  }, [fetchKey])

  // Revalidate on focus - with debouncing (only if not currently fetching)
  const revalidate = useCallback(() => {
    if (!fetchingRef.current && lastFetchKeyRef.current !== "") {
      isRevalidatingRef.current = true
      setPage(0)
      setHasMore(true)
      fetchMovimientosRef.current(0, false)
    }
  }, [])

  useRevalidateOnFocusJitter(revalidate, { minMs: 90, maxMs: 220 })

  const loadMore = useCallback(() => {
    if (loading || !hasMore || fetchingRef.current) return
    const nextPage = page + 1
    setPage(nextPage)
    fetchMovimientosRef.current(nextPage, true)
  }, [loading, hasMore, page])

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
        contacto_id: (data as any)?.contacto_id || null,
        creado_por: user.id,
      }

      const { data: created, error } = await (supabase as any)
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
          contacto_id,
          pago_mcm_id,
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
          contacto:contacto_id (
            id,
            nombre,
            tipo,
            emoji,
            color,
            logo_url,
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
      setTotal(prev => prev + 1)

      return created as MovimientoConRelaciones
    } catch (err) {
      throw err
    }
  }

  const updateMovimiento = async (movimientoId: string, patch: Partial<MovimientoConRelaciones>) => {
    try {
      // Strip relation fields — only send flat DB columns to .update()
      const { cuenta, categoria, contacto, archivos, ...dbFields } = patch
      const { error } = await (supabase as any)
        .from("movimiento")
        .update(dbFields)
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

  /**
   * Borra movimientos y devuelve las filas tal cual estaban.
   *
   * Se leen **antes** de borrar precisamente para poder deshacer: un borrado en
   * lote es la acción más destructiva de la aplicación y hasta ahora no tenía
   * vuelta atrás ninguna. Con las filas en la mano, `restoreMovimientos()` las
   * vuelve a insertar con su mismo `id`, así que lo que se recupera es el
   * movimiento original y no una copia nueva.
   */
  const deleteMovimientos = async (movimientoIds: string[]): Promise<Movimiento[]> => {
    if (movimientoIds.length === 0) return []

    try {
      const { data: filas, error: readError } = await (supabase as any)
        .from("movimiento")
        .select("*")
        .in("id", movimientoIds)
      if (readError) throw readError

      const { error } = await (supabase as any).from("movimiento").delete().in("id", movimientoIds)
      if (error) throw error

      // Optimistically remove from local state
      const idsSet = new Set(movimientoIds)
      setMovimientos(prev => prev.filter(mov => !idsSet.has(mov.id)))
      setTotal(prev => Math.max(0, prev - movimientoIds.length))
      return (filas ?? []) as Movimiento[]
    } catch (err) {
      throw err
    }
  }

  /**
   * Vuelve a insertar movimientos borrados, con su id original.
   *
   * No recupera los archivos adjuntos: `movimiento_archivo` cae por cascada y
   * los ficheros de Storage se borran aparte. Quien llame a esto tiene que
   * decirlo si el movimiento los tenía.
   */
  const restoreMovimientos = async (filas: Movimiento[]): Promise<void> => {
    if (filas.length === 0) return
    const { error } = await (supabase as any).from("movimiento").insert(filas)
    if (error) throw error
    lastFetchKeyRef.current = ""
    await fetchMovimientos(0, false)
  }

  const updateCategoria = async (movimientoId: string, categoriaId: string | null) => {
    try {
      const { error } = await (supabase as any).from("movimiento").update({ categoria_id: categoriaId }).eq("id", movimientoId)
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
    restoreMovimientos,
    createMovimiento,
    loadMore,
    hasMore,
    total,
  }
}
