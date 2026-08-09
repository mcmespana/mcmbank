import { createAdminClient } from "@/lib/supabase/admin"
import { resumenGeneral } from "@/lib/api/resumen"
import { conApi, qBooleano, qLista, qTexto } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/resumen?desde=2026-01-01&hasta=2026-12-31
 *
 * Foto económica de una, varias o todas las delegaciones: ingresos, gastos,
 * neto y saldo por delegación, desglose por categoría, y facturas y avisos
 * pendientes de cada una.
 *
 * El saldo suma todo el histórico de las cuentas activas (incluidos los
 * movimientos ignorados, porque el saldo refleja el extracto del banco); los
 * ingresos y gastos sí respetan el rango de fechas y excluyen los ignorados.
 */
export async function GET(request: Request) {
  return conApi(request, "read", async ({ params }) =>
    resumenGeneral(createAdminClient(), {
      delegaciones: qLista(params, "delegaciones") ?? null,
      desde: qTexto(params, "desde"),
      hasta: qTexto(params, "hasta"),
      incluirIgnorados: qBooleano(params, "incluir_ignorados"),
    }),
  )
}
