import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

/**
 * Quién está autorizando la conexión.
 *
 * La pantalla de consentimiento reutiliza la sesión que el navegador ya tiene
 * de MCM Bank: no hay un segundo login. Solo la **oficina técnica** puede
 * autorizar, porque el servidor MCP ve todas las delegaciones y bypasea RLS —
 * dárselo a un tesorero le abriría las cuentas de las otras diecisiete.
 */

export interface UsuarioAutorizador {
  id: string
  email: string | null
  nombre: string | null
  esGestorCentral: boolean
}

export async function usuarioActual(): Promise<UsuarioAutorizador | null> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const admin = createAdminClient()
  const [{ data: membresias }, { data: perfil }] = await Promise.all([
    (admin as any)
      .from("membresia")
      .select("rol")
      .eq("usuario_id", user.id)
      .eq("rol", "gestor_central")
      .limit(1),
    (admin as any).from("perfil").select("nombre_completo").eq("usuario_id", user.id).maybeSingle(),
  ])

  return {
    id: user.id,
    email: user.email ?? null,
    nombre: perfil?.nombre_completo?.trim() || null,
    esGestorCentral: Array.isArray(membresias) && membresias.length > 0,
  }
}
