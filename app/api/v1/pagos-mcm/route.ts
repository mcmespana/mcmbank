import { createAdminClient } from "@/lib/supabase/admin"
import { resolveActor } from "@/lib/api/actor"
import { crearPagoMcm, listarPagosMcm } from "@/lib/api/pagos"
import { conApi, cuerpoJson, qLista, qNumero } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/pagos-mcm?delegaciones=Sevilla
 *
 * Reembolsos a personas del movimiento (kilometraje, gastos adelantados).
 */
export async function GET(request: Request) {
  return conApi(request, "read", async ({ params }) =>
    listarPagosMcm(createAdminClient(), {
      delegaciones: qLista(params, "delegaciones") ?? null,
      estados: qLista(params, "estados"),
      limite: qNumero(params, "limite"),
      offset: qNumero(params, "offset"),
    }),
  )
}

/**
 * POST /api/v1/pagos-mcm
 *
 * Anota un pago manual pendiente ("hay que devolverle esto a fulano"): sin
 * cálculo de gasolina, que sigue siendo cosa de la aplicación.
 */
export async function POST(request: Request) {
  return conApi(request, "write", async ({ actorHint }) => {
    const cuerpo = await cuerpoJson(request)
    const admin = createAdminClient()
    const actor = await resolveActor(admin, {
      usuario_id: (cuerpo.usuario_id as string) ?? actorHint.usuario_id,
      usuario_email: (cuerpo.usuario_email as string) ?? actorHint.usuario_email,
    })

    const pago = await crearPagoMcm(
      admin,
      {
        delegacion: String(cuerpo.delegacion ?? ""),
        contacto_id: String(cuerpo.contacto_id ?? ""),
        concepto: String(cuerpo.concepto ?? ""),
        importe: Number(cuerpo.importe),
        descripcion: cuerpo.descripcion as string | null,
        notas: cuerpo.notas as string | null,
        estado: cuerpo.estado as "borrador" | "pendiente" | null,
        categoria_id_sugerida: cuerpo.categoria_id_sugerida as string | null,
      },
      actor.id,
    )

    return { pago }
  })
}
