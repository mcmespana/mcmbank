import { createAdminClient } from "@/lib/supabase/admin"
import { resolveActor } from "@/lib/api/actor"
import { actualizarAviso, eliminarAviso, obtenerAviso } from "@/lib/api/avisos"
import type { AvisoDestinatario, AvisoEstado } from "@/lib/types/avisos"
import { conApi, cuerpoJson } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/** GET /api/v1/avisos/{id} */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "read", async () => {
    const { id } = await params
    return { aviso: await obtenerAviso(createAdminClient(), id) }
  })
}

/**
 * PATCH /api/v1/avisos/{id}
 *
 * Edita el texto o cierra la tarea: `{ estado: "hecha" }` la marca como hecha
 * y anota quién lo hizo. También admite `responsable_id`, `fecha_limite`
 * ("AAAA-MM-DD") y `urgente`; pasa `null` en `responsable_id`/`fecha_limite`
 * para quitarlos.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "write", async ({ actorHint }) => {
    const { id } = await params
    const cuerpo = await cuerpoJson(request)
    const admin = createAdminClient()

    const actor = await resolveActor(admin, {
      usuario_id: (cuerpo.usuario_id as string) ?? actorHint.usuario_id,
      usuario_email: (cuerpo.usuario_email as string) ?? actorHint.usuario_email,
    })

    const aviso = await actualizarAviso(
      admin,
      id,
      {
        contenido: cuerpo.contenido as string | null,
        referencia: "referencia" in cuerpo ? (cuerpo.referencia as string | null) : undefined,
        destinatario: cuerpo.destinatario as AvisoDestinatario | null,
        estado: cuerpo.estado as AvisoEstado | null,
        responsable_id: "responsable_id" in cuerpo ? (cuerpo.responsable_id as string | null) : undefined,
        fecha_limite: "fecha_limite" in cuerpo ? (cuerpo.fecha_limite as string | null) : undefined,
        urgente: "urgente" in cuerpo ? Boolean(cuerpo.urgente) : undefined,
      },
      actor.id,
    )
    return { aviso }
  })
}

/** DELETE /api/v1/avisos/{id} — borra la nota o tarea. Irreversible. */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "write", async () => {
    const { id } = await params
    await eliminarAviso(createAdminClient(), id)
    return { eliminado: true, id }
  })
}
