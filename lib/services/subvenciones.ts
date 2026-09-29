import { supabase } from "@/lib/supabase/client"
import type {
  Subvencion,
  SubvencionConResumen,
  SubvencionInsert,
  SubvencionMovimiento,
  SubvencionResumen,
  SubvencionUpdate,
} from "@/lib/types/database"

/**
 * Subvenciones desde el navegador (scripts/071). Solo gestores centrales: la
 * RLS devuelve cero filas a cualquier otro, así que la pantalla tiene que
 * comprobar el rol antes para no enseñar "no hay subvenciones" a quien en
 * realidad no puede verlas.
 */

const db = supabase as any

/** PostgREST mete los `in (...)` en la URL: por encima de unos cientos de UUID, 414. */
const TROZO_IDS = 150
/** Límite de filas por respuesta de PostgREST. */
const PAGINA = 1000

function trozos<T>(lista: T[], tamano: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < lista.length; i += tamano) out.push(lista.slice(i, i + tamano))
  return out
}

const RESUMEN_VACIO = (id: string): SubvencionResumen => ({
  subvencion_id: id,
  movimientos: 0,
  delegaciones: 0,
  total_gastos: 0,
  total_ingresos: 0,
})

function normalizarResumen(fila: any): SubvencionResumen {
  return {
    subvencion_id: fila.subvencion_id,
    movimientos: Number(fila.movimientos ?? 0),
    delegaciones: Number(fila.delegaciones ?? 0),
    total_gastos: Number(fila.total_gastos ?? 0),
    total_ingresos: Number(fila.total_ingresos ?? 0),
  }
}

function normalizarSubvencion(fila: any): Subvencion {
  return {
    ...fila,
    importe_solicitado: fila.importe_solicitado == null ? null : Number(fila.importe_solicitado),
    importe_concedido: fila.importe_concedido == null ? null : Number(fila.importe_concedido),
  }
}

// ---------------------------------------------------------------------------
// Fichas
// ---------------------------------------------------------------------------

export async function listarSubvenciones(): Promise<SubvencionConResumen[]> {
  const [{ data, error }, { data: resumenes, error: errorResumen }] = await Promise.all([
    db.from("subvencion").select("*").order("creado_en", { ascending: false }),
    db.from("subvencion_resumen").select("*"),
  ])
  if (error) throw error
  if (errorResumen) throw errorResumen

  const porId = new Map<string, SubvencionResumen>(
    ((resumenes ?? []) as any[]).map((r) => [r.subvencion_id, normalizarResumen(r)]),
  )
  return ((data ?? []) as any[]).map((fila) => ({
    ...normalizarSubvencion(fila),
    resumen: porId.get(fila.id) ?? RESUMEN_VACIO(fila.id),
  }))
}

export async function obtenerSubvencion(id: string): Promise<SubvencionConResumen | null> {
  const [{ data, error }, { data: resumen, error: errorResumen }] = await Promise.all([
    db.from("subvencion").select("*").eq("id", id).maybeSingle(),
    db.from("subvencion_resumen").select("*").eq("subvencion_id", id).maybeSingle(),
  ])
  if (error) throw error
  if (errorResumen) throw errorResumen
  if (!data) return null
  return {
    ...normalizarSubvencion(data),
    resumen: resumen ? normalizarResumen(resumen) : RESUMEN_VACIO(id),
  }
}

export async function crearSubvencion(
  datos: Omit<SubvencionInsert, "id" | "creado_en" | "actualizado_en" | "creado_por">,
  usuarioId: string | null,
): Promise<Subvencion> {
  const { data, error } = await db
    .from("subvencion")
    .insert({ ...datos, creado_por: usuarioId })
    .select("*")
    .single()
  if (error) throw error
  return normalizarSubvencion(data)
}

export async function actualizarSubvencion(id: string, cambios: SubvencionUpdate): Promise<Subvencion> {
  const { id: _id, creado_en: _c, creado_por: _p, actualizado_en: _a, ...limpio } = cambios
  const { data, error } = await db.from("subvencion").update(limpio).eq("id", id).select("*").single()
  if (error) throw error
  return normalizarSubvencion(data)
}

export interface SubvencionBorrada {
  ficha: Subvencion
  imputaciones: SubvencionMovimiento[]
}

/**
 * Borra la ficha. Los movimientos quedan libres (la imputación cae en
 * cascada), no se borran. Devuelve lo borrado para poder deshacerlo con
 * `restaurarSubvencion()`, igual que el borrado en lote de movimientos.
 */
export async function eliminarSubvencion(id: string): Promise<SubvencionBorrada> {
  const { data: ficha, error: errorFicha } = await db.from("subvencion").select("*").eq("id", id).single()
  if (errorFicha) throw errorFicha

  const imputaciones: SubvencionMovimiento[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await db
      .from("subvencion_movimiento")
      .select("*")
      .eq("subvencion_id", id)
      .order("movimiento_id", { ascending: true })
      .range(desde, desde + PAGINA - 1)
    if (error) throw error
    imputaciones.push(...((data ?? []) as SubvencionMovimiento[]))
    if (!data || data.length < PAGINA) break
  }

  const { error } = await db.from("subvencion").delete().eq("id", id)
  if (error) throw error
  return { ficha: ficha as Subvencion, imputaciones }
}

/**
 * Vuelve a crear una subvención borrada, con su id, y sus imputaciones. Si
 * mientras tanto alguien ha imputado uno de esos movimientos a otra, el UNIQUE
 * lo impide y el error lo dice: no se le quita a la otra en silencio.
 */
export async function restaurarSubvencion(borrada: SubvencionBorrada): Promise<void> {
  const { error } = await db.from("subvencion").insert(borrada.ficha)
  if (error) throw error
  await restaurarImputaciones(borrada.imputaciones)
}

// ---------------------------------------------------------------------------
// Movimientos imputados
// ---------------------------------------------------------------------------

export interface MovimientoDeSubvencion {
  id: string
  fecha: string
  concepto: string
  descripcion: string | null
  importe: number
  delegacion_id: string
  delegacion: { id: string; nombre: string; codigo: string | null } | null
  cuenta: { id: string; nombre: string; color: string | null } | null
  categoria: { id: string; nombre: string; emoji: string | null; color: string | null } | null
  contacto: { id: string; nombre: string; logo_url: string | null } | null
  factura_id: string | null
  factura_pendiente: boolean
  archivos: number
  /** Datos de la imputación. */
  asignado_en: string
  asignado_por: string | null
  notas_imputacion: string | null
}

// `movimiento` tiene dos FK hacia `cuenta`: sin el hint, PostgREST no sabe cuál
// usar (ver lib/api/movimientos-public.ts).
const MOVIMIENTO_EMBEBIDO = `
  movimiento_id,
  asignado_en,
  asignado_por,
  notas,
  movimiento:movimiento_id (
    id,
    fecha,
    concepto,
    descripcion,
    importe,
    delegacion_id,
    factura_id,
    factura_pendiente,
    cuenta:cuenta!movimiento_cuenta_id_fkey ( id, nombre, color ),
    categoria:categoria_id ( id, nombre, emoji, color ),
    contacto:contacto_id ( id, nombre, logo_url ),
    archivos:movimiento_archivo ( count )
  )
`

const uno = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null))

/**
 * Todos los movimientos de una subvención, de cualquier delegación, por fecha.
 * Pagina de mil en mil ordenando por `movimiento_id` (único), para que las
 * páginas no se solapen.
 */
export async function listarMovimientosDeSubvencion(subvencionId: string): Promise<MovimientoDeSubvencion[]> {
  const filas: any[] = []
  for (let desde = 0; ; desde += PAGINA) {
    const { data, error } = await db
      .from("subvencion_movimiento")
      .select(MOVIMIENTO_EMBEBIDO)
      .eq("subvencion_id", subvencionId)
      .order("movimiento_id", { ascending: true })
      .range(desde, desde + PAGINA - 1)
    if (error) throw error
    filas.push(...(data ?? []))
    if (!data || data.length < PAGINA) break
  }

  // La delegación no se puede embeber (no hay FK directa movimiento → delegación).
  const delegacionIds = [
    ...new Set(filas.map((f) => uno(f.movimiento)?.delegacion_id).filter(Boolean) as string[]),
  ]
  const delegaciones = new Map<string, { id: string; nombre: string; codigo: string | null }>()
  if (delegacionIds.length) {
    const { data, error } = await db.from("delegacion").select("id, nombre, codigo").in("id", delegacionIds)
    if (error) throw error
    for (const d of (data ?? []) as any[]) delegaciones.set(d.id, d)
  }

  return filas
    .map((f): MovimientoDeSubvencion | null => {
      const m = uno(f.movimiento) as any
      // Un movimiento que la RLS no deja ver al usuario llega como null.
      if (!m) return null
      return {
        id: m.id,
        fecha: m.fecha,
        concepto: m.concepto,
        descripcion: m.descripcion ?? null,
        importe: Number(m.importe),
        delegacion_id: m.delegacion_id,
        delegacion: delegaciones.get(m.delegacion_id) ?? null,
        cuenta: uno(m.cuenta),
        categoria: uno(m.categoria),
        contacto: uno(m.contacto),
        factura_id: m.factura_id ?? null,
        factura_pendiente: !!m.factura_pendiente,
        archivos: Number(uno<any>(m.archivos)?.count ?? 0),
        asignado_en: f.asignado_en,
        asignado_por: f.asignado_por ?? null,
        notas_imputacion: f.notas ?? null,
      }
    })
    .filter((m): m is MovimientoDeSubvencion => m !== null)
    .sort((a, b) => (a.fecha === b.fecha ? a.id.localeCompare(b.id) : a.fecha < b.fecha ? 1 : -1))
}

/** Dónde está imputado cada uno de estos movimientos (los libres no aparecen). */
export async function imputacionesDeMovimientos(
  movimientoIds: string[],
): Promise<Pick<SubvencionMovimiento, "movimiento_id" | "subvencion_id">[]> {
  const unicos = [...new Set(movimientoIds)]
  const out: Pick<SubvencionMovimiento, "movimiento_id" | "subvencion_id">[] = []
  for (const trozo of trozos(unicos, TROZO_IDS)) {
    const { data, error } = await db
      .from("subvencion_movimiento")
      .select("movimiento_id, subvencion_id")
      .in("movimiento_id", trozo)
    if (error) throw error
    out.push(...((data ?? []) as any[]))
  }
  return out
}

/**
 * Imputa movimientos a una subvención. Es un `insert`, no un `upsert`: si otro
 * gestor acaba de imputar uno de ellos a otra subvención, el UNIQUE salta y se
 * enseña el error en vez de pisar su decisión. Filtra antes con
 * `repartirAsignacion()` para no chocar con lo que ya se sabe.
 */
export async function imputarMovimientos(
  subvencionId: string,
  movimientoIds: string[],
  usuarioId: string | null,
  onProgreso?: (hechos: number, total: number) => void,
): Promise<void> {
  const total = movimientoIds.length
  let hechos = 0
  for (const trozo of trozos(movimientoIds, TROZO_IDS)) {
    const { error } = await db.from("subvencion_movimiento").insert(
      trozo.map((movimiento_id) => ({
        subvencion_id: subvencionId,
        movimiento_id,
        asignado_por: usuarioId,
      })),
    )
    if (error) throw error
    hechos += trozo.length
    onProgreso?.(hechos, total)
  }
}

/**
 * Quita movimientos de una subvención y devuelve las filas quitadas, para que
 * `restaurarImputaciones()` pueda deshacerlo con su autor y fecha originales.
 */
export async function quitarMovimientos(
  subvencionId: string,
  movimientoIds: string[],
): Promise<SubvencionMovimiento[]> {
  const quitadas: SubvencionMovimiento[] = []
  for (const trozo of trozos([...new Set(movimientoIds)], TROZO_IDS)) {
    const { data, error } = await db
      .from("subvencion_movimiento")
      .delete()
      .eq("subvencion_id", subvencionId)
      .in("movimiento_id", trozo)
      .select("*")
    if (error) throw error
    quitadas.push(...((data ?? []) as SubvencionMovimiento[]))
  }
  return quitadas
}

export async function restaurarImputaciones(filas: SubvencionMovimiento[]): Promise<void> {
  for (const trozo of trozos(filas, TROZO_IDS)) {
    const { error } = await db.from("subvencion_movimiento").insert(trozo)
    if (error) throw error
  }
}

/** La subvención en la que está imputado un movimiento, o null si está libre. */
export async function subvencionDeMovimiento(
  movimientoId: string,
): Promise<Pick<Subvencion, "id" | "nombre" | "financiador" | "estado"> | null> {
  const { data, error } = await db
    .from("subvencion_movimiento")
    .select("subvencion:subvencion_id ( id, nombre, financiador, estado )")
    .eq("movimiento_id", movimientoId)
    .maybeSingle()
  if (error) throw error
  return uno((data as any)?.subvencion) ?? null
}
