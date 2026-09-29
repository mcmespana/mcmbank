import { createAdminClient } from "@/lib/supabase/admin"
import { listarSubvenciones } from "@/lib/api/subvenciones"
import { conApi, qLista, qNumero, qTexto } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/subvenciones?estados=concedida,justificada&ejercicio=2026&texto=ivaj
 *
 * Subvenciones de la organización con su resumen (nº de movimientos imputados,
 * delegaciones y total de gastos).
 */
export async function GET(request: Request) {
  return conApi(request, "read", async ({ params }) =>
    listarSubvenciones(createAdminClient(), {
      estados: qLista(params, "estados"),
      ejercicio: qNumero(params, "ejercicio"),
      texto: qTexto(params, "texto"),
    }),
  )
}
