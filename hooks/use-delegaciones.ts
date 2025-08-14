"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase/client"
import type { Delegacion } from "@/lib/types/database"

export function useDelegaciones() {
  const [delegaciones, setDelegaciones] = useState<Delegacion[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchDelegaciones() {
      try {
        setLoading(true)

        const {
          data: { user },
        } = await supabase.auth.getUser()

        if (!user) {
          setError("Usuario no autenticado")
          return
        }

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

        const delegacionesData = data?.map((item) => item.delegacion).filter(Boolean) as Delegacion[]
        setDelegaciones(delegacionesData || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido")
      } finally {
        setLoading(false)
      }
    }

    fetchDelegaciones()
  }, [])

  return { delegaciones, loading, error }
}
