import type { createAdminClient } from "@/lib/supabase/admin"
import { badRequest, notFound, unwrap, wrapSupabaseError } from "@/lib/api/errors"
import { obtenerMovimientosPorIds, type MovimientoPublico } from "@/lib/api/movimientos-public"
import { SUBVENCION_ESTADOS, esSubvencionEstado } from "@/lib/types/database"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Subvenciones para la API externa y el MCP (scripts/071, 072): leer la ficha
 * y sus movimientos, e imputar o quitar movimientos.
 *
 * Una subvención no es de ninguna delegación, así que aquí no hay filtro de
 * delegaciones: sus movimientos pueden venir de varias, y cada uno lleva la
 * suya. Un movimiento puede repartirse entre varias subvenciones; la regla de
 * no pasar del 100 % la hace cumplir la base de datos (trigger de 072), así
 * que aquí solo se traduce su mensaje por movimiento.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const MAX_POR_LLAMADA = 200

export interface SubvencionPublica {
  id: string
  codigo: string | null
  nombre: string
  financiador: { id: string; nombre: string; ambito: string } | null
  solicitante: string | null
  ejercicio: number | null
  estado: string
  importe_solicitado: number | null
  importe_concedido: number | null
  importe_cobrado: number | null
  fecha_convocatoria: string | null
  fecha_limite_solicitud: string | null
  fecha_solicitud: string | null
  fecha_concesion: string | null
  fecha_justificacion_1: string | null
  fecha_justificacion_2: string | null
  periodo_desde: string | null
  periodo_hasta: string | null
  justificacion_completa: boolean
  recurrente: boolean
  convocatoria: string | null
  expediente: string | null
  url_carpeta: string | null
  enlaces: { nombre: string; url: string }[]
  notas: string | null
  resumen: {
    movimientos: number
    delegaciones: number
    /** En positivo: la suma de lo imputado como gasto. */
    total_gastos: number
    total_ingresos: number
    movimientos_parciales: number
  }
  creado_en: string
  actualizado_en: string
}

/** Un movimiento de la subvención, con la parte que se le imputa. */
export type MovimientoDeSubvencionPublico = MovimientoPublico & { importe_imputado: number }

const SELECT = "*, financiador:financiador_id ( id, nombre, ambito )"
const num = (v: unknown) => (v == null ? null : Number(v))
const uno = (v: any) => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

function serializeSubvencion(fila: any, resumen: any | undefined): SubvencionPublica {
  const f = uno(fila.financiador)
  return {
    id: fila.id,
    codigo: fila.codigo ?? null,
    nombre: fila.nombre,
    financiador: f ? { id: f.id, nombre: f.nombre, ambito: f.ambito } : null,
    solicitante: fila.solicitante ?? null,
    ejercicio: fila.ejercicio ?? null,
    estado: fila.estado,
    importe_solicitado: num(fila.importe_solicitado),
    importe_concedido: num(fila.importe_concedido),
    importe_cobrado: num(fila.importe_cobrado),
    fecha_convocatoria: fila.fecha_convocatoria ?? null,
    fecha_limite_solicitud: fila.fecha_limite_solicitud ?? null,
    fecha_solicitud: fila.fecha_solicitud ?? null,
    fecha_concesion: fila.fecha_concesion ?? null,
    fecha_justificacion_1: fila.fecha_justificacion_1 ?? null,
    fecha_justificacion_2: fila.fecha_justificacion_2 ?? null,
    periodo_desde: fila.periodo_desde ?? null,
    periodo_hasta: fila.periodo_hasta ?? null,
    justificacion_completa: !!fila.justificacion_completa,
    recurrente: !!fila.recurrente,
    convocatoria: fila.convocatoria ?? null,
    expediente: fila.expediente ?? null,
    url_carpeta: fila.url_carpeta ?? null,
    enlaces: Array.isArray(fila.enlaces) ? fila.enlaces : [],
    notas: fila.notas ?? null,
    resumen: {
      movimientos: Number(resumen?.movimientos ?? 0),
      delegaciones: Number(resumen?.delegaciones ?? 0),
      total_gastos: Number(resumen?.total_gastos ?? 0),
      total_ingresos: Number(resumen?.total_ingresos ?? 0),
      movimientos_parciales: Number(resumen?.movimientos_parciales ?? 0),
    },
    creado_en: fila.creado_en,
    actualizado_en: fila.actualizado_en,
  }
}

export interface ListarSubvencionesParams {
  estados?: string[] | null
  ejercicio?: number | null
  /** Texto libre sobre código, nombre, financiador, convocatoria y expediente. */
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

  let query = (admin as any).from("subvencion").select(SELECT).order("creado_en", { ascending: false })
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
      [f.codigo, f.nombre, uno(f.financiador)?.nombre, f.convocatoria, f.expediente]
        .filter(Boolean)
        .some((v: string) => v.toLowerCase().includes(texto)),
    )
  }

  return {
    total: filas.length,
    subvenciones: filas.map((f) => serializeSubvencion(f, porId.get(f.id))),
  }
}

/** Imputaciones de la subvención, paginando por `movimiento_id` (único dentro de ella). */
async function imputacionesDe(admin: AdminClient, subvencionId: string) {
  const PAGINA = 1000
  const filas: { movimiento_id: string; importe_imputado: number }[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const data = unwrap(
      await (admin as any)
        .from("subvencion_movimiento")
        .select("movimiento_id, importe_imputado")
        .eq("subvencion_id", subvencionId)
        .order("movimiento_id", { ascending: true })
        .range(desde, desde + PAGINA - 1),
    ) as any[] | null
    filas.push(...(data ?? []).map((f) => ({ movimiento_id: f.movimiento_id, importe_imputado: Number(f.importe_imputado) })))
    if (!data || data.length < PAGINA) break
  }
  return filas
}

async function fichaORechazo(admin: AdminClient, id: string) {
  if (!id?.trim()) throw badRequest("Falta el id de la subvención.")
  if (!UUID_RE.test(id)) {
    throw badRequest(`'${id}' no es un id de subvención. Búscala con listar_subvenciones (GET /api/v1/subvenciones).`)
  }
  const fila = unwrap(await (admin as any).from("subvencion").select(SELECT).eq("id", id).maybeSingle())
  if (!fila) throw notFound(`No existe ninguna subvención con el id ${id}.`)
  return fila
}

export interface ObtenerSubvencionOpciones {
  /** Por defecto `true`. Con `false` solo vienen los ids y las partes. */
  incluirMovimientos?: boolean
  /** Por defecto `true`. Los archivos de cada movimiento (facturas, justificantes). */
  incluirArchivos?: boolean
  baseUrl?: string
}

export async function obtenerSubvencion(
  admin: AdminClient,
  id: string,
  options: ObtenerSubvencionOpciones = {},
): Promise<{
  subvencion: SubvencionPublica
  movimiento_ids: string[]
  imputaciones: { movimiento_id: string; importe_imputado: number }[]
  movimientos?: MovimientoDeSubvencionPublico[]
}> {
  const fila = await fichaORechazo(admin, id)

  const [resumen, imputaciones] = await Promise.all([
    (admin as any).from("subvencion_resumen").select("*").eq("subvencion_id", id).maybeSingle(),
    imputacionesDe(admin, id),
  ])
  if (resumen.error) throw wrapSupabaseError(resumen.error)

  const subvencion = serializeSubvencion(fila, resumen.data)
  const ids = imputaciones.map((i) => i.movimiento_id)
  if (options.incluirMovimientos === false) return { subvencion, movimiento_ids: ids, imputaciones }

  const parte = new Map(imputaciones.map((i) => [i.movimiento_id, i.importe_imputado]))
  const movimientos = (
    await obtenerMovimientosPorIds(admin, ids, { incluirArchivos: options.incluirArchivos, baseUrl: options.baseUrl })
  ).map((m) => ({ ...m, importe_imputado: parte.get(m.id) ?? Math.abs(m.importe) }))
  movimientos.sort((a, b) => (a.fecha === b.fecha ? a.id.localeCompare(b.id) : a.fecha < b.fecha ? -1 : 1))
  return { subvencion, movimiento_ids: movimientos.map((m) => m.id), imputaciones, movimientos }
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

export interface ImputarItem {
  /** Id del movimiento. */
  id: string
  /** Euros a imputar, en positivo. Si no viene ni esto ni `porcentaje`: todo lo que quede libre. */
  importe?: number | null
  /** Porcentaje (0–100] del importe del movimiento. */
  porcentaje?: number | null
}

export interface ResultadoImputar {
  imputados: { movimiento_id: string; importe_imputado: number; accion: "creado" | "actualizado" }[]
  errores: { movimiento_id: string; error: string }[]
}

/**
 * Imputa movimientos a una subvención. Uno a uno, para que si alguno no cabe
 * (ya está entero en otra) el resto entre igual y el error diga cuál y por qué.
 * Si el movimiento ya estaba en esta subvención y llega importe o porcentaje,
 * se cambia su parte; si llega sin nada, se deja como está.
 */
export async function imputarMovimientosSubvencion(
  admin: AdminClient,
  subvencionId: string,
  items: ImputarItem[],
  actorId: string,
): Promise<ResultadoImputar> {
  await fichaORechazo(admin, subvencionId)
  if (!items.length) throw badRequest("No ha llegado ningún movimiento. Envía 'movimientos': [{ id, importe? | porcentaje? }].")
  if (items.length > MAX_POR_LLAMADA) {
    throw badRequest(`Como mucho ${MAX_POR_LLAMADA} movimientos por llamada (han llegado ${items.length}). Pártelos en varias.`)
  }

  const ids = [...new Set(items.map((i) => String(i.id ?? "").trim()))]
  const malos = ids.filter((i) => !UUID_RE.test(i))
  if (malos.length) throw badRequest(`Estos ids de movimiento no son válidos: ${malos.slice(0, 10).join(", ")}.`)

  const movs = unwrap(await (admin as any).from("movimiento").select("id, importe").in("id", ids)) as any[] | null
  const importePorId = new Map((movs ?? []).map((m) => [m.id, Number(m.importe)]))
  const actuales = unwrap(
    await (admin as any)
      .from("subvencion_movimiento")
      .select("movimiento_id")
      .eq("subvencion_id", subvencionId)
      .in("movimiento_id", ids),
  ) as any[] | null
  const yaEstan = new Set((actuales ?? []).map((a) => a.movimiento_id))

  const resultado: ResultadoImputar = { imputados: [], errores: [] }
  const vistos = new Set<string>()

  for (const item of items) {
    const id = String(item.id).trim()
    if (vistos.has(id)) continue
    vistos.add(id)
    const total = importePorId.get(id)
    if (total == null) {
      resultado.errores.push({ movimiento_id: id, error: "No existe ningún movimiento con este id." })
      continue
    }

    let importe: number | null = null
    if (item.porcentaje != null) {
      const p = Number(item.porcentaje)
      if (!(p > 0 && p <= 100)) {
        resultado.errores.push({ movimiento_id: id, error: `El porcentaje tiene que estar entre 0 y 100 (ha llegado ${item.porcentaje}).` })
        continue
      }
      importe = Math.round(Math.abs(total) * p) / 100
    } else if (item.importe != null) {
      importe = Math.round(Math.abs(Number(item.importe)) * 100) / 100
    }

    const res = yaEstan.has(id)
      ? importe == null
        ? null
        : await (admin as any)
            .from("subvencion_movimiento")
            .update({ importe_imputado: importe })
            .eq("subvencion_id", subvencionId)
            .eq("movimiento_id", id)
            .select("importe_imputado")
            .single()
      : await (admin as any)
          .from("subvencion_movimiento")
          .insert({ subvencion_id: subvencionId, movimiento_id: id, importe_imputado: importe, asignado_por: actorId })
          .select("importe_imputado")
          .single()

    if (res === null) {
      resultado.errores.push({ movimiento_id: id, error: "Ya estaba en esta subvención. Para cambiar su parte, envía 'importe' o 'porcentaje'." })
    } else if (res.error) {
      resultado.errores.push({ movimiento_id: id, error: wrapSupabaseError(res.error).message })
    } else {
      resultado.imputados.push({
        movimiento_id: id,
        importe_imputado: Number(res.data.importe_imputado),
        accion: yaEstan.has(id) ? "actualizado" : "creado",
      })
    }
  }
  return resultado
}

/** Quita movimientos de una subvención. No toca los movimientos ni sus otras imputaciones. */
export async function quitarMovimientosSubvencion(
  admin: AdminClient,
  subvencionId: string,
  movimientoIds: string[],
): Promise<{ quitados: string[] }> {
  await fichaORechazo(admin, subvencionId)
  const ids = [...new Set(movimientoIds.map((i) => String(i).trim()).filter(Boolean))]
  if (!ids.length) throw badRequest("No ha llegado ningún movimiento. Envía 'movimiento_ids': [...].")
  if (ids.length > MAX_POR_LLAMADA) throw badRequest(`Como mucho ${MAX_POR_LLAMADA} movimientos por llamada.`)
  const data = unwrap(
    await (admin as any)
      .from("subvencion_movimiento")
      .delete()
      .eq("subvencion_id", subvencionId)
      .in("movimiento_id", ids)
      .select("movimiento_id"),
  ) as any[] | null
  return { quitados: (data ?? []).map((d) => d.movimiento_id) }
}
