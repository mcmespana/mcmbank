import { createAdminClient } from "@/lib/supabase/admin"
import { obtenerFichaMovimiento } from "@/lib/api/ficha-movimiento"
import { conApi, qNumero } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/movimientos/{id}/ficha?segundos_url=900
 *
 * Todo lo de un movimiento en una llamada: el movimiento, su factura
 * vinculada (proveedor, NIF, número, fechas, lectura de la IA), los importes
 * ya comparados (movimiento / factura / pagado / pendiente) y sus ficheros con
 * una URL firmada para descargarlos sin la clave de API. Pensado para
 * volcarlo a una hoja de cálculo y copiar los ficheros a Drive.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "read", async ({ baseUrl, params: query }) => {
    const { id } = await params
    const ficha = await obtenerFichaMovimiento(createAdminClient(), id, {
      baseUrl,
      segundosUrl: qNumero(query, "segundos_url"),
    })
    return { ficha }
  })
}
