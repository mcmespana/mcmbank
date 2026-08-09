import { createAdminClient } from "@/lib/supabase/admin"
import { notFound } from "@/lib/api/errors"
import { resolveActor } from "@/lib/api/actor"
import { subirArchivoAMovimiento } from "@/lib/api/archivos"
import {
  getArchivosRaw,
  getMovimientoRaw,
  serializeArchivo,
} from "@/lib/api/movimientos-public"
import { conApi, cuerpoJson } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * GET /api/v1/movimientos/{id}/archivos
 *
 * Solo los archivos adjuntos de un movimiento. Cada uno trae `url_descarga`,
 * un endpoint autenticado que redirige a una URL firmada; `url` es la URL
 * pública heredada y está vacía en los archivos subidos recientemente.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "read", async ({ baseUrl }) => {
    const { id } = await params
    const admin = createAdminClient()

    // Se comprueba que el movimiento exista para distinguir "sin archivos" de
    // "movimiento inexistente".
    const movimiento = await getMovimientoRaw(admin, id)
    if (!movimiento) throw notFound("Movimiento no encontrado.")

    const archivos = (await getArchivosRaw(admin, id)).map((a) => serializeArchivo(a, { baseUrl }))
    return { movimiento_id: id, total: archivos.length, archivos }
  })
}

/**
 * POST /api/v1/movimientos/{id}/archivos
 *
 * Adjunta un archivo (en base64) al movimiento. Si va al bucket `facturas`
 * —el predeterminado— también se registra en la sección Facturas ya conciliado
 * con este movimiento, igual que al subirlo desde la aplicación.
 *
 * Cuerpo: `{ nombre, contenido_base64, tipo_mime?, descripcion?, bucket?,
 * crear_factura?, usuario_email? }`
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

    return subirArchivoAMovimiento(admin, {
      movimientoId: id,
      archivo: {
        nombre: String(cuerpo.nombre ?? ""),
        contenido_base64: String(cuerpo.contenido_base64 ?? ""),
        tipo_mime: (cuerpo.tipo_mime as string) ?? null,
        descripcion: (cuerpo.descripcion as string) ?? null,
        bucket: (cuerpo.bucket as "facturas" | "documentos") ?? null,
      },
      crearFactura: cuerpo.crear_factura as boolean | undefined,
      actorId: actor.id,
      baseUrl,
    })
  })
}
