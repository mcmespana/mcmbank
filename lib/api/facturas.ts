import type { createAdminClient } from "@/lib/supabase/admin"
import { badRequest, conflict, notFound, unwrap, wrapSupabaseError } from "@/lib/api/errors"
import {
  resolveAmbitoDelegaciones,
  resolveDelegacion,
  mapaDelegaciones,
  type DelegacionPublica,
} from "@/lib/api/delegaciones"
import { cargarCatalogos } from "@/lib/api/catalogos"
import { aplicarBusquedaTexto } from "@/lib/api/postgrest"
import {
  archivosDeFacturas,
  listarArchivosFactura,
  replicarArchivoEnMovimiento,
  subirArchivoAFactura,
  type ArchivoEntrante,
} from "@/lib/api/archivos"
import type { ArchivoPublico } from "@/lib/api/movimientos-public"
import { margenImporteFactura, scoreCandidatoMovimiento } from "@/lib/utils/facturas-matching"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Facturas: bandeja de entrada y conciliación con movimientos bancarios.
 *
 * Es la parte con más reglas de negocio de la API, porque una factura puede
 * pagarse en varios plazos: el vínculo vive en `movimiento.factura_id` (varios
 * movimientos → una factura) y el estado de la factura lo recalcula un trigger
 * comparando su importe con la suma de lo vinculado. Aquí nunca se escribe
 * `estado` a mano en las operaciones de vínculo: se deja que mande la realidad.
 */

export const FACTURA_ESTADOS = [
  "bandeja",
  "sin_pagar",
  "pagada_parcial",
  "pagada",
  "pagada_fuera",
] as const
export type FacturaEstadoApi = (typeof FACTURA_ESTADOS)[number]

const FACTURA_SELECT = `
  *,
  contacto:contacto_id (
    id,
    nombre,
    tipo,
    emoji,
    color,
    email,
    identificador_fiscal
  ),
  movimientos:movimiento (
    id,
    fecha,
    concepto,
    importe,
    cuenta_id,
    delegacion_id
  )
`

export interface FacturaPublica {
  id: string
  numero: string | null
  concepto: string | null
  importe: number | null
  moneda: string
  fecha_emision: string | null
  estado: string
  origen: string
  notas: string | null
  email_remitente: string | null
  delegacion: DelegacionPublica | null
  contacto: {
    id: string
    nombre: string
    tipo: string | null
    email: string | null
    identificador_fiscal: string | null
  } | null
  /** Suma (en valor absoluto) de los movimientos ya vinculados. */
  importe_pagado: number
  /** Lo que falta por cubrir; `null` si la factura no tiene importe. */
  importe_pendiente: number | null
  movimientos: {
    id: string
    fecha: string
    concepto: string
    importe: number
  }[]
  archivos: ArchivoPublico[]
  creado_en: string
  actualizado_en: string
}

function redondear(n: number): number {
  return Math.round(n * 100) / 100
}

export function serializeFactura(
  row: any,
  archivos: ArchivoPublico[],
  delegaciones: Map<string, DelegacionPublica>,
): FacturaPublica {
  const movimientos = ((row.movimientos ?? []) as any[]).map((m) => ({
    id: m.id,
    fecha: m.fecha,
    concepto: m.concepto,
    importe: Number(m.importe),
  }))
  const pagado = movimientos.reduce((sum, m) => sum + Math.abs(m.importe), 0)
  const importe = row.importe == null ? null : Number(row.importe)

  return {
    id: row.id,
    numero: row.numero ?? null,
    concepto: row.concepto ?? null,
    importe,
    moneda: row.moneda ?? "EUR",
    fecha_emision: row.fecha_emision ?? null,
    estado: row.estado,
    origen: row.origen,
    notas: row.notas ?? null,
    email_remitente: row.email_remitente ?? null,
    delegacion: row.delegacion_id ? delegaciones.get(row.delegacion_id) ?? null : null,
    contacto: row.contacto
      ? {
          id: row.contacto.id,
          nombre: row.contacto.nombre,
          tipo: row.contacto.tipo ?? null,
          email: row.contacto.email ?? null,
          identificador_fiscal: row.contacto.identificador_fiscal ?? null,
        }
      : null,
    importe_pagado: redondear(pagado),
    importe_pendiente: importe == null ? null : redondear(Math.max(importe - pagado, 0)),
    movimientos,
    archivos,
    creado_en: row.creado_en,
    actualizado_en: row.actualizado_en,
  }
}

// ---------------------------------------------------------------------------
// Consulta
// ---------------------------------------------------------------------------

export interface BuscarFacturasParams {
  delegaciones?: string | string[] | null
  estados?: string[] | null
  texto?: string | null
  numero?: string | null
  importeMin?: number | null
  importeMax?: number | null
  fechaDesde?: string | null
  fechaHasta?: string | null
  contactoIds?: string[] | null
  /** `true` = solo facturas sin ningún movimiento vinculado (sin conciliar). */
  sinConciliar?: boolean
  limite?: number
  offset?: number
  baseUrl?: string
}

export interface BuscarFacturasResultado {
  total: number
  limite: number
  offset: number
  hay_mas: boolean
  facturas: FacturaPublica[]
}

export async function buscarFacturas(
  admin: AdminClient,
  params: BuscarFacturasParams,
): Promise<BuscarFacturasResultado> {
  const limite = Math.min(Math.max(params.limite ?? 50, 1), 200)
  const offset = Math.max(params.offset ?? 0, 0)

  const ambito = await resolveAmbitoDelegaciones(admin, params.delegaciones)

  if (params.estados?.length) {
    const invalidos = params.estados.filter((e) => !FACTURA_ESTADOS.includes(e as FacturaEstadoApi))
    if (invalidos.length > 0) {
      throw badRequest(`Estado de factura no válido: ${invalidos.join(", ")}.`, {
        estados_validos: FACTURA_ESTADOS,
      })
    }
  }

  let query = (admin as any).from("factura").select(FACTURA_SELECT, { count: "exact" })

  if (params.sinConciliar) {
    // "Sin conciliar" no se puede expresar como un filtro sobre `factura`
    // (el vínculo vive en `movimiento.factura_id`), así que se excluyen por id
    // las que sí tienen movimientos. Tiene que ser parte de la consulta y no un
    // filtro posterior: si no, `total` mentiría y las páginas saldrían cojas.
    const excluidas = await facturasConMovimiento(admin, ambito)
    if (excluidas.length > 0) {
      query = query.not("id", "in", `(${excluidas.join(",")})`)
    }
  }

  if (ambito) query = query.in("delegacion_id", ambito.map((d) => d.id))
  if (params.estados?.length) query = query.in("estado", params.estados)
  if (params.numero) query = query.ilike("numero", `%${params.numero}%`)
  if (params.importeMin != null) query = query.gte("importe", Math.abs(params.importeMin))
  if (params.importeMax != null) query = query.lte("importe", Math.abs(params.importeMax))
  if (params.fechaDesde) query = query.gte("fecha_emision", params.fechaDesde)
  if (params.fechaHasta) query = query.lte("fecha_emision", params.fechaHasta)
  if (params.contactoIds?.length) query = query.in("contacto_id", params.contactoIds)
  query = aplicarBusquedaTexto(query, params.texto, ["concepto", "numero", "notas"])

  query = query
    .order("fecha_emision", { ascending: false, nullsFirst: false })
    .order("creado_en", { ascending: false })
    .range(offset, offset + limite - 1)

  const { data, count, error } = await query
  if (error) throw wrapSupabaseError(error)

  const filas = (data ?? []) as any[]
  const delegaciones = await mapaDelegaciones(admin)
  const archivos = await archivosDeFacturas(admin, filas.map((f) => f.id), {
    baseUrl: params.baseUrl,
  })

  const total = count ?? filas.length
  return {
    total,
    limite,
    offset,
    hay_mas: offset + filas.length < total,
    facturas: filas.map((f) => serializeFactura(f, archivos.get(f.id) ?? [], delegaciones)),
  }
}

/** Ids de las facturas que ya tienen al menos un movimiento vinculado. */
async function facturasConMovimiento(
  admin: AdminClient,
  ambito: DelegacionPublica[] | null,
): Promise<string[]> {
  let query = (admin as any)
    .from("movimiento")
    .select("factura_id")
    .not("factura_id", "is", null)
    .limit(5000)
  if (ambito) query = query.in("delegacion_id", ambito.map((d) => d.id))

  const filas = (unwrap(await query) ?? []) as { factura_id: string }[]
  return [...new Set(filas.map((f) => f.factura_id))]
}

export async function obtenerFactura(
  admin: AdminClient,
  id: string,
  options: { baseUrl?: string } = {},
): Promise<FacturaPublica> {
  const fila = unwrap(
    await (admin as any).from("factura").select(FACTURA_SELECT).eq("id", id).maybeSingle(),
  ) as any
  if (!fila) throw notFound(`No existe ninguna factura con el id ${id}.`)

  const delegaciones = await mapaDelegaciones(admin)
  const archivos = await listarArchivosFactura(admin, id, { baseUrl: options.baseUrl })
  return serializeFactura(fila, archivos, delegaciones)
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

export interface CrearFacturaParams {
  delegacion: string
  numero?: string | null
  concepto?: string | null
  importe?: number | null
  fecha_emision?: string | null
  moneda?: string | null
  estado?: FacturaEstadoApi | null
  notas?: string | null
  contacto_id?: string | null
  /** Archivo de la factura, si se sube en la misma llamada. */
  archivo?: ArchivoEntrante | null
  /** Movimiento con el que conciliarla inmediatamente. */
  movimiento_id?: string | null
}

export async function crearFactura(
  admin: AdminClient,
  params: CrearFacturaParams,
  actorId: string,
  options: { baseUrl?: string } = {},
): Promise<FacturaPublica> {
  const delegacion = await resolveDelegacion(admin, params.delegacion)

  if (params.importe != null && Number(params.importe) <= 0) {
    throw badRequest("El importe de una factura debe ser positivo (es el importe facturado, sin signo).")
  }
  if (params.estado && !FACTURA_ESTADOS.includes(params.estado)) {
    throw badRequest(`Estado '${params.estado}' no válido.`, { estados_validos: FACTURA_ESTADOS })
  }

  const creada = unwrap(
    await (admin as any)
      .from("factura")
      .insert({
        delegacion_id: delegacion.id,
        numero: params.numero?.trim() || null,
        concepto: params.concepto?.trim() || null,
        importe: params.importe == null ? null : Math.abs(Number(params.importe)),
        fecha_emision: params.fecha_emision || null,
        moneda: params.moneda?.trim() || "EUR",
        estado: params.estado || "bandeja",
        notas: params.notas?.trim() || null,
        contacto_id: params.contacto_id || null,
        origen: "subida",
        creado_por: actorId,
      })
      .select("id")
      .single(),
  ) as any

  if (params.archivo) {
    await subirArchivoAFactura(admin, {
      facturaId: creada.id,
      archivo: params.archivo,
      actorId,
      baseUrl: options.baseUrl,
    })
  }

  if (params.movimiento_id) {
    await vincularFacturaAMovimiento(admin, creada.id, params.movimiento_id, actorId)
  }

  return obtenerFactura(admin, creada.id, options)
}

export interface ActualizarFacturaParams {
  numero?: string | null
  concepto?: string | null
  importe?: number | null
  fecha_emision?: string | null
  estado?: FacturaEstadoApi | null
  notas?: string | null
  contacto_id?: string | null
}

export async function actualizarFactura(
  admin: AdminClient,
  id: string,
  cambios: ActualizarFacturaParams,
  options: { baseUrl?: string } = {},
): Promise<FacturaPublica> {
  const existente = unwrap(
    await (admin as any).from("factura").select("id").eq("id", id).maybeSingle(),
  )
  if (!existente) throw notFound(`No existe ninguna factura con el id ${id}.`)

  const updates: Record<string, unknown> = {}
  for (const campo of ["numero", "concepto", "fecha_emision", "notas", "contacto_id", "estado"] as const) {
    if (cambios[campo] !== undefined) updates[campo] = cambios[campo]
  }
  if (cambios.importe !== undefined) {
    if (cambios.importe != null && Number(cambios.importe) <= 0) {
      throw badRequest("El importe de una factura debe ser positivo.")
    }
    updates.importe = cambios.importe == null ? null : Math.abs(Number(cambios.importe))
  }
  if (cambios.estado && !FACTURA_ESTADOS.includes(cambios.estado)) {
    throw badRequest(`Estado '${cambios.estado}' no válido.`, { estados_validos: FACTURA_ESTADOS })
  }

  if (Object.keys(updates).length === 0) {
    throw badRequest(
      "No has indicado ningún cambio. Campos admitidos: numero, concepto, importe, fecha_emision, estado, notas, contacto_id.",
    )
  }

  const { error } = await (admin as any).from("factura").update(updates).eq("id", id)
  if (error) throw wrapSupabaseError(error)

  return obtenerFactura(admin, id, options)
}

/** Borra la factura, sus adjuntos y desvincula los movimientos que tuviera. */
export async function eliminarFactura(admin: AdminClient, id: string): Promise<void> {
  const existente = unwrap(
    await (admin as any).from("factura").select("id").eq("id", id).maybeSingle(),
  )
  if (!existente) throw notFound(`No existe ninguna factura con el id ${id}.`)

  await (admin as any).from("movimiento").update({ factura_id: null }).eq("factura_id", id)

  const adjuntos = (unwrap(
    await (admin as any)
      .from("archivo_adjunto")
      .select("path_storage, bucket")
      .eq("entidad", "factura")
      .eq("entidad_id", id),
  ) ?? []) as { path_storage: string; bucket: string }[]

  for (const adjunto of adjuntos) {
    const { error } = await admin.storage.from(adjunto.bucket).remove([adjunto.path_storage])
    if (error) console.warn("No se pudo borrar el fichero de Storage:", error.message)
  }
  await (admin as any).from("archivo_adjunto").delete().eq("entidad", "factura").eq("entidad_id", id)

  const { error } = await (admin as any).from("factura").delete().eq("id", id)
  if (error) throw wrapSupabaseError(error)
}

/**
 * Concilia una factura con un movimiento bancario.
 *
 * Puerto servidor de `DatabaseService.linkFacturaToMovimiento`: además del
 * vínculo, sincroniza el contacto en ambos sentidos, rellena los huecos de la
 * factura con los datos del movimiento y replica los adjuntos, para que la
 * factura se vea desde la pestaña de archivos del movimiento.
 */
export async function vincularFacturaAMovimiento(
  admin: AdminClient,
  facturaId: string,
  movimientoId: string,
  actorId: string,
): Promise<void> {
  const [facturaRes, movimientoRes] = await Promise.all([
    (admin as any).from("factura").select("*").eq("id", facturaId).maybeSingle(),
    (admin as any)
      .from("movimiento")
      .select("id, fecha, importe, contacto_id, factura_id, delegacion_id")
      .eq("id", movimientoId)
      .maybeSingle(),
  ])

  const factura = unwrap(facturaRes) as any
  const movimiento = unwrap(movimientoRes) as any
  if (!factura) throw notFound(`No existe ninguna factura con el id ${facturaId}.`)
  if (!movimiento) throw notFound(`No existe ningún movimiento con el id ${movimientoId}.`)
  if (movimiento.factura_id === facturaId) return // idempotente
  if (movimiento.factura_id) {
    throw conflict(
      `Ese movimiento ya tiene vinculada otra factura (${movimiento.factura_id}). Desvincúlala primero.`,
    )
  }
  if (movimiento.delegacion_id !== factura.delegacion_id) {
    throw conflict(
      "La factura y el movimiento son de delegaciones distintas: no se pueden conciliar entre sí.",
    )
  }

  const movimientoUpdates: Record<string, unknown> = { factura_id: facturaId }
  if (factura.contacto_id && !movimiento.contacto_id) {
    movimientoUpdates.contacto_id = factura.contacto_id
  }
  const { error } = await (admin as any)
    .from("movimiento")
    .update(movimientoUpdates)
    .eq("id", movimientoId)
  if (error) throw wrapSupabaseError(error)

  // Relleno best-effort de los huecos de la factura (no bloquea el vínculo).
  const facturaUpdates: Record<string, unknown> = {}
  if (factura.importe == null) facturaUpdates.importe = Math.abs(Number(movimiento.importe))
  if (!factura.fecha_emision && movimiento.fecha) facturaUpdates.fecha_emision = movimiento.fecha
  if (!factura.contacto_id && movimiento.contacto_id) facturaUpdates.contacto_id = movimiento.contacto_id
  if (Object.keys(facturaUpdates).length > 0) {
    const { error: updErr } = await (admin as any)
      .from("factura")
      .update(facturaUpdates)
      .eq("id", facturaId)
    if (updErr) console.warn("No se pudieron rellenar los datos de la factura:", updErr.message)
  }

  const adjuntos = (unwrap(
    await (admin as any)
      .from("archivo_adjunto")
      .select("*")
      .eq("entidad", "factura")
      .eq("entidad_id", facturaId),
  ) ?? []) as any[]
  for (const adjunto of adjuntos) {
    await replicarArchivoEnMovimiento(admin, movimientoId, adjunto, actorId).catch((err) =>
      console.warn("No se pudo replicar el adjunto de la factura:", err?.message ?? err),
    )
  }
}

/** Deshace el vínculo de un movimiento concreto con su factura. */
export async function desvincularFacturaDeMovimiento(
  admin: AdminClient,
  facturaId: string,
  movimientoId: string,
): Promise<void> {
  const { error, count } = await (admin as any)
    .from("movimiento")
    .update({ factura_id: null }, { count: "exact" })
    .eq("id", movimientoId)
    .eq("factura_id", facturaId)
  if (error) throw wrapSupabaseError(error)
  if (count === 0) {
    throw notFound(`El movimiento ${movimientoId} no está vinculado a la factura ${facturaId}.`)
  }
}

// ---------------------------------------------------------------------------
// Conciliación
// ---------------------------------------------------------------------------

export interface CandidatoMovimiento {
  movimiento: {
    id: string
    fecha: string
    concepto: string
    contraparte: string | null
    importe: number
    delegacion: DelegacionPublica | null
    cuenta: string | null
    categoria: string | null
    factura_id: string | null
  }
  puntuacion: number
  importe_exacto: boolean
  motivos: string[]
}

/** Datos de una factura (real o "de papel") con los que buscar su movimiento. */
export interface DatosFactura {
  importe?: number | null
  fecha?: string | null
  proveedor?: string | null
  numero?: string | null
  contacto_id?: string | null
}

function normalizarTexto(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

/**
 * Busca los movimientos que mejor encajan con una factura.
 *
 * El importe manda (con el margen del 2 %, mínimo 0,50 €, que ya usa la app);
 * fecha, proveedor y contacto desempatan. Se devuelven ordenados de mejor a
 * peor con los motivos en texto, para que quien lea el resultado —persona o
 * modelo— pueda decidir con criterio en vez de fiarse de un número.
 */
export async function buscarCandidatosParaFactura(
  admin: AdminClient,
  datos: DatosFactura,
  options: {
    ambito?: DelegacionPublica[] | null
    ventanaDias?: number
    incluirConFactura?: boolean
    limite?: number
  } = {},
): Promise<CandidatoMovimiento[]> {
  const limite = Math.min(options.limite ?? 10, 50)
  const importe = datos.importe == null ? null : Math.abs(Number(datos.importe))

  let query = (admin as any)
    .from("movimiento")
    .select(
      "id, fecha, concepto, contraparte, descripcion, importe, delegacion_id, cuenta_id, categoria_id, contacto_id, factura_id",
    )
    .eq("ignorado", false)
    .lt("importe", 0)

  if (options.ambito) query = query.in("delegacion_id", options.ambito.map((d) => d.id))
  if (!options.incluirConFactura) query = query.is("factura_id", null)

  if (importe != null && importe > 0) {
    const margen = margenImporteFactura(importe)
    query = query.gte("importe", -(importe + margen)).lte("importe", -(importe - margen))
  }

  if (datos.fecha) {
    const ventana = options.ventanaDias ?? 90
    const centro = new Date(datos.fecha)
    if (!Number.isNaN(centro.getTime())) {
      const desde = new Date(centro.getTime() - ventana * 86400000).toISOString().slice(0, 10)
      const hasta = new Date(centro.getTime() + ventana * 86400000).toISOString().slice(0, 10)
      query = query.gte("fecha", desde).lte("fecha", hasta)
    }
  }

  const filas = (unwrap(
    await query.order("fecha", { ascending: false }).limit(300),
  ) ?? []) as any[]

  const catalogos = await cargarCatalogos(admin)
  const delegaciones = await mapaDelegaciones(admin)
  const proveedor = datos.proveedor?.trim() ? normalizarTexto(datos.proveedor.trim()) : null
  const palabrasProveedor = proveedor ? proveedor.split(/\s+/).filter((p) => p.length >= 3) : []

  const puntuados = filas.map((fila) => {
    const base = scoreCandidatoMovimiento(
      { importe, fecha_emision: datos.fecha ?? null, contacto_id: datos.contacto_id ?? null },
      { importe: fila.importe, fecha: fila.fecha, contacto_id: fila.contacto_id } as any,
    )

    const motivos: string[] = []
    if (base.importeExacto) motivos.push("importe exacto")
    else if (importe != null) motivos.push("importe dentro del margen")
    if (base.fechaCercana) motivos.push("fecha muy cercana")
    if (base.mismoContacto) motivos.push("mismo contacto")

    let extra = 0
    if (palabrasProveedor.length > 0) {
      const textoMovimiento = normalizarTexto(
        [fila.concepto, fila.contraparte, fila.descripcion].filter(Boolean).join(" "),
      )
      const aciertos = palabrasProveedor.filter((p) => textoMovimiento.includes(p))
      if (aciertos.length > 0) {
        extra += aciertos.length === palabrasProveedor.length ? 3 : 2
        motivos.push(`el concepto menciona "${datos.proveedor}"`)
      }
    }
    if (datos.numero) {
      const textoMovimiento = normalizarTexto(
        [fila.concepto, fila.contraparte, fila.descripcion].filter(Boolean).join(" "),
      )
      if (textoMovimiento.includes(normalizarTexto(datos.numero))) {
        extra += 3
        motivos.push(`el concepto menciona el número ${datos.numero}`)
      }
    }
    if (fila.factura_id) motivos.push("ojo: ya tiene otra factura vinculada")

    return {
      movimiento: {
        id: fila.id,
        fecha: fila.fecha,
        concepto: fila.concepto,
        contraparte: fila.contraparte ?? null,
        importe: Number(fila.importe),
        delegacion: fila.delegacion_id ? delegaciones.get(fila.delegacion_id) ?? null : null,
        cuenta: fila.cuenta_id ? catalogos.cuentas.get(fila.cuenta_id)?.nombre ?? null : null,
        categoria: fila.categoria_id ? catalogos.categorias.get(fila.categoria_id)?.nombre ?? null : null,
        factura_id: fila.factura_id ?? null,
      },
      puntuacion: base.score + extra,
      importe_exacto: base.importeExacto,
      motivos,
    }
  })

  return puntuados
    .sort((a, b) => b.puntuacion - a.puntuacion || (a.movimiento.fecha < b.movimiento.fecha ? 1 : -1))
    .slice(0, limite)
}

export interface ItemConciliacion extends DatosFactura {
  /** Etiqueta libre para reconocer esta línea en el resultado. */
  referencia?: string | null
  /** Restringe la búsqueda de esta línea a una delegación concreta. */
  delegacion?: string | null
  /** Si la factura ya existe en MCM Bank, su id (entonces no se crea otra). */
  factura_id?: string | null
}

export interface ResultadoItemConciliacion {
  referencia: string | null
  importe: number | null
  proveedor: string | null
  fecha: string | null
  /** El mejor candidato destaca lo suficiente como para vincularlo sin dudar. */
  match_directo: boolean
  candidatos: CandidatoMovimiento[]
  /** Relleno solo cuando `aplicar: true` y hubo match directo. */
  vinculado?: { factura_id: string; movimiento_id: string }
  aviso?: string
}

export interface ConciliarLoteParams {
  items: ItemConciliacion[]
  delegaciones?: string | string[] | null
  ventanaDias?: number
  maxCandidatos?: number
  /** Vincular automáticamente los match directos. Por defecto solo propone. */
  aplicar?: boolean
  /** Con `aplicar`, crear la factura en MCM Bank si la línea no traía `factura_id`. */
  crearFacturas?: boolean
}

export interface ConciliarLoteResultado {
  total: number
  con_match_directo: number
  sin_candidatos: number
  vinculados: number
  resultados: ResultadoItemConciliacion[]
}

/**
 * Concilia un lote de facturas de golpe: "toma estos 12 importes, dime a qué
 * movimiento corresponde cada uno".
 *
 * Por defecto solo propone. Con `aplicar: true` vincula únicamente los que
 * tienen un match directo (importe exacto y ventaja clara sobre el segundo);
 * los dudosos se devuelven para que decida una persona. Es deliberado: una
 * conciliación equivocada es más cara de deshacer que de revisar.
 */
export async function conciliarLote(
  admin: AdminClient,
  params: ConciliarLoteParams,
  actorId: string | null,
): Promise<ConciliarLoteResultado> {
  const items = params.items ?? []
  if (items.length === 0) throw badRequest("No has enviado ninguna factura que conciliar.")
  if (items.length > 100) {
    throw badRequest(`Son demasiadas facturas de una vez (${items.length}). El máximo son 100.`)
  }
  if (params.aplicar && !actorId) {
    throw badRequest("Para aplicar la conciliación hace falta saber quién la firma.")
  }

  const ambitoGeneral = await resolveAmbitoDelegaciones(admin, params.delegaciones)
  const resultados: ResultadoItemConciliacion[] = []
  let vinculados = 0

  for (const item of items) {
    const ambito = item.delegacion
      ? [await resolveDelegacion(admin, item.delegacion)]
      : ambitoGeneral

    const candidatos = await buscarCandidatosParaFactura(admin, item, {
      ambito,
      ventanaDias: params.ventanaDias,
      limite: params.maxCandidatos ?? 5,
    })

    const mejor = candidatos[0]
    const segundo = candidatos[1]
    const matchDirecto = Boolean(
      mejor?.importe_exacto && (!segundo || mejor.puntuacion >= segundo.puntuacion + 2),
    )

    const resultado: ResultadoItemConciliacion = {
      referencia: item.referencia ?? null,
      importe: item.importe == null ? null : Math.abs(Number(item.importe)),
      proveedor: item.proveedor ?? null,
      fecha: item.fecha ?? null,
      match_directo: matchDirecto,
      candidatos,
    }

    if (params.aplicar && matchDirecto && actorId) {
      try {
        let facturaId = item.factura_id ?? null
        if (!facturaId) {
          if (!params.crearFacturas) {
            resultado.aviso =
              "Hay match directo pero la línea no trae 'factura_id'. Vuelve a llamar con 'crear_facturas: true' para registrarla en la bandeja y vincularla."
            resultados.push(resultado)
            continue
          }
          const delegacionMovimiento = mejor.movimiento.delegacion
          if (!delegacionMovimiento) {
            resultado.aviso = "El movimiento candidato no tiene delegación; no se puede crear la factura."
            resultados.push(resultado)
            continue
          }
          const creada = await crearFactura(
            admin,
            {
              delegacion: delegacionMovimiento.id,
              numero: item.numero ?? null,
              concepto: item.proveedor ?? null,
              importe: item.importe ?? null,
              fecha_emision: item.fecha ?? null,
              contacto_id: item.contacto_id ?? null,
            },
            actorId,
          )
          facturaId = creada.id
        }

        await vincularFacturaAMovimiento(admin, facturaId, mejor.movimiento.id, actorId)
        resultado.vinculado = { factura_id: facturaId, movimiento_id: mejor.movimiento.id }
        vinculados += 1
      } catch (err) {
        resultado.aviso = `No se pudo vincular: ${err instanceof Error ? err.message : String(err)}`
      }
    }

    resultados.push(resultado)
  }

  return {
    total: resultados.length,
    con_match_directo: resultados.filter((r) => r.match_directo).length,
    sin_candidatos: resultados.filter((r) => r.candidatos.length === 0).length,
    vinculados,
    resultados,
  }
}

/**
 * El camino inverso: dado un movimiento, qué facturas de la bandeja podrían
 * corresponderle. Compara contra el importe **pendiente** de cada factura, para
 * que funcione también con pagos en varios plazos.
 */
export async function buscarFacturasParaMovimiento(
  admin: AdminClient,
  movimientoId: string,
  options: { limite?: number; baseUrl?: string } = {},
): Promise<{ factura: FacturaPublica; puntuacion: number; motivos: string[] }[]> {
  const movimiento = unwrap(
    await (admin as any)
      .from("movimiento")
      .select("id, delegacion_id, fecha, importe, contacto_id")
      .eq("id", movimientoId)
      .maybeSingle(),
  ) as any
  if (!movimiento) throw notFound(`No existe ningún movimiento con el id ${movimientoId}.`)
  if (!movimiento.delegacion_id) return []

  const filas = (unwrap(
    await (admin as any)
      .from("factura")
      .select(FACTURA_SELECT)
      .eq("delegacion_id", movimiento.delegacion_id)
      .not("estado", "in", "(pagada,pagada_fuera)")
      .order("creado_en", { ascending: false })
      .limit(60),
  ) ?? []) as any[]

  const delegaciones = await mapaDelegaciones(admin)
  const archivos = await archivosDeFacturas(admin, filas.map((f) => f.id), {
    baseUrl: options.baseUrl,
  })
  const importeMovimiento = Math.abs(Number(movimiento.importe))

  return filas
    .map((fila) => {
      const factura = serializeFactura(fila, archivos.get(fila.id) ?? [], delegaciones)
      const pendiente = factura.importe_pendiente
      const base = scoreCandidatoMovimiento(
        { importe: pendiente, fecha_emision: factura.fecha_emision, contacto_id: fila.contacto_id },
        { importe: movimiento.importe, fecha: movimiento.fecha, contacto_id: movimiento.contacto_id } as any,
      )

      const fueraDeMargen =
        pendiente != null &&
        Math.abs(pendiente - importeMovimiento) > margenImporteFactura(importeMovimiento)

      const motivos: string[] = []
      if (base.importeExacto) motivos.push("el importe pendiente coincide exactamente")
      if (base.fechaCercana) motivos.push("fecha muy cercana")
      if (base.mismoContacto) motivos.push("mismo contacto")

      return { factura, puntuacion: base.score, motivos, fueraDeMargen }
    })
    .filter((c) => !c.fueraDeMargen)
    .sort((a, b) => b.puntuacion - a.puntuacion)
    .slice(0, options.limite ?? 10)
    .map(({ factura, puntuacion, motivos }) => ({ factura, puntuacion, motivos }))
}
