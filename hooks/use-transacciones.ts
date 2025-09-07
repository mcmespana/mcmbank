"use client"

import { useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import type { MovimientoConRelaciones } from "@/lib/types/database"
import { useDebugCalls } from "./use-debug-calls"
import { runQuery } from "@/lib/db/query"
import { useApiQuery } from "./use-api-query"

interface UseTransaccionesProps {
  delegacionId?: string
  fechaInicio?: string
  fechaFin?: string
  categoriaId?: string
  busqueda?: string
  timeout?: number
}

export function useTransacciones({
  delegacionId,
  fechaInicio,
  fechaFin,
  categoriaId,
  busqueda,
  timeout = 15000,
}: UseTransaccionesProps = {}) {
  useDebugCalls("useTransacciones", [delegacionId, fechaInicio, fechaFin, categoriaId, busqueda])

  const queryFn = useCallback(
    async (signal: AbortSignal) => {
      const { data, error } = await runQuery<any[]>({
        label: "fetch-transacciones",
        table: "movimiento",
        timeoutMs: timeout,
        build: (signal) => {
          let query = supabase
            .from("movimiento")
            .select(
              `
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
            `
            )
            .eq("ignorado", false)
            .order("fecha", { ascending: false })
            .limit(50)

          if (delegacionId) query = query.eq("delegacion_id", delegacionId)
          if (fechaInicio) query = query.gte("fecha", fechaInicio)
          if (fechaFin) query = query.lte("fecha", fechaFin)
          if (categoriaId) query = query.eq("categoria_id", categoriaId)
          if (busqueda) query = query.or(`concepto.ilike.%${busqueda}%,descripcion.ilike.%${busqueda}%`)

          return query.abortSignal(signal)
        },
      })

      if (error) throw error

      return (data || []).map((item) => ({
        ...item,
        cuenta: item.cuenta
          ? {
              ...item.cuenta,
              delegacion: {
                id: "",
                organizacion_id: "",
                codigo: "",
                nombre: "",
                creado_en: "",
              },
            }
          : null,
      })) as MovimientoConRelaciones[]
    },
    [delegacionId, fechaInicio, fechaFin, categoriaId, busqueda, timeout]
  )

  const {
    data: transacciones,
    loading,
    error,
    refetch,
    forceRefresh,
  } = useApiQuery<MovimientoConRelaciones[]>({
    queryFn,
    key: ["transacciones", delegacionId, fechaInicio, fechaFin, categoriaId, busqueda],
    enabled: true,
  })

  return {
    transacciones: transacciones || [],
    loading,
    error,
    refetch,
    forceRefresh,
  }
}
