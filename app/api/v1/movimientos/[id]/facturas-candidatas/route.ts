import { createAdminClient } from "@/lib/supabase/admin"
import { buscarFacturasParaMovimiento } from "@/lib/api/facturas"
import { conApi, qNumero } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/movimientos/{id}/facturas-candidatas
 *
 * Facturas de la bandeja que podrían corresponder a este movimiento, comparando
 * contra el importe que a cada una le queda por pagar (para que funcione
 * también con pagos en varios plazos).
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "read", async ({ baseUrl, params: query }) => {
    const { id } = await params
    const candidatas = await buscarFacturasParaMovimiento(createAdminClient(), id, {
      limite: qNumero(query, "limite"),
      baseUrl,
    })
    return { movimiento_id: id, total: candidatas.length, candidatas }
  })
}
