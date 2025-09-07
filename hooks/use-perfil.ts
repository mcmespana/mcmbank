import { useEffect, useState } from 'react'
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

  useEffect(() => {
    async function fetchPerfil() {
      if (!user) {
        setPerfil(null)
        setLoading(false)
        return
      }

      try {
        const { data, error } = await supabase
          .from('perfil')
          .select('usuario_id, nombre_completo, creado_en')
          .eq('usuario_id', user.id)
          .single()

        if (error) {
          console.error('Error fetching perfil:', error)
          setPerfil(null)
        } else {
          setPerfil(data)
        }
      } catch (error) {
        console.error('Error fetching perfil:', error)
        setPerfil(null)
      } finally {
        setLoading(false)
      }
    }

    fetchPerfil()
  }, [user])

  return { perfil, loading }
}
