import { createAdminClient } from "@/lib/supabase/admin"
import { resolveActor } from "@/lib/api/actor"
import { aceptarCategoriaSugerida } from "@/lib/api/factura-ia"
import { conApi, cuerpoJson } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * POST /api/v1/facturas/{id}/categoria
 *
 * Acepta la categoría de una factura: la sugerida por la IA si no se indica
 * otra, o la que venga en `{ "categoria_id": "…" }`.
 *
 * Existe como paso aparte a propósito. La lectura automática **nunca** escribe
 * la categoría por su cuenta: alguien tiene que decir que sí, y esta llamada es
 * ese sí. Si la factura ya está conciliada, la categoría se propaga a los
 * movimientos vinculados que no tuvieran ninguna.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "write", async ({ baseUrl, actorHint }) => {
    const { id } = await params
    const cuerpo = await cuerpoJson(request).catch(() => ({}) as Record<string, unknown>)

    const admin = createAdminClient()
    const actor = await resolveActor(admin, {
      usuario_id: (cuerpo.usuario_id as string) ?? actorHint.usuario_id,
      usuario_email: (cuerpo.usuario_email as string) ?? actorHint.usuario_email,
    })

    const factura = await aceptarCategoriaSugerida(admin, id, {
      categoriaId: typeof cuerpo.categoria_id === "string" ? cuerpo.categoria_id : null,
      actorId: actor.id,
      baseUrl,
    })

    return { factura }
  })
}
