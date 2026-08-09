import { createAdminClient } from "@/lib/supabase/admin"
import { resolveActor } from "@/lib/api/actor"
import { crearAviso, listarAvisos } from "@/lib/api/avisos"
import type { AvisoDestinatario, AvisoEstado, AvisoTipo } from "@/lib/types/avisos"
import {
  conApi,
  cuerpoJson,
  qLista,
  qNumero,
  qOpcion,
  qTexto,
} from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/avisos?delegaciones=Sevilla&estado=pendiente
 *
 * Notas y tareas del canal entre la oficina técnica y los tesoreros. Sin
 * `delegaciones`, las de todas; sin `estado`, solo las pendientes.
 */
export async function GET(request: Request) {
  return conApi(request, "read", async ({ params }) =>
    listarAvisos(createAdminClient(), {
      delegaciones: qLista(params, "delegaciones") ?? null,
      estado: qOpcion(params, "estado", ["pendiente", "hecha", "todas"] as const) as
        | AvisoEstado
        | "todas"
        | undefined,
      tipo: qOpcion(params, "tipo", ["tarea", "nota"] as const) as AvisoTipo | undefined,
      destinatario: qOpcion(params, "destinatario", [
        "oficina_tecnica",
        "delegacion",
      ] as const) as AvisoDestinatario | undefined,
      texto: qTexto(params, "texto"),
      limite: qNumero(params, "limite"),
    }),
  )
}

/**
 * POST /api/v1/avisos
 *
 * Deja una nota o una tarea en una delegación.
 *
 * Cuerpo: `{ delegacion, contenido, tipo?, destinatario?, referencia?,
 * notificar?, usuario_email? }`. Con `notificar: true` se envía además por
 * correo (tesoreros de la delegación o gestores centrales, según el
 * destinatario). Si el correo falla, el aviso ya está guardado y la respuesta
 * lo explica en `aviso_notificacion`.
 */
export async function POST(request: Request) {
  return conApi(request, "write", async ({ actorHint }) => {
    const cuerpo = await cuerpoJson(request)
    const admin = createAdminClient()

    const actor = await resolveActor(admin, {
      usuario_id: (cuerpo.usuario_id as string) ?? actorHint.usuario_id,
      usuario_email: (cuerpo.usuario_email as string) ?? actorHint.usuario_email,
    })

    return crearAviso(
      admin,
      {
        delegacion: String(cuerpo.delegacion ?? ""),
        contenido: String(cuerpo.contenido ?? ""),
        tipo: cuerpo.tipo as AvisoTipo | null,
        destinatario: cuerpo.destinatario as AvisoDestinatario | null,
        referencia: cuerpo.referencia as string | null,
        notificar: Boolean(cuerpo.notificar),
      },
      actor.id,
    )
  })
}
