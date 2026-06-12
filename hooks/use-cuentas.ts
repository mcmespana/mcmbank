"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { supabase } from "@/lib/supabase/client"
import type { CuentaConDelegacion } from "@/lib/types/database"
import { useRevalidateOnFocusJitter } from "./use-app-status"
import { runQuery } from "@/lib/db/query"

interface UseCuentasOptions {
  timeout?: number // milliseconds, default 10000 (10s)
  ttlMs?: number // cache TTL before auto refetch, default 30000 (30s)
  includeInactive?: boolean // incluir cuentas desactivadas (solo gestor de cuentas), default false
}

export function useCuentas(
  delegacionId: string | null,
  options: UseCuentasOptions = {}
) {
  const { timeout = 10000, ttlMs = 30000, includeInactive = false } = options
  const [cuentas, setCuentas] = useState<CuentaConDelegacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const forceRefreshRef = useRef<number>(0) // Para forzar refrescos

  // SIMPLIFIED: Just track the delegacionId
  const memoizedDelegacionId = useMemo(() => delegacionId, [delegacionId])

  // Track last fetch for TTL-based revalidation
  const lastDelegacionIdRef = useRef<string | null>(null)
  const lastFetchAtRef = useRef<number>(0)

  const fetchCuentas = useCallback(async (force = false) => {
    // TTL guard: if same delegacion and fetched recently, skip unless forced
    const now = Date.now()
    const isSameDelegacion = memoizedDelegacionId === lastDelegacionIdRef.current
    const isFresh = now - lastFetchAtRef.current < ttlMs
    if (!force && isSameDelegacion && isFresh && cuentas.length > 0) {
      return
    }

    lastDelegacionIdRef.current = memoizedDelegacionId
    if (!delegacionId) {
      setCuentas([])
      setLoading(false)
      return
    }

    // Cancel previous request if still pending
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    // Create new abort controller for this request
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      setLoading(true)
      setError(null)

      // Set timeout
      const { data, error } = await runQuery<unknown[]>({
        label: 'fetch-cuentas',
        table: 'cuenta',
        timeoutMs: timeout,
        build: async (signal) =>
          await supabase
            .from("cuenta")
            .select(`
              id,
              delegacion_id,
              nombre,
              tipo,
              origen,
              banco_nombre,
              iban,
              color,
              personas_autorizadas,
              descripcion,
              creado_en,
              banco_conexion_id,
              external_account_uid,
              sync_enabled,
              last_sync_at,
              last_sync_status,
              last_sync_error,
              sync_desde_fecha,
              activa,
              delegacion:delegacion_id (
                id,
                organizacion_id,
                codigo,
                nombre,
                creado_en
              )
            `)
            .eq("delegacion_id", delegacionId)
            .abortSignal(signal)
      })

      // Clear timeout if query completed successfully
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }

      if (abortController.signal.aborted) {
        return // Request was cancelled
      }

      if (error) {
        throw error
      }

      // Transform data to match CuentaConDelegacion type
      let transformedData = (data || []).map((item: any) => ({
        ...item,
        delegacion: Array.isArray(item.delegacion) ? item.delegacion[0] : item.delegacion
      })) as CuentaConDelegacion[]

      // Cuentas desactivadas: solo visibles donde se pida explícitamente (gestor de cuentas)
      if (!includeInactive) {
        transformedData = transformedData.filter((c) => (c as any).activa !== false)
      }

      setCuentas(transformedData)
      lastFetchAtRef.current = Date.now()
    } catch (err) {
      if (abortController.signal.aborted) {
        return
      }

      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      console.error("Error fetching cuentas:", errorMessage)
      setError(errorMessage)
    } finally {
      // Always clear loading to avoid spinner lock; next fetch will set true
      setLoading(false)
      // Cleanup
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [memoizedDelegacionId, timeout, cuentas.length, delegacionId, ttlMs, includeInactive])

  // Función para forzar un refresh completo
  const forceRefresh = useCallback(() => {
    forceRefreshRef.current += 1
    fetchCuentas(true)
  }, [fetchCuentas])

  // Ref to avoid effect cleanup aborting in-flight requests on callback identity change
  const fetchCuentasRef = useRef(fetchCuentas)
  fetchCuentasRef.current = fetchCuentas

  useEffect(() => {
    // Fetch if delegacionId changed OR if it's the first load
    if (memoizedDelegacionId !== lastDelegacionIdRef.current || cuentas.length === 0) {
      fetchCuentasRef.current()
    }

    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoizedDelegacionId, cuentas.length])

  // Revalidate on focus (force = true to bypass skip guard)
  useRevalidateOnFocusJitter(() => fetchCuentasRef.current(true), { minMs: 70, maxMs: 180 })

  return {
    cuentas,
    loading,
    error,
    refetch: fetchCuentas,
    forceRefresh, // Nueva función para forzar refresh
    // Funciones para actualizaciones optimistas
    addCuenta: (cuenta: CuentaConDelegacion) => {
      setCuentas(prev => [cuenta, ...prev])
    },
    updateCuenta: (cuentaId: string, updates: Partial<CuentaConDelegacion>) => {
      setCuentas(prev => prev.map(c =>
        c.id === cuentaId ? { ...c, ...updates } : c
      ))
    },
    removeCuenta: (cuentaId: string) => {
      setCuentas(prev => prev.filter(c => c.id !== cuentaId))
    },
    cancel: () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }
}
