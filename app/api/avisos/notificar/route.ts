import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { enviarNotificacionAviso } from "@/lib/services/aviso-notificaciones"
import { toErrorPayload } from "@/lib/api/errors"

const ROLES_ESCRITURA = ["tesorero", "gestor_central"]

/**
 * Envía por correo un aviso o tarea a quien corresponda. Esta ruta solo se
 * ocupa de la autorización del usuario con sesión; el "a quién" y el contenido
 * del correo viven en `lib/services/aviso-notificaciones.ts`, compartidos con
 * la API externa y el servidor MCP.
 */
export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const avisoId = typeof body?.avisoId === "string" ? body.avisoId : null
  if (!avisoId) {
    return NextResponse.json({ error: "Falta avisoId" }, { status: 400 })
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // RLS ya limita el aviso a las delegaciones del usuario.
  const { data: aviso, error: avisoError } = await (supabase as any)
    .from("aviso")
    .select("id, delegacion_id, tipo, contenido, referencia, destinatario, creado_por, creado_en")
    .eq("id", avisoId)
    .maybeSingle()

  if (avisoError) {
    console.error("Error cargando el aviso a notificar:", avisoError)
    return NextResponse.json({ error: "No se pudo cargar el aviso" }, { status: 500 })
  }
  if (!aviso) {
    return NextResponse.json({ error: "Aviso no encontrado" }, { status: 404 })
  }

  // Solo quien puede escribir en la delegación puede lanzar correos.
  const { data: membresia } = await (supabase as any)
    .from("membresia")
    .select("rol")
    .eq("usuario_id", user.id)
    .eq("delegacion_id", aviso.delegacion_id)
    .maybeSingle()

  const esGestorCentralGlobal = await (async () => {
    const { data } = await (supabase as any)
      .from("membresia")
      .select("rol")
      .eq("usuario_id", user.id)
      .eq("rol", "gestor_central")
      .limit(1)
    return Boolean(data?.length)
  })()

  if (!membresia && !esGestorCentralGlobal) {
    return NextResponse.json({ error: "Sin acceso a la delegación" }, { status: 403 })
  }
  if (!esGestorCentralGlobal && !ROLES_ESCRITURA.includes(membresia?.rol)) {
    return NextResponse.json({ error: "Acceso restringido" }, { status: 403 })
  }

  try {
    const { destinatarios } = await enviarNotificacionAviso(createAdminClient(), aviso, {
      marcarNotificadoPor: user.id,
    })
    return NextResponse.json({ ok: true, destinatarios })
  } catch (err) {
    const { status, body: payload } = toErrorPayload(err)
    return NextResponse.json({ error: payload.error }, { status })
  }
}
