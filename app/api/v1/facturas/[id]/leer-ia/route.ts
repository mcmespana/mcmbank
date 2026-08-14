import { createAdminClient } from "@/lib/supabase/admin"
import { resolveActor } from "@/lib/api/actor"
import { extraerDatosFactura } from "@/lib/api/factura-ia"
import { conApi, cuerpoJson } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/**
 * POST /api/v1/facturas/{id}/leer-ia
 *
 * Lee el documento de la factura con IA y guarda lo que saque en `datos_ia`:
 * proveedor (creándolo si no existe), número, fecha, importe, concepto y una
 * **sugerencia** de categoría que hay que aceptar aparte
 * (`POST /api/v1/facturas/{id}/categoria`).
 *
 * Los campos de la factura que ya tuvieran valor no se tocan. Si la factura ya
 * se leyó antes, no se vuelve a gastar una llamada salvo `{"forzar": true}`.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "write", async ({ baseUrl, actorHint }) => {
    const { id } = await params
    const cuerpo = await cuerpoJson(request).catch(() => ({}) as Record<string, unknown>)

    const admin = createAdminClient()
    const actor = await resolveActor(admin, {
      usuario_id: (cuerpo.usuario_id as string) ?? actorHint.usuario_id,
      usuario_email: (cuerpo.usuario_email as string) ?? actorHint.usuario_email,
    })

    const { factura, datos } = await extraerDatosFactura(admin, id, {
      actorId: actor.id,
      forzar: cuerpo.forzar === true,
      crearProveedor: cuerpo.crear_proveedor !== false,
      baseUrl,
    })

    return { factura, datos_ia: datos }
  })
}
