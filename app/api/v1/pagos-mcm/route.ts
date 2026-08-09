import { createAdminClient } from "@/lib/supabase/admin"
import { listarPagosMcm } from "@/lib/api/pagos"
import { conApi, qLista, qNumero } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/pagos-mcm?delegaciones=Sevilla
 *
 * Reembolsos a personas del movimiento (kilometraje, gastos adelantados).
 * Solo lectura: el alta tiene reglas propias (cálculo de gasolina, contacto
 * obligatorio) que se hacen desde la aplicación.
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
