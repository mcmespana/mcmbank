import { NextResponse } from "next/server"
import { requireDelegationAccess } from "@/lib/services/informe-auth"
import { getAuthorizedClient, PLANTILLA_MEMORIA_DEFAULT_ID } from "@/lib/services/google"
import {
  buildContext,
  buildDefaultMapeo,
  cursoLabel,
  generarSheet,
  type MapeoConfig,
  type PeriodoTipo,
} from "@/lib/services/memoria-economica"

export async function POST(req: Request) {
  let body: any
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 })
  }

  const delegacionId = body.delegacionId as string
  const periodoTipo = (body.periodoTipo as PeriodoTipo) || "curso"
  const anio = Number(body.anio)
  const mapeoEntrada = (body.mapeo as MapeoConfig | undefined) ?? null
  const informeId = (body.informeId as string | undefined) ?? null
  const tituloEntrada = body.titulo as string | undefined

  if (!anio) return NextResponse.json({ error: "Falta el año" }, { status: 400 })

  const access = await requireDelegationAccess(delegacionId, { write: true })
  if (access.error) return access.error
  const supabase = access.supabase as any
  const user = access.user!

  // Cliente Google autorizado
  const client = await getAuthorizedClient(supabase, user.id)
  if (!client) {
    return NextResponse.json({ needsAuth: true, error: "Conecta tu cuenta de Google" }, { status: 428 })
  }

  try {
    // Plantilla configurada (org) o por defecto
    const { data: org } = await supabase
      .from("organizacion")
      .select("plantilla_memoria_sheet_id")
      .limit(1)
      .maybeSingle()
    const templateId = org?.plantilla_memoria_sheet_id || PLANTILLA_MEMORIA_DEFAULT_ID

    const ctx = await buildContext(supabase, delegacionId, periodoTipo, anio)
    const mapeo = mapeoEntrada ?? buildDefaultMapeo(ctx)

    const corto = ctx.delegacionNombre.replace(/^MCM\s+/i, "").trim()
    const label = periodoTipo === "curso" ? cursoLabel(anio) : String(anio)
    const titulo = (tituloEntrada && tituloEntrada.trim()) || `MCM ${corto} · Balance Económico ${label}`

    const resultado = await generarSheet(client, { templateId, ctx, mapeo, titulo })

    // Crear / actualizar informe
    const payload = {
      delegacion_id: delegacionId,
      tipo: "anual" as const,
      periodicidad: "anual" as const,
      periodo_tipo: periodoTipo,
      anio,
      curso_label: periodoTipo === "curso" ? cursoLabel(anio) : null,
      titulo,
      estado: "pendiente" as const,
      origen: "generado" as const,
      drive_url: resultado.webViewLink,
      drive_file_id: resultado.spreadsheetId,
      config_generacion: mapeo as any,
      es_borrador: false,
      creado_por: user.id,
    }

    let savedId = informeId
    if (informeId) {
      const { error } = await supabase.from("informe").update(payload).eq("id", informeId)
      if (error) throw error
    } else {
      const { data, error } = await supabase.from("informe").insert([payload]).select("id").single()
      if (error) throw error
      savedId = data.id
    }

    return NextResponse.json({
      ok: true,
      informeId: savedId,
      driveUrl: resultado.webViewLink,
      spreadsheetId: resultado.spreadsheetId,
      titulo,
    })
  } catch (err: any) {
    console.error("Error generando memoria:", err?.message || err)
    return NextResponse.json({ error: err?.message || "Error generando la memoria" }, { status: 500 })
  }
}
