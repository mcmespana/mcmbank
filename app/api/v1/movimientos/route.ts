import { createAdminClient } from "@/lib/supabase/admin"
import { buscarMovimientos, type OrdenMovimientos } from "@/lib/api/movimientos-public"
import { resolveAmbitoDelegaciones } from "@/lib/api/delegaciones"
import { resolveCategorias, resolveCuentas } from "@/lib/api/catalogos"
import {
  conApi,
  qBooleano,
  qLista,
  qNumero,
  qOpcion,
  qTexto,
} from "@/lib/api/route-helpers"

export const runtime = "nodejs"

const ORDENES = ["fecha_desc", "fecha_asc", "importe_desc", "importe_asc"] as const

/**
 * GET /api/v1/movimientos
 *
 * Búsqueda de movimientos en una, varias o todas las delegaciones, con el
 * resumen económico del conjunto encontrado (no solo de la página).
 *
 * Ejemplo: todos los gastos de Mercadona por encima de 50 € en cualquier
 * delegación durante 2026:
 *
 *   /api/v1/movimientos?texto=mercadona&tipo=gasto&importe_min=50
 *     &fecha_desde=2026-01-01&fecha_hasta=2026-12-31
 *
 * Los importes se filtran por valor absoluto; `tipo` decide el signo.
 */
export async function GET(request: Request) {
  return conApi(request, "read", async ({ params, baseUrl }) => {
    const admin = createAdminClient()

    const delegaciones = await resolveAmbitoDelegaciones(admin, qLista(params, "delegaciones"))
    const categorias = await resolveCategorias(admin, qLista(params, "categorias"), delegaciones)
    const cuentas = await resolveCuentas(admin, qLista(params, "cuentas"), delegaciones)

    return buscarMovimientos(admin, {
      delegaciones,
      texto: qTexto(params, "texto"),
      tipo: qOpcion(params, "tipo", ["ingreso", "gasto"] as const),
      importeMin: qNumero(params, "importe_min"),
      importeMax: qNumero(params, "importe_max"),
      fechaDesde: qTexto(params, "fecha_desde"),
      fechaHasta: qTexto(params, "fecha_hasta"),
      categoriaIds: categorias?.map((c) => c.id) ?? null,
      sinCategoria: qBooleano(params, "sin_categoria"),
      cuentaIds: cuentas?.map((c) => c.id) ?? null,
      conFactura: qBooleano(params, "con_factura") ?? null,
      facturaPendiente: qBooleano(params, "factura_pendiente"),
      incluirIgnorados: qBooleano(params, "incluir_ignorados"),
      incluirCuentasInactivas: qBooleano(params, "incluir_cuentas_inactivas"),
      orden: qOpcion(params, "orden", ORDENES) as OrdenMovimientos | undefined,
      limite: qNumero(params, "limite"),
      offset: qNumero(params, "offset"),
      incluirArchivos: qBooleano(params, "incluir_archivos") ?? true,
      baseUrl,
    })
  })
}
