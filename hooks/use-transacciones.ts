"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import type { MovimientoConRelaciones } from "@/lib/types/database"
import { useDebugCalls } from "./use-debug-calls"
import { useRevalidateOnFocus } from "./use-app-status"

interface UseTransaccionesProps {
  delegacionId?: string
  fechaInicio?: string
  fechaFin?: string
  categoriaId?: string
  busqueda?: string
  timeout?: number // milliseconds, default 15000 (15s)
}

export function useTransacciones({
  delegacionId,
  fechaInicio,
  fechaFin,
  categoriaId,
  busqueda,
  timeout = 15000,
}: UseTransaccionesProps = {}) {
  const [transacciones, setTransacciones] = useState<MovimientoConRelaciones[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  
  // DEBUG: Track excessive calls
  useDebugCalls('useTransacciones', [delegacionId, fechaInicio, fechaFin, categoriaId, busqueda])

  const fetchTransacciones = useCallback(async () => {
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
          reject(new Error(`Consulta cancelada por timeout (${timeout}ms). La consulta está tardando demasiado.`))
        }, timeout)
      })

      // OPTIMIZED QUERY: Simplified JOINs to reduce complexity
      let query = supabase
        .from("movimiento")
        .select(`
          id,
          fecha,
          concepto,
          descripcion,
          importe,
          contraparte,
          metodo,
          notas,
          cuenta_id,
          categoria_id,
          creado_en,
          cuenta:cuenta_id (
            id,
            nombre,
            tipo
          ),
          categoria:categoria_id (
            id,
            nombre,
            tipo,
            emoji,
            color
          )
        `)
        .eq("ignorado", false)
        .order("fecha", { ascending: false })
        .limit(50) // Reduced from 100 to improve performance

      if (delegacionId) {
        query = query.eq("delegacion_id", delegacionId)
      }

      if (fechaInicio) {
        query = query.gte("fecha", fechaInicio)
      }
      if (fechaFin) {
        query = query.lte("fecha", fechaFin)
      }

      if (categoriaId) {
        query = query.eq("categoria_id", categoriaId)
      }

      if (busqueda) {
        query = query.or(`concepto.ilike.%${busqueda}%,descripcion.ilike.%${busqueda}%`)
      }

      // Race between the query and timeout
      const queryPromise = query.abortSignal(abortController.signal)
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

      // Process data to match expected type structure
      const processedData = (data || []).map(item => ({
        ...item,
        cuenta: item.cuenta ? {
          ...item.cuenta,
          delegacion: {
            id: '', // Will be populated if needed
            organizacion_id: '',
            codigo: '',
            nombre: '',
            creado_en: ''
          }
        } : null
      })) as MovimientoConRelaciones[]

      setTransacciones(processedData)
    } catch (err) {
      if (abortController.signal.aborted) {
        console.log("Query was cancelled")
        return
      }
      
      const errorMessage = err instanceof Error ? err.message : "Error desconocido"
      console.error("Error fetching transactions:", errorMessage)
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
  }, [delegacionId, fechaInicio, fechaFin, categoriaId, busqueda, timeout])

  useEffect(() => {
    fetchTransacciones()
    
    // Cleanup on unmount
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [fetchTransacciones])

  // Revalidate on focus
  useRevalidateOnFocus(fetchTransacciones)

  return { 
    transacciones, 
    loading, 
    error, 
    refetch: fetchTransacciones,
    cancel: () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort()
      }
    }
  }
}
