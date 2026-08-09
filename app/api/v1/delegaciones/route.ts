import { createAdminClient } from "@/lib/supabase/admin"
import { listDelegaciones } from "@/lib/api/delegaciones"
import { conApi } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/delegaciones
 *
 * Todas las delegaciones con su id, código y nombre. Es el punto de partida
 * para cualquier integración que trabaje sobre varias delegaciones.
 */
export async function GET(request: Request) {
  return conApi(request, "read", async () => {
    const delegaciones = await listDelegaciones(createAdminClient())
    return { total: delegaciones.length, delegaciones }
  })
}
