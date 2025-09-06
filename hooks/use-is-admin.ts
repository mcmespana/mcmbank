"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"

export function useIsAdmin() {
  const { user } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (!user) {
      setIsAdmin(false)
      return
    }
    let isMounted = true
    const check = async () => {
      const { data, error } = await supabase
        .from("membresia")
        .select("rol")
        .eq("usuario_id", user.id)
      if (!error && isMounted) {
        setIsAdmin((data ?? []).some((m) => m.rol === "admin"))
      }
    }
    check()
    return () => {
      isMounted = false
    }
  }, [user])

  return isAdmin
}

