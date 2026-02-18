"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"

interface DelegationRoleState {
  role: string | null
  loading: boolean
  error: string | null
}

export function useDelegationRole(delegationId?: string | null): DelegationRoleState {
  const { user } = useAuth()
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Depend on user.id (primitive) to avoid re-fetching on User object reference changes
  const userId = user?.id ?? null

  useEffect(() => {
    let isMounted = true
    const abortController = new AbortController()

    const fetchRole = async () => {
      if (!userId || !delegationId) {
        if (!isMounted) return
        setRole(null)
        setError(null)
        setLoading(false)
        return
      }

      setLoading(true)
      setError(null)

      try {
        const query = supabase
          .from("membresia")
          .select("rol")
          .eq("usuario_id", userId)
          .eq("delegacion_id", delegationId)
          .maybeSingle()

        const { data, error: queryError } = await (query as any).abortSignal(abortController.signal)

        if (!isMounted) return

        if (queryError) {
          console.error("useDelegationRole: error fetching role", queryError)
          setRole(null)
          setError(queryError.message)
        } else {
          setRole(data?.rol ?? null)
        }
      } catch (err) {
        if (!isMounted) return
        if ((err as Error).name === "AbortError") return
        console.error("useDelegationRole: unexpected error", err)
        setRole(null)
        setError(err instanceof Error ? err.message : "Error obteniendo el rol de la delegación")
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchRole()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [delegationId, userId])

  return { role, loading, error }
}

export default useDelegationRole
