import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyApiKey } from "@/lib/api/external-auth"
import {
  getMovimientoRaw,
  getArchivosRaw,
  serializeArchivo,
} from "@/lib/api/movimientos-public"

export const runtime = "nodejs"

/**
 * GET /api/v1/movimientos/{id}/archivos
 *
 * API externa: devuelve únicamente los archivos adjuntos de un movimiento, con
 * su URL pública de descarga. Pensado para flujos que solo necesitan los
 * ficheros (p.ej. descargar facturas desde Google Apps Script).
 *
 * Autenticación: cabecera `Authorization: Bearer <clave>` o `x-api-key: <clave>`.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = verifyApiKey(request)
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status })
  }

  const { id } = await params
  if (!id) {
    return NextResponse.json({ ok: false, error: "Falta el ID del movimiento." }, { status: 400 })
  }

  try {
    const admin = createAdminClient()

    // Verificamos que el movimiento exista para distinguir "sin archivos" de
    // "movimiento inexistente".
    const movimiento = await getMovimientoRaw(admin, id)
    if (!movimiento) {
      return NextResponse.json(
        { ok: false, error: "Movimiento no encontrado." },
        { status: 404 },
      )
    }

    const archivosRaw = await getArchivosRaw(admin, id)
    const archivos = archivosRaw.map(serializeArchivo)

    return NextResponse.json({
      ok: true,
      movimiento_id: id,
      total: archivos.length,
      archivos,
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
