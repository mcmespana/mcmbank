"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"
import type { Delegacion } from "@/lib/types/database"

export function useUserDelegaciones() {
  const [delegaciones, setDelegaciones] = useState<Delegacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuth()

  const fetchDelegaciones = async () => {
    if (!user) {
      setDelegaciones([])
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

      const userDelegaciones = data?.map((item) => item.delegacion).filter(Boolean) || []
      setDelegaciones(userDelegaciones)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDelegaciones()
  }, [user])

  return { delegaciones, loading, error, refetch: fetchDelegaciones }
}
