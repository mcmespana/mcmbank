"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Delegacion } from "@/lib/types/database"

export function useUserDelegaciones() {
  const [delegaciones, setDelegaciones] = useState<Delegacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const userRef = useRef(user)
  userRef.current = user
  const userId = user?.id ?? null

  const fetchDelegaciones = useCallback(async () => {
    const currentUser = userRef.current
    if (!currentUser) {
      setDelegaciones([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error } = await supabase
        .from("delegacion")
        .select(
          `
          id,
          organizacion_id,
          codigo,
          nombre,
          creado_en
        `,
        )
        .in("id", (currentUser as any).delegaciones.map((d: { delegacion_id: any }) => d.delegacion_id))

      if (error) {
        throw error
      }

      setDelegaciones(data || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchDelegaciones()
  }, [fetchDelegaciones])

  return { delegaciones, loading, error, refetch: fetchDelegaciones }
}
