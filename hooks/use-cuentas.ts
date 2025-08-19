"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import { supabase } from "@/lib/supabase/client"
import type { CuentaConDelegacion } from "@/lib/types/database"
import { useDebugCalls } from "./use-debug-calls"

interface UseCuentasOptions {
  timeout?: number // milliseconds, default 10000 (10s)
}

export function useCuentas(
  delegacionId: string | null, 
  options: UseCuentasOptions = {}
) {
  const { timeout = 10000 } = options
  const [cuentas, setCuentas] = useState<CuentaConDelegacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
    // DEBUG: Track excessive calls  
  useDebugCalls('useCuentas', [delegacionId])
  
  // AGGRESSIVE MEMOIZATION: Prevent unnecessary re-renders
  const memoizedDelegacionId = useMemo(() => delegacionId, [delegacionId])
  
  // DEBOUNCING: Only fetch if delegacionId actually changed
  const lastDelegacionIdRef = useRef<string | null>(null)
  
  const fetchCuentas = useCallback(async () => {
    // Skip if same delegacionId
    if (memoizedDelegacionId === lastDelegacionIdRef.current) {
      console.log('🔄 useCuentas: Skipping fetch - same delegacionId')
      return
    }
    
    // Update last delegacionId
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
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutRef.current = setTimeout(() => {
          abortController.abort()
          reject(new Error(`Consulta de cuentas cancelada por timeout (${timeout}ms)`))
        }, timeout)
      })

      // OPTIMIZED QUERY: Simplified delegacion JOIN
      const queryPromise = supabase
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
          delegacion:delegacion_id (
            id,
            organizacion_id,
            codigo,
            nombre,
            creado_en
          )
        `)
        .eq("delegacion_id", delegacionId)
        .abortSignal(abortController.signal)

      // Race between the query and timeout
      const { data, error } = await Promise.race([queryPromise, timeoutPromise])

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

      setCuentas(data || [])
    } catch (err) {
      if (abortController.signal.aborted) {
        console.log("Cuentas query was cancelled")
        return
      }
      
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      console.error("Error fetching cuentas:", errorMessage)
      setError(errorMessage)
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false)
      }
      
      // Cleanup
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [memoizedDelegacionId, timeout])

  useEffect(() => {
    // Only fetch if delegacionId changed
    if (memoizedDelegacionId !== lastDelegacionIdRef.current) {
      fetchCuentas()
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
  }, [memoizedDelegacionId, fetchCuentas])

  return { 
    cuentas, 
    loading, 
    error, 
    refetch: fetchCuentas,
    cancel: () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }
}
