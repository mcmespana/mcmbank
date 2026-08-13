import { createAdminClient } from "@/lib/supabase/admin"
import { listarAsignablesAviso } from "@/lib/api/avisos"
import type { AvisoDestinatario } from "@/lib/types/avisos"
import { badRequest } from "@/lib/api/errors"
import { conApi, qOpcion, qTexto } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/avisos/asignables?delegacion=Sevilla&destinatario=delegacion
 *
 * A quién se le puede asignar como responsable una tarea: tesoreros de la
 * delegación si va dirigida a ella, o gestores centrales si va dirigida a la
 * oficina técnica. Mismo criterio que los destinatarios del correo.
 */
export async function GET(request: Request) {
  return conApi(request, "read", async ({ params }) => {
    const delegacion = qTexto(params, "delegacion")
    if (!delegacion) throw badRequest("Falta 'delegacion'.")
    const destinatario = qOpcion(params, "destinatario", ["oficina_tecnica", "delegacion"] as const) as
      | AvisoDestinatario
      | undefined
    if (!destinatario) throw badRequest("Falta 'destinatario' ('oficina_tecnica' o 'delegacion').")

    const asignables = await listarAsignablesAviso(createAdminClient(), delegacion, destinatario)
    return { asignables }
  })
}
