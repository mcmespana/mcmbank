import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Server-side guard for admin-only API routes. Any new admin route must call
 * this before touching createAdminClient()/service-role operations.
 *
 * Ser gestor central es una condición sobre el CONJUNTO de membresías, no
 * sobre una fila: quien lleva la oficina técnica lo es en las dieciocho
 * delegaciones. Por eso se pide `limit(1)` y se mira si vino algo, y no
 * `maybeSingle()`, que ante más de una fila no devuelve la primera sino un
 * error (PGRST116) — y ese error, traducido a 403, dejaba fuera de las rutas
 * de administración justo a los admins con más delegaciones a su cargo.
 */
export async function requireAdmin() {
  const supabase = createClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()

  if (authError || !user) {
    return { error: NextResponse.json({ error: "No autenticado" }, { status: 401 }) }
  }

  const { data: membresias, error: memErr } = await supabase
    .from("membresia")
    .select("rol")
    .eq("usuario_id", user.id)
    .eq("rol", "gestor_central")
    .limit(1)

  if (memErr) {
    console.error("requireAdmin: error consultando membresías", memErr)
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) }
  }

  if (!membresias || membresias.length === 0) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) }
  }

  return { user }
}
