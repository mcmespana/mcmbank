import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

const WRITER_ROLES = ["tesorero", "gestor_central"]

/** Verifica que el usuario es miembro (o escritor) de la delegación. */
export async function requireDelegationAccess(
  delegacionId: string,
  opts: { write?: boolean } = {},
) {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: "No autorizado" }, { status: 401 }) }
  }
  if (!delegacionId) {
    return { error: NextResponse.json({ error: "Falta delegacion_id" }, { status: 400 }) }
  }

  const { data } = await (supabase as any)
    .from("membresia")
    .select("rol")
    .eq("usuario_id", user.id)
    .eq("delegacion_id", delegacionId)
    .maybeSingle()

  if (!data) {
    return { error: NextResponse.json({ error: "Sin acceso a la delegación" }, { status: 403 }) }
  }
  if (opts.write && !WRITER_ROLES.includes(data.rol)) {
    return { error: NextResponse.json({ error: "Acceso restringido" }, { status: 403 }) }
  }

  return { user, supabase, rol: data.rol }
}
