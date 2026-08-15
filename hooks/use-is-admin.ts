"use client"

import { useEffect, useState } from "react"
import { supabase } from "@/lib/supabase/client"
import { useAuth } from "@/contexts/auth-context"

/**
 * Estado completo de la comprobación de rol. `loading` importa: mientras la
 * consulta está en vuelo no se sabe si el usuario es gestor central, y pintar
 * "Acceso restringido" en ese hueco le dice a un admin que no tiene permiso
 * justo antes de dejarle entrar. Quien solo necesite el booleano puede seguir
 * usando `useIsAdmin()`.
 */
export function useIsAdminState() {
  const { user, loading: authLoading } = useAuth()
  const [isAdmin, setIsAdmin] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let mounted = true
    const checkRole = async () => {
      if (!user) {
        setIsAdmin(false)
        if (!authLoading) setChecked(true)
        return
      }
      try {
        const { data, error } = await supabase
          .from("membresia")
          .select("rol")
          .eq("usuario_id", user.id)
          .eq("rol", "gestor_central")
          .limit(1)
        if (!mounted) return
        if (error) {
          console.error("Error checking admin role", error)
          setIsAdmin(false)
        } else {
          setIsAdmin(data?.length > 0)
        }
        setChecked(true)
      } catch (err) {
        console.error("useIsAdmin: unexpected error", err)
        if (mounted) {
          setIsAdmin(false)
          setChecked(true)
        }
      }
    }
    checkRole()
    return () => {
      mounted = false
    }
  }, [user, authLoading])

  return { isAdmin, loading: authLoading || !checked }
}

export function useIsAdmin() {
  return useIsAdminState().isAdmin
}

export default useIsAdmin
