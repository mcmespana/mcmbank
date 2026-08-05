import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

/**
 * Server-side guard for admin-only API routes. Any new admin route must call
 * this before touching createAdminClient()/service-role operations.
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

  const { data: membership, error: memErr } = await supabase
    .from("membresia")
    .select("rol")
    .eq("usuario_id", user.id)
    .eq("rol", "gestor_central")
    .maybeSingle()

  if (memErr || !membership) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 403 }) }
  }

  return { user }
}
