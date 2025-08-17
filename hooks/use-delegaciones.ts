"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Delegacion } from "@/lib/types/database"

export function useDelegaciones() {
  const [delegaciones, setDelegaciones] = useState<Delegacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const { user } = useAuth()

  const fetchDelegaciones = async () => {
    if (!user) {
      setDelegaciones([])
      setLoading(false)
      setHasLoaded(false)
      return
    }

    // Skip if already loaded data for this user
    if (hasLoaded && delegaciones.length > 0) {
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
      setHasLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Reset cache when user changes
    setHasLoaded(false)
    fetchDelegaciones()
  }, [user?.id]) // Only re-run when user ID changes, not when user object changes

  // Provide a way to force refresh the cache
  const refetch = () => {
    setHasLoaded(false)
    fetchDelegaciones()
  }

  return { delegaciones, loading, error, refetch }
}
