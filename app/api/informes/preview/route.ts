import { NextResponse } from "next/server"
import { requireDelegationAccess } from "@/lib/services/informe-auth"
import { buildContext, buildPreview, type MapeoConfig, type PeriodoTipo } from "@/lib/services/memoria-economica"

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
  const mapeo = (body.mapeo as MapeoConfig | undefined) ?? null

  if (!anio) return NextResponse.json({ error: "Falta el año" }, { status: 400 })

  const access = await requireDelegationAccess(delegacionId)
  if (access.error) return access.error

  try {
    const ctx = await buildContext(access.supabase, delegacionId, periodoTipo, anio)
    const preview = buildPreview(ctx, mapeo)
    return NextResponse.json(preview)
  } catch (err: any) {
    console.error("Error en preview de memoria:", err?.message || err)
    return NextResponse.json({ error: err?.message || "Error calculando la vista previa" }, { status: 500 })
  }
}
