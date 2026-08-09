import { createAdminClient } from "@/lib/supabase/admin"
import { listCategorias } from "@/lib/api/catalogos"
import { conApi, qBooleano, qLista } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/categorias?delegaciones=Sevilla
 *
 * Categorías visibles para las delegaciones indicadas: las globales de MCM más
 * las propias de cada delegación. Cuando se pide una sola delegación se aplica
 * además su orden y visibilidad personalizados.
 */
export async function GET(request: Request) {
  return conApi(request, "read", async ({ params }) => {
    const categorias = await listCategorias(createAdminClient(), {
      delegaciones: qLista(params, "delegaciones") ?? null,
      incluirInactivas: qBooleano(params, "incluir_inactivas"),
    })
    return { total: categorias.length, categorias }
  })
}
