import { createAdminClient } from "@/lib/supabase/admin"
import { resolveActor } from "@/lib/api/actor"
import { notificarAviso, obtenerAviso } from "@/lib/api/avisos"
import { conApi } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * POST /api/v1/avisos/{id}/notificar
 *
 * Envía (o reenvía) el aviso por correo: a los tesoreros de su delegación o a
 * la oficina técnica, según a quién vaya dirigido. Nunca a su autor.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "write", async ({ actorHint }) => {
    const { id } = await params
    const admin = createAdminClient()
    const actor = await resolveActor(admin, actorHint)

    const { destinatarios } = await notificarAviso(admin, id, actor.id)
    return { aviso: await obtenerAviso(admin, id), notificados: destinatarios }
  })
}
