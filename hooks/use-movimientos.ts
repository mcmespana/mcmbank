"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import type { MovimientoConRelaciones } from "@/lib/types/database"

interface MovimientosFilters {
  fechaDesde?: string
  fechaHasta?: string
  categoriaId?: string
  cuentaId?: string
  busqueda?: string
}

export function useMovimientos(delegacionId: string | null, filters?: MovimientosFilters) {
  const [movimientos, setMovimientos] = useState<MovimientoConRelaciones[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchMovimientos = useCallback(async () => {
    if (!delegacionId) {
      setMovimientos([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      let query = supabase
        .from("movimiento")
        .select(`
          *,
          cuenta:cuenta_id (
            *,
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
            nombre,
            tipo,
            emoji,
            orden,
            categoria_padre_id,
            creado_en
          )
        `)
        .eq("cuenta.delegacion_id", delegacionId)
        .order("fecha", { ascending: false })

      if (filters?.fechaDesde) {
        query = query.gte("fecha", filters.fechaDesde)
      }
      if (filters?.fechaHasta) {
        query = query.lte("fecha", filters.fechaHasta)
      }
      if (filters?.categoriaId) {
        query = query.eq("categoria_id", filters.categoriaId)
      }
      if (filters?.cuentaId) {
        query = query.eq("cuenta_id", filters.cuentaId)
      }
      if (filters?.busqueda) {
        query = query.or(`concepto.ilike.%${filters.busqueda}%,descripcion.ilike.%${filters.busqueda}%`)
      }

      const { data, error } = await query

      if (error) throw error
      setMovimientos(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [delegacionId, filters])

  useEffect(() => {
    fetchMovimientos()
  }, [fetchMovimientos])

  const updateCategoria = async (movimientoId: string, categoriaId: string | null) => {
    try {
      const { error } = await supabase.from("movimiento").update({ categoria_id: categoriaId }).eq("id", movimientoId)

      if (error) throw error

      // Update local state
      setMovimientos((prev) =>
        prev.map((mov) => (mov.id === movimientoId ? { ...mov, categoria_id: categoriaId } : mov)),
      )
    } catch (err) {
      throw err
    }
  }

  return {
    movimientos,
    loading,
    error,
    refetch: fetchMovimientos,
    updateCategoria,
  }
}
