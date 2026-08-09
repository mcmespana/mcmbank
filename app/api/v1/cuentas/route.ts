import { createAdminClient } from "@/lib/supabase/admin"
import { listCuentas } from "@/lib/api/catalogos"
import { conApi, qBooleano, qLista } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/cuentas?delegaciones=Sevilla&incluir_inactivas=true
 *
 * Cuentas bancarias y cajas. Sin `delegaciones`, las de todas.
 */
export async function GET(request: Request) {
  return conApi(request, "read", async ({ params }) => {
    const cuentas = await listCuentas(createAdminClient(), {
      delegaciones: qLista(params, "delegaciones") ?? null,
      incluirInactivas: qBooleano(params, "incluir_inactivas"),
    })
    return { total: cuentas.length, cuentas }
  })
}
