import type { createAdminClient } from "@/lib/supabase/admin"
import { badRequest, notFound, unwrap, wrapSupabaseError } from "@/lib/api/errors"
import { obtenerMovimientosPorIds, type MovimientoPublico } from "@/lib/api/movimientos-public"
import { SUBVENCION_ESTADOS, esSubvencionEstado } from "@/lib/types/database"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Subvenciones para la API externa y el MCP (scripts/071). Solo lectura por
 * ahora: la ficha y qué movimientos tiene imputados. Imputar se hace desde la
 * pantalla, donde se ve lo que ya está en otra subvención antes de tocarlo.
 *
 * Una subvención no es de ninguna delegación, así que aquí no hay filtro de
 * delegaciones: sus movimientos pueden venir de varias, y cada uno lleva la
 * suya.
 */

export interface SubvencionPublica {
  id: string
  nombre: string
  financiador: string
  convocatoria: string | null
  expediente: string | null
  ejercicio: number | null
  estado: string
  fecha_solicitud: string | null
  importe_solicitado: number | null
  fecha_concesion: string | null
  importe_concedido: number | null
  periodo_desde: string | null
  periodo_hasta: string | null
  fecha_limite_justificacion: string | null
  notas: string | null
  resumen: {
    movimientos: number
    delegaciones: number
    /** En positivo: lo que se ha imputado como gasto. */
    total_gastos: number
    total_ingresos: number
  }
  creado_en: string
  actualizado_en: string
}

const num = (v: unknown) => (v == null ? null : Number(v))

function serializeSubvencion(fila: any, resumen: any | undefined): SubvencionPublica {
  return {
    id: fila.id,
    nombre: fila.nombre,
    financiador: fila.financiador,
    convocatoria: fila.convocatoria ?? null,
    expediente: fila.expediente ?? null,
    ejercicio: fila.ejercicio ?? null,
    estado: fila.estado,
    fecha_solicitud: fila.fecha_solicitud ?? null,
    importe_solicitado: num(fila.importe_solicitado),
    fecha_concesion: fila.fecha_concesion ?? null,
    importe_concedido: num(fila.importe_concedido),
    periodo_desde: fila.periodo_desde ?? null,
    periodo_hasta: fila.periodo_hasta ?? null,
    fecha_limite_justificacion: fila.fecha_limite_justificacion ?? null,
    notas: fila.notas ?? null,
    resumen: {
      movimientos: Number(resumen?.movimientos ?? 0),
      delegaciones: Number(resumen?.delegaciones ?? 0),
      total_gastos: Number(resumen?.total_gastos ?? 0),
      total_ingresos: Number(resumen?.total_ingresos ?? 0),
    },
    creado_en: fila.creado_en,
    actualizado_en: fila.actualizado_en,
  }
}

export interface ListarSubvencionesParams {
  estados?: string[] | null
  ejercicio?: number | null
  /** Texto libre sobre nombre, financiador, convocatoria y expediente. */
  texto?: string | null
}

export async function listarSubvenciones(
  admin: AdminClient,
  params: ListarSubvencionesParams = {},
): Promise<{ total: number; subvenciones: SubvencionPublica[] }> {
  const invalidos = (params.estados ?? []).filter((e) => !esSubvencionEstado(e))
  if (invalidos.length) {
    throw badRequest(`Estado de subvención desconocido: ${invalidos.join(", ")}.`, {
      estados_validos: SUBVENCION_ESTADOS,
    })
  }

  let query = (admin as any).from("subvencion").select("*").order("creado_en", { ascending: false })
  if (params.estados?.length) query = query.in("estado", params.estados)
  if (params.ejercicio) query = query.eq("ejercicio", params.ejercicio)

  const [{ data, error }, resumenes] = await Promise.all([
    query,
    (admin as any).from("subvencion_resumen").select("*"),
  ])
  if (error) throw wrapSupabaseError(error)
  if (resumenes.error) throw wrapSupabaseError(resumenes.error)

  const porId = new Map(((resumenes.data ?? []) as any[]).map((r) => [r.subvencion_id, r]))
  let filas = (data ?? []) as any[]

  const texto = params.texto?.trim().toLowerCase()
  if (texto) {
    filas = filas.filter((f) =>
      [f.nombre, f.financiador, f.convocatoria, f.expediente]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(texto)),
    )
  }

  return {
    total: filas.length,
    subvenciones: filas.map((f) => serializeSubvencion(f, porId.get(f.id))),
  }
}

/** Ids de los movimientos imputados, paginando por `movimiento_id` (único). */
async function idsDeMovimientos(admin: AdminClient, subvencionId: string): Promise<string[]> {
  const PAGINA = 1000
  const ids: string[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const data = unwrap(
      await (admin as any)
        .from("subvencion_movimiento")
        .select("movimiento_id")
        .eq("subvencion_id", subvencionId)
        .order("movimiento_id", { ascending: true })
        .range(desde, desde + PAGINA - 1),
    ) as { movimiento_id: string }[] | null
    ids.push(...(data ?? []).map((f) => f.movimiento_id))
    if (!data || data.length < PAGINA) break
  }
  return ids
}

export interface ObtenerSubvencionOpciones {
  /** Por defecto `true`. Con `false` solo vienen los ids. */
  incluirMovimientos?: boolean
  /** Por defecto `true`. Los archivos de cada movimiento (facturas, justificantes). */
  incluirArchivos?: boolean
  baseUrl?: string
}

export async function obtenerSubvencion(
  admin: AdminClient,
  id: string,
  options: ObtenerSubvencionOpciones = {},
): Promise<{ subvencion: SubvencionPublica; movimiento_ids: string[]; movimientos?: MovimientoPublico[] }> {
  if (!id?.trim()) throw badRequest("Falta el id de la subvención.")

  const fila = unwrap(await (admin as any).from("subvencion").select("*").eq("id", id).maybeSingle())
  if (!fila) throw notFound(`No existe ninguna subvención con el id ${id}.`)

  const [resumen, ids] = await Promise.all([
    (admin as any).from("subvencion_resumen").select("*").eq("subvencion_id", id).maybeSingle(),
    idsDeMovimientos(admin, id),
  ])
  if (resumen.error) throw wrapSupabaseError(resumen.error)

  const subvencion = serializeSubvencion(fila, resumen.data)
  if (options.incluirMovimientos === false) return { subvencion, movimiento_ids: ids }

  const movimientos = await obtenerMovimientosPorIds(admin, ids, {
    incluirArchivos: options.incluirArchivos,
    baseUrl: options.baseUrl,
  })
  movimientos.sort((a, b) => (a.fecha === b.fecha ? a.id.localeCompare(b.id) : a.fecha < b.fecha ? -1 : 1))
  return { subvencion, movimiento_ids: movimientos.map((m) => m.id), movimientos }
}
