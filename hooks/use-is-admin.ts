"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"

export function useIsAdmin() {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)

  // Depend on user.id (primitive) instead of user object to avoid re-fetching
  // when session refresh creates a new User object with the same ID
  const userId = user?.id ?? null

  useEffect(() => {
    let mounted = true
    const checkRole = async () => {
      if (!userId) {
        setIsAdmin(false)
        return
      }
      try {
        const { data, error } = await supabase
          .from("membresia")
          .select("rol")
          .eq("usuario_id", userId)
          .eq("rol", "gestor_central")
          .limit(1)
        if (!mounted) return
        if (error) {
          console.error("Error checking admin role", error)
          setIsAdmin(false)
        } else {
          setIsAdmin(data?.length > 0)
        }
      } catch (err) {
        console.error("useIsAdmin: unexpected error", err)
        if (mounted) setIsAdmin(false)
      }
    }
    checkRole()
    return () => {
      mounted = false
    }
  }, [userId])

  return isAdmin
}

export default useIsAdmin
