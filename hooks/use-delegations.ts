"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Delegacion } from "@/lib/types/database"

export function useDelegations() {
  const [delegations, setDelegations] = useState<Delegacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const fetchDelegations = useCallback(async () => {
    if (!user) {
      setDelegations([])
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading delegations")
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchDelegations()
  }, [fetchDelegations])

  return { delegations, loading, error, refetch: fetchDelegations }
}
