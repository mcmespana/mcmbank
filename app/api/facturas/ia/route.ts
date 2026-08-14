import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { aceptarCategoriaSugerida, extraerDatosFactura } from "@/lib/api/factura-ia"
import { toErrorPayload } from "@/lib/api/errors"

export const runtime = "nodejs"

const ROLES_ESCRITURA = ["tesorero", "gestor_central"]

/**
 * POST /api/facturas/ia
 *
 * Lectura automática de una factura desde la app, con sesión de usuario:
 *
 *   { facturaId, accion: "extraer", forzar? }
 *   { facturaId, accion: "aceptar_categoria", categoria_id? }
 *
 * El trabajo de verdad vive en `lib/api/factura-ia.ts`, compartido con la API
 * externa y el servidor MCP; aquí solo se comprueba que quien lo pide puede
 * escribir en la delegación de esa factura. Misma división que en
 * `app/api/avisos/notificar/route.ts`.
 */
export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const facturaId = typeof body?.facturaId === "string" ? body.facturaId : null
  const accion = body?.accion === "aceptar_categoria" ? "aceptar_categoria" : "extraer"
  if (!facturaId) {
    return NextResponse.json({ error: "Falta facturaId" }, { status: 400 })
  }

  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 })
  }

  // RLS ya limita la factura a las delegaciones del usuario: si no la ve, no es
  // suya.
  const { data: factura, error: facturaError } = await (supabase as any)
    .from("factura")
    .select("id, delegacion_id")
    .eq("id", facturaId)
    .maybeSingle()

  if (facturaError) {
    console.error("Error cargando la factura para leerla con IA:", facturaError)
    return NextResponse.json({ error: "No se pudo cargar la factura" }, { status: 500 })
  }
  if (!factura) {
    return NextResponse.json({ error: "Factura no encontrada" }, { status: 404 })
  }

  const { data: membresia } = await (supabase as any)
    .from("membresia")
    .select("rol")
    .eq("usuario_id", user.id)
    .eq("delegacion_id", factura.delegacion_id)
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

  if (!esGestorCentralGlobal && !ROLES_ESCRITURA.includes(membresia?.rol)) {
    return NextResponse.json({ error: "Acceso restringido" }, { status: 403 })
  }

  const admin = createAdminClient()
  const url = new URL(req.url)
  const baseUrl = `${url.protocol}//${url.host}`

  try {
    if (accion === "aceptar_categoria") {
      const facturaActualizada = await aceptarCategoriaSugerida(admin, facturaId, {
        categoriaId: typeof body?.categoria_id === "string" ? body.categoria_id : null,
        actorId: user.id,
        baseUrl,
      })
      return NextResponse.json({ ok: true, factura: facturaActualizada })
    }

    const { factura: resultado, datos } = await extraerDatosFactura(admin, facturaId, {
      actorId: user.id,
      forzar: body?.forzar === true,
      baseUrl,
    })
    return NextResponse.json({ ok: true, factura: resultado, datos_ia: datos })
  } catch (err) {
    const { status, body: payload } = toErrorPayload(err)
    return NextResponse.json({ error: payload.error }, { status })
  }
}
