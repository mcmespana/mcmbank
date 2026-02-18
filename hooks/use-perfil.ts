import { useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'
import { supabase } from '@/lib/supabase/client'

interface Perfil {
  usuario_id: string
  nombre_completo: string
  creado_en: string
}

export function usePerfil() {
  const { user } = useAuth()
  const [perfil, setPerfil] = useState<Perfil | null>(null)
  const [loading, setLoading] = useState(true)
  const lastUserIdRef = useRef<string | null>(null)

  // Depend on user.id (primitive string) instead of user object reference.
  // This prevents re-fetching when the User object changes but the ID stays the same
  // (e.g., after session refresh updates last_sign_in_at).
  const userId = user?.id ?? null

  useEffect(() => {
    // If the user ID hasn't changed and we already have a perfil, skip
    if (userId === lastUserIdRef.current && perfil !== null) {
      return
    }
    lastUserIdRef.current = userId

    let mounted = true

    async function fetchPerfil() {
      if (!userId) {
        setPerfil(null)
        setLoading(false)
        return
      }

      // Don't set loading=true if we already have data for this user (avoids flash)
      if (!perfil || perfil.usuario_id !== userId) {
        setLoading(true)
      }

      try {
        const { data, error } = await supabase
          .from('perfil')
          .select('usuario_id, nombre_completo, creado_en')
          .eq('usuario_id', userId)
          .single()

        if (!mounted) return

        if (error) {
          console.error('Error fetching perfil:', error)
          setPerfil(null)
        } else {
          setPerfil(data)
        }
      } catch (error) {
        console.error('Error fetching perfil:', error)
        if (mounted) setPerfil(null)
      } finally {
        if (mounted) setLoading(false)
      }
    }

    fetchPerfil()
    return () => { mounted = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  return { perfil, loading }
}
