"use client"

import type React from "react"
import { createContext, useContext, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import { registerAC, unregisterAC } from "@/lib/db/in-flight"
import type { MovimientoConRelaciones } from "@/lib/types/database"

const FETCH_TIMEOUT_MS = 15000

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

interface CacheEntry {
  data: MovimientoConRelaciones[]
  timestamp: number
  loading: boolean
  error: string | null
}

interface MovimientosCacheContextType {
  getCachedData: (delegacionId: string | null, filters?: MovimientosFilters) => CacheEntry | undefined
  fetchMovimientos: (delegacionId: string | null, filters?: MovimientosFilters, force?: boolean) => Promise<{ data: MovimientoConRelaciones[]; totalCount: number }>
  invalidateCache: (delegacionId?: string | null) => void
  updateMovimiento: (movimientoId: string, updates: Partial<MovimientoConRelaciones>) => void
  addMovimiento: (movimiento: MovimientoConRelaciones) => void
  removeMovimientos: (movimientoIds: string[]) => void
  subscribe: (callback: () => void) => () => void
}

const MovimientosCacheContext = createContext<MovimientosCacheContextType | undefined>(undefined)

const CACHE_TTL = 30000 // 30 segundos

function serializeFilters(filters?: MovimientosFilters): string {
  if (!filters) return "no-filters"
  const normalized = {
    ...filters,
    categoriaIds: filters.categoriaIds ? [...filters.categoriaIds].sort() : undefined,
  }
  return JSON.stringify(normalized)
}

function getCacheKey(delegacionId: string | null, filters?: MovimientosFilters): string {
  return `${delegacionId || "null"}|${serializeFilters(filters)}`
}

export function MovimientosCacheProvider({ children }: { children: React.ReactNode }) {
  const cacheRef = useRef<Map<string, CacheEntry>>(new Map())
  const pendingRequestsRef = useRef<Map<string, Promise<{ data: MovimientoConRelaciones[]; totalCount: number }>>>(new Map())
  const listenersRef = useRef<Set<() => void>>(new Set())

  const triggerUpdate = useCallback(() => {
    listenersRef.current.forEach((listener) => listener())
  }, [])

  const subscribe = useCallback((callback: () => void) => {
    listenersRef.current.add(callback)
    return () => {
      listenersRef.current.delete(callback)
    }
  }, [])

  const fetchMovimientos = useCallback(
    async (delegacionId: string | null, filters?: MovimientosFilters, force = false) => {
      if (!delegacionId) {
        return { data: [], totalCount: 0 }
      }

      const cacheKey = getCacheKey(delegacionId, filters)
      const cached = cacheRef.current.get(cacheKey)
      const now = Date.now()

      // Return cached data if fresh and not forced
      if (!force && cached && !cached.loading && now - cached.timestamp < CACHE_TTL) {
        return { data: cached.data, totalCount: cached.data.length }
      }

      // If there's already a pending request for this key, wait for it
      const pendingRequest = pendingRequestsRef.current.get(cacheKey)
      if (pendingRequest) {
        await pendingRequest
        const updated = cacheRef.current.get(cacheKey)
        return { data: updated?.data || [], totalCount: updated?.data.length || 0 }
      }

      // Mark as loading
      cacheRef.current.set(cacheKey, {
        data: cached?.data || [],
        timestamp: now,
        loading: true,
        error: null,
      })
      triggerUpdate()

      // AbortController so abortAllInFlight() (called on tab focus) can kill
      // zombie fetches that Chrome suspended mid-flight.
      const ac = new AbortController()
      registerAC(ac)
      const timeoutId = setTimeout(() => ac.abort(new Error("movimientos-timeout")), FETCH_TIMEOUT_MS)

      // Create and store the request promise
      const requestPromise = (async () => {
        try {
          // Build query
          // Optimized query: removed unnecessary delegacion JOIN (we already have delegacion_id)
          // and archivos JOIN (lazy loaded on demand)
          let query = (supabase as any)
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
          if (filters) {
            if (filters.fechaDesde) {
              query = query.gte("fecha", filters.fechaDesde)
            }
            if (filters.fechaHasta) {
              query = query.lte("fecha", filters.fechaHasta)
            }
            if (filters.categoriaIds && filters.categoriaIds.length > 0) {
              query = query.in("categoria_id", filters.categoriaIds)
            }
            if (filters.cuentaId) {
              query = query.eq("cuenta_id", filters.cuentaId)
            }
            if (filters.busqueda) {
              const term = filters.busqueda.replace(/%/g, "\\%").replace(/,/g, "\\,")
              query = query.or(`concepto.ilike.%${term}%,descripcion.ilike.%${term}%`)
            }
            if (filters.amountFrom !== undefined) {
              query = query.gte("importe", filters.amountFrom)
            }
            if (filters.amountTo !== undefined) {
              query = query.lte("importe", filters.amountTo)
            }
            if (filters.uncategorized) {
              query = query.is("categoria_id", null)
            }
          }

          const { data, error } = await query.abortSignal(ac.signal)

          if (error) throw error

          const movimientosData = (data || []) as MovimientoConRelaciones[]

          cacheRef.current.set(cacheKey, {
            data: movimientosData,
            timestamp: Date.now(),
            loading: false,
            error: null,
          })
          triggerUpdate()

          return { data: movimientosData, totalCount: movimientosData.length }
        } catch (error: any) {
          const errorMessage = error?.message || "Error desconocido"
          cacheRef.current.set(cacheKey, {
            data: cached?.data || [],
            timestamp: Date.now(),
            loading: false,
            error: errorMessage,
          })
          triggerUpdate()
          throw error
        } finally {
          clearTimeout(timeoutId)
          unregisterAC(ac)
          pendingRequestsRef.current.delete(cacheKey)
        }
      })()

      pendingRequestsRef.current.set(cacheKey, requestPromise)
      await requestPromise

      const result = cacheRef.current.get(cacheKey)
      return { data: result?.data || [], totalCount: result?.data.length || 0 }
    },
    [triggerUpdate]
  )

  const getCachedData = useCallback(
    (delegacionId: string | null, filters?: MovimientosFilters) => {
      const cacheKey = getCacheKey(delegacionId, filters)
      return cacheRef.current.get(cacheKey)
    },
    []
  )

  const invalidateCache = useCallback(
    (delegacionId?: string | null) => {
      if (delegacionId) {
        // Invalidate only entries for this delegation
        const keysToDelete: string[] = []
        cacheRef.current.forEach((_, key) => {
          if (key.startsWith(`${delegacionId}|`)) {
            keysToDelete.push(key)
          }
        })
        keysToDelete.forEach((key) => cacheRef.current.delete(key))
      } else {
        // Invalidate all
        cacheRef.current.clear()
      }
      triggerUpdate()
    },
    [triggerUpdate]
  )

  const updateMovimiento = useCallback(
    (movimientoId: string, updates: Partial<MovimientoConRelaciones>) => {
      // Update all cached entries containing this movimiento
      cacheRef.current.forEach((entry, key) => {
        const updated = entry.data.map((mov) => (mov.id === movimientoId ? { ...mov, ...updates } : mov))
        cacheRef.current.set(key, { ...entry, data: updated })
      })
      triggerUpdate()
    },
    [triggerUpdate]
  )

  const addMovimiento = useCallback(
    (movimiento: MovimientoConRelaciones) => {
      // Add to all relevant cached entries (matching delegation)
      cacheRef.current.forEach((entry, key) => {
        if (key.startsWith(`${movimiento.delegacion_id}|`)) {
          const updated = [movimiento, ...entry.data]
          cacheRef.current.set(key, { ...entry, data: updated })
        }
      })
      triggerUpdate()
    },
    [triggerUpdate]
  )

  const removeMovimientos = useCallback(
    (movimientoIds: string[]) => {
      const idsSet = new Set(movimientoIds)
      cacheRef.current.forEach((entry, key) => {
        const updated = entry.data.filter((mov) => !idsSet.has(mov.id))
        cacheRef.current.set(key, { ...entry, data: updated })
      })
      triggerUpdate()
    },
    [triggerUpdate]
  )

  return (
    <MovimientosCacheContext.Provider
      value={{
        getCachedData,
        fetchMovimientos,
        invalidateCache,
        updateMovimiento,
        addMovimiento,
        removeMovimientos,
        subscribe,
      }}
    >
      {children}
    </MovimientosCacheContext.Provider>
  )
}

export function useMovimientosCache() {
  const context = useContext(MovimientosCacheContext)
  if (context === undefined) {
    throw new Error("useMovimientosCache must be used within a MovimientosCacheProvider")
  }
  return context
}
