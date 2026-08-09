import { createAdminClient } from "@/lib/supabase/admin"
import { badRequest } from "@/lib/api/errors"
import { resolveActor } from "@/lib/api/actor"
import {
  desvincularFacturaDeMovimiento,
  obtenerFactura,
  vincularFacturaAMovimiento,
} from "@/lib/api/facturas"
import { conApi, cuerpoJson, qTexto } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * POST /api/v1/facturas/{id}/vincular
 *
 * Concilia la factura con un movimiento bancario (`{ movimiento_id }`). Una
 * factura admite varios movimientos (pago en plazos); un movimiento, como mucho
 * una factura. El estado de la factura lo recalcula la base de datos.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "write", async ({ baseUrl, actorHint }) => {
    const { id } = await params
    const cuerpo = await cuerpoJson(request)
    const movimientoId = cuerpo.movimiento_id
    if (typeof movimientoId !== "string" || !movimientoId) {
      throw badRequest("Falta 'movimiento_id'.")
    }

    const admin = createAdminClient()
    const actor = await resolveActor(admin, {
      usuario_id: (cuerpo.usuario_id as string) ?? actorHint.usuario_id,
      usuario_email: (cuerpo.usuario_email as string) ?? actorHint.usuario_email,
    })

    await vincularFacturaAMovimiento(admin, id, movimientoId, actor.id)
    return { factura: await obtenerFactura(admin, id, { baseUrl }) }
  })
}

/**
 * DELETE /api/v1/facturas/{id}/vincular?movimiento_id=...
 *
 * Deshace el vínculo con un movimiento concreto.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "write", async ({ baseUrl, params: query }) => {
    const { id } = await params
    const movimientoId = qTexto(query, "movimiento_id")
    if (!movimientoId) throw badRequest("Falta 'movimiento_id' en la query.")

    const admin = createAdminClient()
    await desvincularFacturaDeMovimiento(admin, id, movimientoId)
    return { factura: await obtenerFactura(admin, id, { baseUrl }) }
  })
}
