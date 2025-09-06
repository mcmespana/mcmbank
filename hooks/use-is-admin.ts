"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"

export function useIsAdmin() {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let mounted = true
    const checkRole = async () => {
      if (!user) {
        setIsAdmin(false)
        return
      }
      try {
        const { data, error } = await supabase
          .from("membresia")
          .select("rol")
          .eq("usuario_id", user.id)
          .eq("rol", "admin")
          .limit(1)
        if (!mounted) return
        if (error) {
          console.error("Error checking admin role", error)
          setIsAdmin(false)
        } else {
          setIsAdmin(data?.length > 0)
        }
      } catch (err) {
        if (mounted) setIsAdmin(false)
      }
    }
    checkRole()
    return () => {
      mounted = false
    }
  }, [user])

  return isAdmin
}

export default useIsAdmin
