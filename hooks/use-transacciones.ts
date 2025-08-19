"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import type { MovimientoConRelaciones } from "@/lib/types/database"
import { useDebugCalls } from "./use-debug-calls"

interface UseTransaccionesProps {
  delegacionId?: string
  fechaInicio?: string
  fechaFin?: string
  categoriaId?: string
  busqueda?: string
}

export function useTransacciones({
  delegacionId,
  fechaInicio,
  fechaFin,
  categoriaId,
  busqueda,
}: UseTransaccionesProps = {}) {
  const [transacciones, setTransacciones] = useState<MovimientoConRelaciones[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // DEBUG: Track excessive calls
  const debugInfo = useDebugCalls('useTransacciones', [delegacionId, fechaInicio, fechaFin, categoriaId, busqueda])
  
  if (debugInfo.renderCount > 10) {
    console.warn(`🚨 useTransacciones se ha ejecutado ${debugInfo.renderCount} veces con deps:`, {
      delegacionId, fechaInicio, fechaFin, categoriaId, busqueda
    })
  }

  const fetchTransacciones = useCallback(async () => {
    try {
      setLoading(true)

      let query = supabase
        .from("movimiento")
        .select(`
          *,
          cuenta:cuenta_id (
            *,
            delegacion:delegacion_id (*)
          ),
          categoria:categoria_id (*)
        `)
        .eq("ignorado", false)
        .order("fecha", { ascending: false })
        .order("creado_en", { ascending: false })

      if (delegacionId) {
        query = query.eq("cuenta.delegacion_id", delegacionId)
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

      const { data, error } = await query.limit(100)

      if (error) {
        setError(error.message)
        return
      }

      setTransacciones((data as MovimientoConRelaciones[]) || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [delegacionId, fechaInicio, fechaFin, categoriaId, busqueda])

  useEffect(() => {
    fetchTransacciones()
  }, [fetchTransacciones])

  return { transacciones, loading, error, refetch: fetchTransacciones }
}
