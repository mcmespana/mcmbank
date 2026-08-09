import { createAdminClient } from "@/lib/supabase/admin"
import {
  actualizarFactura,
  eliminarFactura,
  obtenerFactura,
  type FacturaEstadoApi,
} from "@/lib/api/facturas"
import { conApi, cuerpoJson } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/** GET /api/v1/facturas/{id} — factura con sus movimientos y archivos. */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "read", async ({ baseUrl }) => {
    const { id } = await params
    return { factura: await obtenerFactura(createAdminClient(), id, { baseUrl }) }
  })
}

/** PATCH /api/v1/facturas/{id} — corrige número, concepto, importe, fecha, estado… */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "write", async ({ baseUrl }) => {
    const { id } = await params
    const cuerpo = await cuerpoJson(request)
    const factura = await actualizarFactura(
      createAdminClient(),
      id,
      {
        numero: cuerpo.numero as string | null,
        concepto: cuerpo.concepto as string | null,
        importe: cuerpo.importe as number | null,
        fecha_emision: cuerpo.fecha_emision as string | null,
        estado: cuerpo.estado as FacturaEstadoApi | null,
        notas: cuerpo.notas as string | null,
        contacto_id: cuerpo.contacto_id as string | null,
      },
      { baseUrl },
    )
    return { factura }
  })
}

/**
 * DELETE /api/v1/facturas/{id}
 *
 * Borra la factura y sus archivos, y desvincula los movimientos que tuviera
 * (los movimientos no se tocan). Irreversible.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "write", async () => {
    const { id } = await params
    await eliminarFactura(createAdminClient(), id)
    return { eliminada: true, id }
  })
}
