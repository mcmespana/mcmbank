"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Delegacion } from "@/lib/types/database"

export function useDelegations() {
  const [delegations, setDelegations] = useState<Delegacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasLoaded, setHasLoaded] = useState(false)
  const { user } = useAuth()

  const fetchDelegations = async () => {
    if (!user) {
      setDelegations([])
      setLoading(false)
      setHasLoaded(false)
      return
    }

    // Skip if already loaded data for this user
    if (hasLoaded && delegations.length > 0) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

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

      if (error) throw error

      const userDelegations = (data?.map((item) => item.delegacion).filter(Boolean) || []) as unknown as Delegacion[]
      setDelegations(userDelegations)
      setHasLoaded(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading delegations")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // Reset cache when user changes
    setHasLoaded(false)
    fetchDelegations()
  }, [user?.id]) // Only re-run when user ID changes, not when user object changes

  // Provide a way to force refresh the cache
  const refetch = () => {
    setHasLoaded(false)
    fetchDelegations()
  }

  return { delegations, loading, error, refetch }
}
