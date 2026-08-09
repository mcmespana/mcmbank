import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "@/lib/api/errors"
import { actualizarMovimiento, obtenerMovimiento } from "@/lib/api/movimientos-public"
import { conApi, cuerpoJson } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/movimientos/{id}
 *
 * Devuelve un movimiento por su ID, con sus relaciones (cuenta, categoría,
 * delegación, contacto) y la lista de archivos adjuntos embebida. El ID es
 * único en toda la base de datos, así que no hace falta indicar la delegación.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "read", async ({ baseUrl }) => {
    const { id } = await params
    const movimiento = await obtenerMovimiento(createAdminClient(), id, { baseUrl })
    if (!movimiento) throw notFound("Movimiento no encontrado.")
    return { movimiento }
  })
}

/**
 * PATCH /api/v1/movimientos/{id}
 *
 * Modifica los campos editables: categoría, contacto, notas, descripción,
 * contraparte, método, `ignorado` y `factura_pendiente`. Importe, fecha, cuenta
 * y delegación no se tocan desde la API: vienen del banco.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "write", async ({ baseUrl }) => {
    const { id } = await params
    const cuerpo = await cuerpoJson(request)
    const movimiento = await actualizarMovimiento(createAdminClient(), id, cuerpo, { baseUrl })
    return { movimiento }
  })
}
