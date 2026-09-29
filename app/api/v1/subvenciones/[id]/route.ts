import { createAdminClient } from "@/lib/supabase/admin"
import { obtenerSubvencion } from "@/lib/api/subvenciones"
import { conApi, qBooleano } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/subvenciones/{id}?movimientos=false&archivos=false
 *
 * La ficha, los ids de sus movimientos y, salvo `movimientos=false`, los
 * movimientos completos con sus archivos (facturas y justificantes, con
 * `url_descarga`). Es lo que hace falta para montar el Excel de justificación.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "read", async ({ params: q, baseUrl }) => {
    const { id } = await params
    return obtenerSubvencion(createAdminClient(), id, {
      incluirMovimientos: qBooleano(q, "movimientos") ?? true,
      incluirArchivos: qBooleano(q, "archivos") ?? true,
      baseUrl,
    })
  })
}
