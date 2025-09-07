"use client"

import { useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import type { CuentaConDelegacion } from "@/lib/types/database"
import { useDebugCalls } from "./use-debug-calls"
import { runQuery } from "@/lib/db/query"
import { useApiQuery } from "./use-api-query"

interface UseCuentasOptions {
  timeout?: number
  ttlMs?: number
}

export function useCuentas(delegacionId: string | null, options: UseCuentasOptions = {}) {
  const { timeout = 10000, ttlMs = 30000 } = options

  useDebugCalls("useCuentas", [delegacionId])

  const queryFn = useCallback(
    async (signal: AbortSignal) => {
      const { data, error } = await runQuery<any[]>({
        label: "fetch-cuentas",
        table: "cuenta",
        timeoutMs: timeout,
        build: async (signal) =>
          await supabase
            .from("cuenta")
            .select(
              `
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
            `
            )
            .eq("delegacion_id", delegacionId)
            .abortSignal(signal),
      })

      if (error) throw error

      return (data || []).map((item: any) => ({
        ...item,
        delegacion: Array.isArray(item.delegacion) ? item.delegacion[0] : item.delegacion,
      })) as CuentaConDelegacion[]
    },
    [delegacionId, timeout]
  )

  const {
    data: cuentas,
    loading,
    error,
    refetch,
    forceRefresh,
    setData: setCuentas,
  } = useApiQuery<CuentaConDelegacion[]>({
    queryFn,
    key: ["cuentas", delegacionId],
    enabled: !!delegacionId,
    ttlMs,
  })

  const addCuenta = useCallback(
    (cuenta: CuentaConDelegacion) => {
      setCuentas((prev) => (prev ? [cuenta, ...prev] : [cuenta]))
    },
    [setCuentas]
  )

  const updateCuenta = useCallback(
    (cuentaId: string, updates: Partial<CuentaConDelegacion>) => {
      setCuentas((prev) => (prev ? prev.map((c) => (c.id === cuentaId ? { ...c, ...updates } : c)) : []))
    },
    [setCuentas]
  )

  const removeCuenta = useCallback(
    (cuentaId: string) => {
      setCuentas((prev) => (prev ? prev.filter((c) => c.id !== cuentaId) : []))
    },
    [setCuentas]
  )

  return {
    cuentas: cuentas || [],
    loading,
    error,
    refetch,
    forceRefresh,
    addCuenta,
    updateCuenta,
    removeCuenta,
  }
}
