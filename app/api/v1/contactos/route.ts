import { createAdminClient } from "@/lib/supabase/admin"
import { listContactos } from "@/lib/api/catalogos"
import { conApi, qBooleano, qLista, qTexto } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/contactos?delegaciones=Sevilla&texto=merca
 *
 * Proveedores y personas. Solo lectura: el alta se hace desde la aplicación.
 */
export async function GET(request: Request) {
  return conApi(request, "read", async ({ params }) => {
    const contactos = await listContactos(createAdminClient(), {
      delegaciones: qLista(params, "delegaciones") ?? null,
      texto: qTexto(params, "texto"),
      tipos: qLista(params, "tipos"),
      incluirArchivados: qBooleano(params, "incluir_archivados"),
    })
    return { total: contactos.length, contactos }
  })
}
