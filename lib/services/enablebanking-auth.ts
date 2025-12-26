import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export const requireGestorCentral = async () => {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
  }

  const { data, error } = await supabase
    .from("membresia")
    .select("rol")
    .eq("usuario_id", user.id)
    .eq("rol", "gestor_central")
    .limit(1)

  if (error || !data?.length) {
    return { error: NextResponse.json({ error: "Acceso restringido" }, { status: 403 }) }
  }

  return { user }
}
