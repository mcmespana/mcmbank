import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { verifyApiKey } from "@/lib/api/external-auth"
import {
  getMovimientoRaw,
  getArchivosRaw,
  serializeArchivo,
  serializeMovimiento,
} from "@/lib/api/movimientos-public"

export const runtime = "nodejs"

/**
 * GET /api/v1/movimientos/{id}
 *
 * API externa (Google Apps Script u otras apps internas). Devuelve un movimiento
 * por su ID, con sus relaciones (cuenta, categoría, delegación, contacto) y la
 * lista de archivos adjuntos embebida.
 *
 * Autenticación: cabecera `Authorization: Bearer <clave>` o `x-api-key: <clave>`.
 * El ID es único en toda la base de datos, así que no hace falta indicar la
 * delegación.
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
      movimiento: serializeMovimiento(movimiento, archivos),
    })
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
