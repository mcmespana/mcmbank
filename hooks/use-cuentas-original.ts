"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import type { CuentaConDelegacion } from "@/lib/types/database"

export function useCuentas(delegacionId: string | null) {
  const [cuentas, setCuentas] = useState<CuentaConDelegacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCuentas = useCallback(async () => {
    if (!delegacionId) {
      setCuentas([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from("cuenta")
        .select(`
          *,
          delegacion:delegacion_id (
            id,
            organizacion_id,
            codigo,
            nombre,
            creado_en
          )
        `)
        .eq("delegacion_id", delegacionId)

      if (error) throw error
      setCuentas(data || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [delegacionId])

  useEffect(() => {
    fetchCuentas()
  }, [fetchCuentas])

  return { cuentas, loading, error, refetch: fetchCuentas }
}
