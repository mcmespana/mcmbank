import { createAdminClient } from "@/lib/supabase/admin"
import { actualizarPagoMcm, obtenerPagoMcm } from "@/lib/api/pagos"
import { conApi, cuerpoJson } from "@/lib/api/route-helpers"

export const runtime = "nodejs"

/** GET /api/v1/pagos-mcm/{id} */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "read", async () => {
    const { id } = await params
    return { pago: await obtenerPagoMcm(createAdminClient(), id) }
  })
}

/**
 * PATCH /api/v1/pagos-mcm/{id}
 *
 * Corrige un pago manual (concepto, importe, contacto, notas, categoría
 * sugerida) o lo cancela. Solo pagos `tipo_calculo: 'manual'`; los de
 * gasolina se editan desde la aplicación. No marca 'pagado': eso lo hace
 * vincularlo con un movimiento, desde la aplicación.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return conApi(request, "write", async () => {
    const { id } = await params
    const cuerpo = await cuerpoJson(request)
    const pago = await actualizarPagoMcm(createAdminClient(), id, {
      contacto_id: cuerpo.contacto_id as string | null,
      concepto: cuerpo.concepto as string | null,
      descripcion: cuerpo.descripcion as string | null,
      importe: cuerpo.importe as number | null,
      estado: cuerpo.estado as "borrador" | "pendiente" | "cancelado" | null,
      categoria_id_sugerida: cuerpo.categoria_id_sugerida as string | null,
      notas: cuerpo.notas as string | null,
    })
    return { pago }
  })
}
