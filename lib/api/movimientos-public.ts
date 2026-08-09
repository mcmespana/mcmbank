/**
 * Lógica de datos y serialización de movimientos para la API externa y el
 * servidor MCP.
 *
 * Se separa de las rutas para que todos los consumidores (endpoints REST,
 * herramientas MCP, conciliación de facturas) compartan exactamente el mismo
 * formato de salida.
 *
 * El acceso se hace con el cliente admin (service role), de modo que las
 * consultas son globales y no dependen de la delegación seleccionada ni de RLS:
 * quien usa esta API es un administrador multidelegación que revisa todas las
 * delegaciones a la vez.
 */
import type { createAdminClient } from "@/lib/supabase/admin"
import { applyAbsoluteAmountFilter } from "@/lib/db/amount-filter"
import { badRequest, notFound, unwrap, wrapSupabaseError } from "@/lib/api/errors"
import { aplicarBusquedaTexto } from "@/lib/api/postgrest"
import { mapaDelegaciones, type DelegacionPublica } from "@/lib/api/delegaciones"
import { cargarCatalogos } from "@/lib/api/catalogos"

type AdminClient = ReturnType<typeof createAdminClient>

/** Forma pública de un archivo adjunto. */
export interface ArchivoPublico {
  id: string
  nombre_original: string
  tipo_mime: string
  tamano_bytes: number
  es_factura: boolean
  descripcion: string | null
  bucket: string
  /** URL pública directa. Vacía en los archivos subidos tras pasar a URLs firmadas. */
  url: string
  /** Endpoint autenticado que redirige a una URL firmada de descarga. */
  url_descarga?: string
  path_storage?: string
  subido_en: string
}

/** Forma pública de un movimiento (sin campos internos sensibles). */
export interface MovimientoPublico {
  id: string
  fecha: string
  concepto: string
  descripcion: string | null
  contraparte: string | null
  importe: number
  tipo: "ingreso" | "gasto"
  metodo: string | null
  notas: string | null
  ignorado: boolean
  factura_id: string | null
  factura_pendiente: boolean
  booking_date: string | null
  value_date: string | null
  origen_sync: string | null
  creado_en: string
  cuenta: {
    id: string
    nombre: string
    tipo: string | null
    banco_nombre: string | null
    iban: string | null
  } | null
  categoria: {
    id: string
    nombre: string
    tipo: string | null
    emoji: string | null
    color: string | null
  } | null
  delegacion: {
    id: string
    codigo: string | null
    nombre: string
  } | null
  contacto: {
    id: string
    nombre: string
    tipo: string | null
  } | null
  archivos: ArchivoPublico[]
}

const MOVIMIENTO_SELECT = `
  id,
  fecha,
  concepto,
  descripcion,
  contraparte,
  importe,
  metodo,
  notas,
  ignorado,
  factura_id,
  factura_pendiente,
  booking_date,
  value_date,
  origen_sync,
  creado_en,
  delegacion_id,
  cuenta:cuenta!movimiento_cuenta_id_fkey (
    id,
    nombre,
    tipo,
    banco_nombre,
    iban
  ),
  categoria:categoria_id (
    id,
    nombre,
    tipo,
    emoji,
    color
  ),
  contacto:contacto_id (
    id,
    nombre,
    tipo
  )
`

/**
 * Columnas planas para listados. No se embeben relaciones: `movimiento` tiene
 * dos claves foráneas hacia `cuenta` y desambiguarlas en cada consulta es
 * frágil. Cuenta, categoría, contacto y delegación son tablas pequeñas que se
 * cargan enteras una vez (ver `lib/api/catalogos.ts`) y se cruzan en memoria.
 */
const MOVIMIENTO_LISTA_SELECT = `
  id,
  fecha,
  concepto,
  descripcion,
  contraparte,
  importe,
  metodo,
  notas,
  ignorado,
  factura_id,
  factura_pendiente,
  booking_date,
  value_date,
  origen_sync,
  creado_en,
  delegacion_id,
  cuenta_id,
  categoria_id,
  contacto_id
`

/**
 * Obtiene un movimiento por su ID con sus relaciones (cuenta, categoría,
 * contacto) y la delegación asociada. Devuelve `null` si no existe.
 *
 * La cuenta se embebe indicando explícitamente la FK (`!movimiento_cuenta_id_fkey`):
 * `movimiento` tiene otra FK compuesta hacia `cuenta` (`movimiento_cuenta_deleg_fk`,
 * que valida que la cuenta pertenezca a la delegación del movimiento) y sin el
 * hint PostgREST no puede decidir cuál de las dos usar ("ambiguous embedding").
 *
 * La delegación no se embebe en el mismo `select`: no existe una FK directa
 * `movimiento.delegacion_id -> delegacion.id` (solo la compuesta de arriba),
 * así que se resuelve con una segunda consulta.
 */
export async function getMovimientoRaw(admin: AdminClient, id: string) {
  const { data, error } = await (admin as any)
    .from("movimiento")
    .select(MOVIMIENTO_SELECT)
    .eq("id", id)
    .maybeSingle()

  if (error) throw wrapSupabaseError(error)
  if (!data) return null

  const delegacion = await getDelegacionRaw(admin, (data as any).delegacion_id)
  return { ...(data as object), delegacion }
}

/**
 * Obtiene una delegación por su ID en su forma pública mínima.
 */
export async function getDelegacionRaw(admin: AdminClient, delegacionId: string | null) {
  if (!delegacionId) return null

  const { data, error } = await (admin as any)
    .from("delegacion")
    .select("id, codigo, nombre")
    .eq("id", delegacionId)
    .maybeSingle()

  if (error) throw wrapSupabaseError(error)
  return data ?? null
}

/**
 * Obtiene los archivos adjuntos de un movimiento, ordenados por fecha de subida.
 */
export async function getArchivosRaw(admin: AdminClient, movimientoId: string) {
  const { data, error } = await (admin as any)
    .from("movimiento_archivo")
    .select("*")
    .eq("movimiento_id", movimientoId)
    .order("subido_en", { ascending: true })

  if (error) throw wrapSupabaseError(error)
  return (data ?? []) as any[]
}

/** Archivos de varios movimientos a la vez, agrupados por movimiento. */
export async function getArchivosDeMovimientos(
  admin: AdminClient,
  movimientoIds: string[],
): Promise<Map<string, any[]>> {
  const agrupados = new Map<string, any[]>()
  if (movimientoIds.length === 0) return agrupados

  const data = unwrap(
    await (admin as any)
      .from("movimiento_archivo")
      .select("*")
      .in("movimiento_id", movimientoIds)
      .order("subido_en", { ascending: true }),
  ) as any[] | null

  for (const fila of data ?? []) {
    const lista = agrupados.get(fila.movimiento_id) ?? []
    lista.push(fila)
    agrupados.set(fila.movimiento_id, lista)
  }
  return agrupados
}

/** Serializa una fila de `movimiento_archivo` o `archivo_adjunto` al formato público. */
export function serializeArchivo(row: any, options: { baseUrl?: string } = {}): ArchivoPublico {
  return {
    id: row.id,
    nombre_original: row.nombre_original,
    tipo_mime: row.tipo_mime,
    // En `movimiento_archivo` la columna es `tamaño_bytes` (con ñ) y en
    // `archivo_adjunto` es `tamano_bytes`; se expone siempre sin ñ.
    tamano_bytes: row["tamaño_bytes"] ?? row.tamano_bytes ?? 0,
    es_factura: !!row.es_factura,
    descripcion: row.descripcion ?? null,
    bucket: row.bucket,
    url: row.url_publica ?? "",
    ...(options.baseUrl ? { url_descarga: `${options.baseUrl}/api/v1/archivos/${row.id}/descargar` } : {}),
    path_storage: row.path_storage,
    subido_en: row.subido_en,
  }
}

/** Serializa un movimiento (con relaciones ya embebidas) al formato público. */
export function serializeMovimiento(
  row: any,
  archivos: ArchivoPublico[],
): MovimientoPublico {
  return {
    id: row.id,
    fecha: row.fecha,
    concepto: row.concepto,
    descripcion: row.descripcion ?? null,
    contraparte: row.contraparte ?? null,
    importe: Number(row.importe),
    tipo: Number(row.importe) >= 0 ? "ingreso" : "gasto",
    metodo: row.metodo ?? null,
    notas: row.notas ?? null,
    ignorado: !!row.ignorado,
    factura_id: row.factura_id ?? null,
    factura_pendiente: !!row.factura_pendiente,
    booking_date: row.booking_date ?? null,
    value_date: row.value_date ?? null,
    origen_sync: row.origen_sync ?? null,
    creado_en: row.creado_en,
    cuenta: row.cuenta
      ? {
          id: row.cuenta.id,
          nombre: row.cuenta.nombre,
          tipo: row.cuenta.tipo ?? null,
          banco_nombre: row.cuenta.banco_nombre ?? null,
          iban: row.cuenta.iban ?? null,
        }
      : null,
    categoria: row.categoria
      ? {
          id: row.categoria.id,
          nombre: row.categoria.nombre,
          tipo: row.categoria.tipo ?? null,
          emoji: row.categoria.emoji ?? null,
          color: row.categoria.color ?? null,
        }
      : null,
    delegacion: row.delegacion
      ? {
          id: row.delegacion.id,
          codigo: row.delegacion.codigo ?? null,
          nombre: row.delegacion.nombre,
        }
      : null,
    contacto: row.contacto
      ? {
          id: row.contacto.id,
          nombre: row.contacto.nombre,
          tipo: row.contacto.tipo ?? null,
        }
      : null,
    archivos,
  }
}

// ---------------------------------------------------------------------------
// Búsqueda de movimientos
// ---------------------------------------------------------------------------

export type OrdenMovimientos = "fecha_desc" | "fecha_asc" | "importe_desc" | "importe_asc"

export interface BuscarMovimientosParams {
  /** Delegaciones ya resueltas. `null` = todas. */
  delegaciones?: DelegacionPublica[] | null
  /** Texto libre; cada palabra debe aparecer en concepto, descripción o contraparte. */
  texto?: string | null
  /** Rango por valor absoluto: `importe_min: 50` encuentra tanto +50 como -50. */
  importeMin?: number | null
  importeMax?: number | null
  tipo?: "ingreso" | "gasto" | null
  fechaDesde?: string | null
  fechaHasta?: string | null
  categoriaIds?: string[] | null
  sinCategoria?: boolean
  cuentaIds?: string[] | null
  contactoIds?: string[] | null
  /** `true` = solo con factura vinculada, `false` = solo sin factura. */
  conFactura?: boolean | null
  facturaPendiente?: boolean
  /** Por defecto se excluyen (igual que en la app). */
  incluirIgnorados?: boolean
  /** Por defecto se excluyen los de cuentas desactivadas (igual que en la app). */
  incluirCuentasInactivas?: boolean
  orden?: OrdenMovimientos
  limite?: number
  offset?: number
  incluirArchivos?: boolean
  baseUrl?: string
}

export interface ResumenPorDelegacion {
  delegacion: DelegacionPublica | null
  movimientos: number
  ingresos: number
  gastos: number
  neto: number
}

export interface BuscarMovimientosResultado {
  total: number
  limite: number
  offset: number
  hay_mas: boolean
  resumen: {
    movimientos: number
    ingresos: number
    gastos: number
    neto: number
    truncado: boolean
    por_delegacion: ResumenPorDelegacion[]
  }
  movimientos: MovimientoPublico[]
}

const LIMITE_POR_DEFECTO = 50
const LIMITE_MAXIMO = 200
/** Tope de filas que se agregan para el resumen (páginas de 1000). */
const RESUMEN_MAX_FILAS = 20_000

const COLUMNAS_TEXTO = ["concepto", "descripcion", "contraparte", "notas", "texto_extra_1", "texto_extra_2"]

function redondear(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Aplica al query builder todos los filtros de búsqueda. Se usa tanto para la
 * página de resultados como para la consulta de agregados, de modo que el
 * resumen siempre corresponde exactamente a lo que se ha buscado.
 */
function aplicarFiltros(query: any, params: BuscarMovimientosParams, cuentasExcluidas: string[]): any {
  let q = query

  if (params.delegaciones) {
    q = q.in("delegacion_id", params.delegaciones.map((d) => d.id))
  }
  if (!params.incluirIgnorados) {
    q = q.eq("ignorado", false)
  }
  if (cuentasExcluidas.length > 0) {
    q = q.not("cuenta_id", "in", `(${cuentasExcluidas.join(",")})`)
  }
  if (params.fechaDesde) q = q.gte("fecha", params.fechaDesde)
  if (params.fechaHasta) q = q.lte("fecha", params.fechaHasta)
  if (params.tipo === "gasto") q = q.lt("importe", 0)
  if (params.tipo === "ingreso") q = q.gte("importe", 0)
  if (params.categoriaIds?.length) q = q.in("categoria_id", params.categoriaIds)
  if (params.sinCategoria) q = q.is("categoria_id", null)
  if (params.cuentaIds?.length) q = q.in("cuenta_id", params.cuentaIds)
  if (params.contactoIds?.length) q = q.in("contacto_id", params.contactoIds)
  if (params.conFactura === true) q = q.not("factura_id", "is", null)
  if (params.conFactura === false) q = q.is("factura_id", null)
  if (params.facturaPendiente) q = q.eq("factura_pendiente", true)

  q = applyAbsoluteAmountFilter(
    q,
    params.importeMin ?? undefined,
    params.importeMax ?? undefined,
  )
  q = aplicarBusquedaTexto(q, params.texto, COLUMNAS_TEXTO)

  return q
}

function aplicarOrden(query: any, orden: OrdenMovimientos): any {
  switch (orden) {
    case "fecha_asc":
      return query.order("fecha", { ascending: true }).order("creado_en", { ascending: true })
    case "importe_desc":
      return query.order("importe", { ascending: false })
    case "importe_asc":
      return query.order("importe", { ascending: true })
    case "fecha_desc":
    default:
      return query.order("fecha", { ascending: false }).order("creado_en", { ascending: false })
  }
}

/**
 * Busca movimientos en una, varias o todas las delegaciones y devuelve además
 * el resumen económico del conjunto completo (no solo de la página): sin eso,
 * "cuánto llevamos gastado en Mercadona" obligaría a paginar a mano.
 */
export async function buscarMovimientos(
  admin: AdminClient,
  params: BuscarMovimientosParams,
): Promise<BuscarMovimientosResultado> {
  const limite = Math.min(Math.max(params.limite ?? LIMITE_POR_DEFECTO, 1), LIMITE_MAXIMO)
  const offset = Math.max(params.offset ?? 0, 0)
  const orden = params.orden ?? "fecha_desc"

  if (params.fechaDesde && params.fechaHasta && params.fechaDesde > params.fechaHasta) {
    throw badRequest(
      `El rango de fechas está al revés: 'desde' (${params.fechaDesde}) es posterior a 'hasta' (${params.fechaHasta}).`,
    )
  }

  const catalogos = await cargarCatalogos(admin)
  const cuentasExcluidas = params.incluirCuentasInactivas
    ? []
    : [...catalogos.cuentas.values()].filter((c) => !c.activa).map((c) => c.id)

  // Página de resultados
  let query = (admin as any)
    .from("movimiento")
    .select(MOVIMIENTO_LISTA_SELECT, { count: "exact" })
  query = aplicarFiltros(query, params, cuentasExcluidas)
  query = aplicarOrden(query, orden).range(offset, offset + limite - 1)

  const { data, count, error } = await query
  if (error) throw wrapSupabaseError(error)
  const filas = (data ?? []) as any[]

  const total = count ?? filas.length

  // Agregados sobre TODO el conjunto que cumple los filtros
  const resumen = await agregarResumen(admin, params, cuentasExcluidas, total)

  const delegaciones = await mapaDelegaciones(admin)
  const archivosPorMovimiento =
    params.incluirArchivos === false
      ? new Map<string, any[]>()
      : await getArchivosDeMovimientos(admin, filas.map((f) => f.id))

  const movimientos = filas.map((fila) => {
    const enriquecida = {
      ...fila,
      cuenta: fila.cuenta_id ? catalogos.cuentas.get(fila.cuenta_id) ?? null : null,
      categoria: fila.categoria_id ? catalogos.categorias.get(fila.categoria_id) ?? null : null,
      contacto: fila.contacto_id ? catalogos.contactos.get(fila.contacto_id) ?? null : null,
      delegacion: fila.delegacion_id ? delegaciones.get(fila.delegacion_id) ?? null : null,
    }
    const archivos = (archivosPorMovimiento.get(fila.id) ?? []).map((a) =>
      serializeArchivo(a, { baseUrl: params.baseUrl }),
    )
    return serializeMovimiento(enriquecida, archivos)
  })

  return {
    total,
    limite,
    offset,
    hay_mas: offset + movimientos.length < total,
    resumen: {
      ...resumen,
      por_delegacion: resumen.por_delegacion.map((r) => ({
        ...r,
        delegacion: r.delegacion ? delegaciones.get(r.delegacion.id) ?? r.delegacion : null,
      })),
    },
    movimientos,
  }
}

/**
 * Suma ingresos, gastos y neto de todo el conjunto filtrado, desglosado por
 * delegación. Se traen solo dos columnas por fila y se agregan en memoria: es
 * más simple que una función SQL nueva y a la escala de MCM (miles de
 * movimientos) es instantáneo. Si algún día se pasa del tope, se marca
 * `truncado: true` en vez de mentir con un total incompleto.
 */
async function agregarResumen(
  admin: AdminClient,
  params: BuscarMovimientosParams,
  cuentasExcluidas: string[],
  total: number,
): Promise<Omit<BuscarMovimientosResultado["resumen"], "por_delegacion"> & {
  por_delegacion: { delegacion: DelegacionPublica | null; movimientos: number; ingresos: number; gastos: number; neto: number }[]
}> {
  const porDelegacion = new Map<string, { movimientos: number; ingresos: number; gastos: number }>()
  let totalFilas = 0
  let ingresos = 0
  let gastos = 0

  const PAGINA = 1000
  for (let desde = 0; desde < RESUMEN_MAX_FILAS; desde += PAGINA) {
    // Se pagina ordenando por `id` (único) y no por fecha: con un orden no
    // estable, las filas que comparten fecha pueden repetirse o saltarse entre
    // páginas y el total saldría mal.
    let query = (admin as any).from("movimiento").select("delegacion_id, importe")
    query = aplicarFiltros(query, params, cuentasExcluidas)
    query = query.order("id", { ascending: true }).range(desde, desde + PAGINA - 1)

    const { data, error } = await query
    if (error) throw wrapSupabaseError(error)
    const filas = (data ?? []) as { delegacion_id: string | null; importe: number }[]

    for (const fila of filas) {
      const importe = Number(fila.importe)
      totalFilas += 1
      if (importe >= 0) ingresos += importe
      else gastos += importe

      const clave = fila.delegacion_id ?? "sin_delegacion"
      const acumulado = porDelegacion.get(clave) ?? { movimientos: 0, ingresos: 0, gastos: 0 }
      acumulado.movimientos += 1
      if (importe >= 0) acumulado.ingresos += importe
      else acumulado.gastos += importe
      porDelegacion.set(clave, acumulado)
    }

    if (filas.length < PAGINA) break
  }

  const delegaciones = await mapaDelegaciones(admin)

  return {
    truncado: totalFilas < total,
    movimientos: totalFilas,
    ingresos: redondear(ingresos),
    gastos: redondear(gastos),
    neto: redondear(ingresos + gastos),
    por_delegacion: [...porDelegacion.entries()]
      .map(([id, v]) => ({
        delegacion: delegaciones.get(id) ?? null,
        movimientos: v.movimientos,
        ingresos: redondear(v.ingresos),
        gastos: redondear(v.gastos),
        neto: redondear(v.ingresos + v.gastos),
      }))
      .sort((a, b) => a.gastos - b.gastos),
  }
}

/** Movimiento completo (con archivos) o `null`. */
export async function obtenerMovimiento(
  admin: AdminClient,
  id: string,
  options: { baseUrl?: string } = {},
): Promise<MovimientoPublico | null> {
  const row = await getMovimientoRaw(admin, id)
  if (!row) return null
  const archivos = (await getArchivosRaw(admin, id)).map((a) =>
    serializeArchivo(a, { baseUrl: options.baseUrl }),
  )
  return serializeMovimiento(row, archivos)
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

/** Campos de un movimiento que la API externa puede modificar. */
export interface ActualizarMovimientoParams {
  categoria_id?: string | null
  contacto_id?: string | null
  notas?: string | null
  descripcion?: string | null
  contraparte?: string | null
  metodo?: string | null
  ignorado?: boolean
  factura_pendiente?: boolean
}

/**
 * Actualiza los campos "editables por humanos" de un movimiento.
 *
 * Deliberadamente NO deja tocar importe, fecha, cuenta ni delegación: esos
 * datos vienen del banco y cambiarlos desde una integración externa sería una
 * forma silenciosa de descuadrar la contabilidad. Para el vínculo con facturas
 * está `vincularFacturaAMovimiento`, que además mantiene el estado de la factura.
 */
export async function actualizarMovimiento(
  admin: AdminClient,
  id: string,
  cambios: ActualizarMovimientoParams,
  options: { baseUrl?: string } = {},
): Promise<MovimientoPublico> {
  const existente = unwrap(
    await (admin as any).from("movimiento").select("id, delegacion_id").eq("id", id).maybeSingle(),
  )
  if (!existente) throw notFound(`No existe ningún movimiento con el id ${id}.`)

  const updates: Record<string, unknown> = {}
  for (const campo of [
    "categoria_id",
    "contacto_id",
    "notas",
    "descripcion",
    "contraparte",
    "metodo",
    "ignorado",
    "factura_pendiente",
  ] as const) {
    if (cambios[campo] !== undefined) updates[campo] = cambios[campo]
  }

  if (Object.keys(updates).length === 0) {
    throw badRequest(
      "No has indicado ningún cambio. Campos admitidos: categoria_id, contacto_id, notas, descripcion, contraparte, metodo, ignorado, factura_pendiente.",
    )
  }

  if (typeof updates.categoria_id === "string") {
    const { categorias } = await cargarCatalogos(admin)
    if (!categorias.has(updates.categoria_id as string)) {
      throw notFound(`No existe ninguna categoría con el id ${updates.categoria_id}.`)
    }
  }
  if (typeof updates.contacto_id === "string") {
    const { contactos } = await cargarCatalogos(admin)
    if (!contactos.has(updates.contacto_id as string)) {
      throw notFound(`No existe ningún contacto con el id ${updates.contacto_id}.`)
    }
  }

  const { error } = await (admin as any).from("movimiento").update(updates).eq("id", id)
  if (error) throw wrapSupabaseError(error)

  const actualizado = await obtenerMovimiento(admin, id, options)
  if (!actualizado) throw notFound(`No existe ningún movimiento con el id ${id}.`)
  return actualizado
}
