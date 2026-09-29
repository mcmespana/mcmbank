import { createAdminClient } from "@/lib/supabase/admin"
import { resolveActor } from "@/lib/api/actor"
import { badRequest } from "@/lib/api/errors"
import { imputarMovimientosSubvencion, quitarMovimientosSubvencion, type ImputarItem } from "@/lib/api/subvenciones"
import { conApi, cuerpoJson } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * POST /api/v1/subvenciones/{id}/movimientos
 *
 * { "movimientos": [{ "id": "…", "importe": 600 }, { "id": "…", "porcentaje": 60 }, { "id": "…" }] }
 *
 * Imputa movimientos a la subvención, cada uno por su importe, su porcentaje o
 * —sin nada— por todo lo que le quede libre. Si alguno no cabe, el resto entra
 * igual y `errores` dice cuál y por qué.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "write", async ({ actorHint }) => {
    const { id } = await params
    const cuerpo = await cuerpoJson(request)
    if (!Array.isArray(cuerpo.movimientos)) {
      throw badRequest("Falta 'movimientos': una lista de { id, importe? | porcentaje? }.")
    }
    const admin = createAdminClient()
    const actor = await resolveActor(admin, {
      usuario_id: (cuerpo.usuario_id as string) ?? actorHint.usuario_id,
      usuario_email: (cuerpo.usuario_email as string) ?? actorHint.usuario_email,
    })
    const items = (cuerpo.movimientos as unknown[]).map((m) =>
      typeof m === "string" ? { id: m } : (m as ImputarItem),
    )
    return imputarMovimientosSubvencion(admin, id, items, actor.id)
  })
}

/**
 * DELETE /api/v1/subvenciones/{id}/movimientos
 *
 * { "movimiento_ids": ["…", "…"] } — los quita de la subvención (no los borra).
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "write", async () => {
    const { id } = await params
    const cuerpo = await cuerpoJson(request)
    if (!Array.isArray(cuerpo.movimiento_ids)) throw badRequest("Falta 'movimiento_ids': una lista de ids.")
    return quitarMovimientosSubvencion(createAdminClient(), id, cuerpo.movimiento_ids as string[])
  })
}
