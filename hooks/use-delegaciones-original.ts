"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Delegacion } from "@/lib/types/database"
import { useDebugCalls } from "./use-debug-calls"

export function useDelegaciones() {
  const [delegaciones, setDelegaciones] = useState<Delegacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()
  
  // DEBUG: Track excessive calls
  const debugInfo = useDebugCalls('useDelegaciones', [user?.id])
  
  if (debugInfo.renderCount > 5) {
    console.warn(`🚨 useDelegaciones se ha ejecutado ${debugInfo.renderCount} veces con user:`, user?.id)
  }

  const fetchDelegaciones = async () => {
    if (!user) {
      setDelegaciones([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)

      const { data, error } = await supabase
        .from("membresia")
        .select(`
          delegacion_id,
          delegacion:delegacion_id (
            id,
            organizacion_id,
            codigo,
            nombre,
            creado_en
          )
        `)
        .eq("usuario_id", user.id)

      if (error) {
        setError(error.message)
        return
      }

      const delegacionesData = (data?.map((item) => item.delegacion).filter(Boolean) || []) as unknown as Delegacion[]
      setDelegaciones(delegacionesData)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDelegaciones()
  }, [user])

  return { delegaciones, loading, error }
}
