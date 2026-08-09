import { createAdminClient } from "@/lib/supabase/admin"
import { resolveActor } from "@/lib/api/actor"
import { listarArchivosFactura, subirArchivoAFactura } from "@/lib/api/archivos"
import { conApi, cuerpoJson } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/** GET /api/v1/facturas/{id}/archivos — archivos de la factura. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "read", async ({ baseUrl }) => {
    const { id } = await params
    const archivos = await listarArchivosFactura(createAdminClient(), id, { baseUrl })
    return { factura_id: id, total: archivos.length, archivos }
  })
}

/**
 * POST /api/v1/facturas/{id}/archivos
 *
 * Adjunta un archivo a la factura. Si la factura ya está conciliada, el archivo
 * se replica en sus movimientos para que se vea desde ambos lados.
 *
 * Cuerpo: `{ nombre, contenido_base64, tipo_mime?, descripcion?, bucket? }`
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "write", async ({ baseUrl, actorHint }) => {
    const { id } = await params
    const cuerpo = await cuerpoJson(request)
    const admin = createAdminClient()

    const actor = await resolveActor(admin, {
      usuario_id: (cuerpo.usuario_id as string) ?? actorHint.usuario_id,
      usuario_email: (cuerpo.usuario_email as string) ?? actorHint.usuario_email,
    })

    return subirArchivoAFactura(admin, {
      facturaId: id,
      archivo: {
        nombre: String(cuerpo.nombre ?? ""),
        contenido_base64: String(cuerpo.contenido_base64 ?? ""),
        tipo_mime: (cuerpo.tipo_mime as string) ?? null,
        descripcion: (cuerpo.descripcion as string) ?? null,
        bucket: (cuerpo.bucket as "facturas" | "documentos") ?? null,
      },
      actorId: actor.id,
      baseUrl,
    })
  })
}
