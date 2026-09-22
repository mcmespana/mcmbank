import type { createAdminClient } from "@/lib/supabase/admin"
import { badRequest, conflict, unwrap } from "@/lib/api/errors"
import { resolveAmbitoDelegaciones, resolveDelegacion, type DelegacionPublica } from "@/lib/api/delegaciones"
import { normalizarClaveProveedor } from "@/lib/utils/proveedor-logo"
import { CONTACTO_TIPOS, type ContactoTipo } from "@/lib/types/database"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Catálogos: cuentas, categorías y contactos.
 *
 * Son tablas pequeñas (decenas o pocos cientos de filas en toda la
 * organización) y se necesitan constantemente para adornar movimientos con
 * nombres legibles. En vez de embeber joins en cada consulta de movimientos
 * —lo que obliga a desambiguar claves foráneas en PostgREST— se cargan enteros
 * una vez y se cruzan en memoria. Sale más simple y más rápido.
 */

export interface CuentaPublica {
  id: string
  delegacion_id: string
  nombre: string
  tipo: string | null
  origen: string | null
  banco_nombre: string | null
  iban: string | null
  activa: boolean
  color: string | null
  descripcion: string | null
  sync_enabled: boolean
  last_sync_at: string | null
}

export interface CategoriaPublica {
  id: string
  nombre: string
  tipo: string | null
  emoji: string | null
  color: string | null
  es_global: boolean
  delegacion_id: string | null
  categoria_padre_id: string | null
  orden: number
  esta_activa: boolean
}

export interface ContactoPublico {
  id: string
  nombre: string
  tipo: string | null
  emoji: string | null
  color: string | null
  es_global: boolean
  delegacion_id: string | null
  email: string | null
  telefono: string | null
  iban: string | null
  identificador_fiscal: string | null
  archivado: boolean
}

interface Catalogos {
  cuentas: Map<string, CuentaPublica>
  categorias: Map<string, CategoriaPublica>
  contactos: Map<string, ContactoPublico>
}

let cache: { cargadoEn: number; catalogos: Catalogos } | null = null
const CACHE_TTL_MS = 60 * 1000

const CUENTA_COLS =
  "id, delegacion_id, nombre, tipo, origen, banco_nombre, iban, activa, color, descripcion, sync_enabled, last_sync_at"
const CATEGORIA_COLS =
  "id, nombre, tipo, emoji, color, es_global, delegacion_id, categoria_padre_id, orden, esta_activa"
const CONTACTO_COLS =
  "id, nombre, tipo, emoji, color, es_global, delegacion_id, email, telefono, iban, identificador_fiscal, archivado"

function indexar<T extends { id: string }>(filas: unknown): Map<string, T> {
  return new Map(((filas ?? []) as T[]).map((fila) => [fila.id, fila]))
}

/** Carga (o reutiliza) los tres catálogos completos. */
export async function cargarCatalogos(
  admin: AdminClient,
  options: { forzarRecarga?: boolean } = {},
): Promise<Catalogos> {
  if (!options.forzarRecarga && cache && Date.now() - cache.cargadoEn < CACHE_TTL_MS) {
    return cache.catalogos
  }

  const [cuentasRes, categoriasRes, contactosRes] = await Promise.all([
    (admin as any).from("cuenta").select(CUENTA_COLS).order("nombre"),
    (admin as any).from("categoria").select(CATEGORIA_COLS).order("orden"),
    (admin as any).from("contacto").select(CONTACTO_COLS).order("nombre"),
  ])

  const catalogos: Catalogos = {
    cuentas: indexar<CuentaPublica>(unwrap(cuentasRes)),
    categorias: indexar<CategoriaPublica>(unwrap(categoriasRes)),
    contactos: indexar<ContactoPublico>(unwrap(contactosRes)),
  }

  cache = { cargadoEn: Date.now(), catalogos }
  return catalogos
}

function enAmbito(
  delegacionId: string | null,
  delegaciones: DelegacionPublica[] | null,
  esGlobal = false,
): boolean {
  if (!delegaciones) return true
  if (esGlobal && delegacionId == null) return true
  return delegacionId != null && delegaciones.some((d) => d.id === delegacionId)
}

/** Cuentas de las delegaciones indicadas (o de todas). */
export async function listCuentas(
  admin: AdminClient,
  params: { delegaciones?: string | string[] | null; incluirInactivas?: boolean } = {},
): Promise<CuentaPublica[]> {
  const delegaciones = await resolveAmbitoDelegaciones(admin, params.delegaciones)
  const { cuentas } = await cargarCatalogos(admin)
  return [...cuentas.values()]
    .filter((c) => enAmbito(c.delegacion_id, delegaciones))
    .filter((c) => params.incluirInactivas || c.activa)
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
}

/**
 * Categorías visibles para las delegaciones indicadas: las globales de la
 * organización más las propias de cada delegación.
 *
 * Ojo: el orden y la visibilidad *por delegación* se guardan aparte, en
 * `categoria_orden_delegacion`. Se aplican cuando se pide una única delegación
 * (que es cuando ese override tiene sentido).
 */
export async function listCategorias(
  admin: AdminClient,
  params: { delegaciones?: string | string[] | null; incluirInactivas?: boolean } = {},
): Promise<CategoriaPublica[]> {
  const delegaciones = await resolveAmbitoDelegaciones(admin, params.delegaciones)
  const { categorias } = await cargarCatalogos(admin)

  let lista = [...categorias.values()].filter((c) =>
    enAmbito(c.delegacion_id, delegaciones, c.es_global),
  )

  if (delegaciones?.length === 1) {
    const overrides = unwrap(
      await (admin as any)
        .from("categoria_orden_delegacion")
        .select("categoria_id, orden, esta_activa")
        .eq("delegacion_id", delegaciones[0].id),
    ) as { categoria_id: string; orden: number; esta_activa: boolean }[] | null

    const porCategoria = new Map((overrides ?? []).map((o) => [o.categoria_id, o]))
    lista = lista.map((c) => {
      const override = porCategoria.get(c.id)
      return override ? { ...c, orden: override.orden, esta_activa: override.esta_activa } : c
    })
  }

  return lista
    .filter((c) => params.incluirInactivas || c.esta_activa)
    .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es"))
}

/** Contactos (proveedores y personas) de las delegaciones indicadas. */
export async function listContactos(
  admin: AdminClient,
  params: {
    delegaciones?: string | string[] | null
    incluirArchivados?: boolean
    tipos?: string[]
    texto?: string
  } = {},
): Promise<ContactoPublico[]> {
  const delegaciones = await resolveAmbitoDelegaciones(admin, params.delegaciones)
  const { contactos } = await cargarCatalogos(admin)
  const texto = params.texto?.trim().toLowerCase()

  return [...contactos.values()]
    .filter((c) => enAmbito(c.delegacion_id, delegaciones, c.es_global))
    .filter((c) => params.incluirArchivados || !c.archivado)
    .filter((c) => !params.tipos?.length || (c.tipo != null && params.tipos.includes(c.tipo)))
    .filter((c) => !texto || c.nombre.toLowerCase().includes(texto))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
}

/**
 * Resuelve categorías por nombre o id, igual que las delegaciones: quien usa
 * la API dice "Alimentación", no un UUID. Devuelve todas las coincidencias
 * (puede haber una categoría con el mismo nombre en varias delegaciones, y
 * filtrar por todas ellas es justo lo que se quiere).
 */
export async function resolveCategorias(
  admin: AdminClient,
  entrada: string | string[] | null | undefined,
  ambito?: DelegacionPublica[] | null,
): Promise<CategoriaPublica[] | null> {
  if (entrada == null) return null
  const lista = (Array.isArray(entrada) ? entrada : [entrada])
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
  if (lista.length === 0) return null

  const { categorias } = await cargarCatalogos(admin)
  const candidatas = [...categorias.values()].filter((c) =>
    enAmbito(c.delegacion_id, ambito ?? null, c.es_global),
  )

  const encontradas: CategoriaPublica[] = []
  for (const item of lista) {
    const porId = candidatas.filter((c) => c.id === item)
    const porNombre =
      porId.length > 0
        ? porId
        : candidatas.filter((c) => c.nombre.toLowerCase() === item.toLowerCase())
    const parciales =
      porNombre.length > 0
        ? porNombre
        : candidatas.filter((c) => c.nombre.toLowerCase().includes(item.toLowerCase()))

    for (const c of parciales) {
      if (!encontradas.some((e) => e.id === c.id)) encontradas.push(c)
    }
  }

  return encontradas
}

/** Resuelve cuentas por nombre, IBAN o id. */
export async function resolveCuentas(
  admin: AdminClient,
  entrada: string | string[] | null | undefined,
  ambito?: DelegacionPublica[] | null,
): Promise<CuentaPublica[] | null> {
  if (entrada == null) return null
  const lista = (Array.isArray(entrada) ? entrada : [entrada])
    .map((x) => String(x ?? "").trim())
    .filter(Boolean)
  if (lista.length === 0) return null

  const { cuentas } = await cargarCatalogos(admin)
  const candidatas = [...cuentas.values()].filter((c) => enAmbito(c.delegacion_id, ambito ?? null))

  const encontradas: CuentaPublica[] = []
  for (const item of lista) {
    const termino = item.toLowerCase()
    const coincidencias = candidatas.filter(
      (c) =>
        c.id === item ||
        c.nombre.toLowerCase() === termino ||
        c.nombre.toLowerCase().includes(termino) ||
        (c.iban && c.iban.toLowerCase().replace(/\s+/g, "").includes(termino.replace(/\s+/g, ""))),
    )
    for (const c of coincidencias) {
      if (!encontradas.some((e) => e.id === c.id)) encontradas.push(c)
    }
  }

  return encontradas
}

// ---------------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------------

export interface CrearContactoParams {
  tipo: string
  nombre: string
  /**
   * Obligatoria para 'persona_mcm' y 'destinatario_mcm' (son de una única
   * delegación). Para 'proveedor' es opcional: si se indica, el proveedor
   * global recién creado se adopta en esa delegación (aparece en su agenda).
   */
  delegacion?: string | null
  email?: string | null
  telefono?: string | null
  iban?: string | null
  identificador_fiscal?: string | null
  direccion?: string | null
  ciudad?: string | null
  codigo_postal?: string | null
  /** Nota interna. Para un proveedor es de la delegación indicada, no de la ficha compartida. */
  notas?: string | null
  /** Categoría que se propone al usar este contacto. Mismo matiz que 'notas' para un proveedor. */
  categoria_id_predeterminada?: string | null
}

/**
 * Da de alta un contacto.
 *
 * Los proveedores son de toda la organización (`scripts/061`): se crean
 * como ficha global y, si se indica delegación, se adoptan en ella (fila en
 * `contacto_delegacion`) para que aparezcan en su agenda; sus notas y
 * categoría predeterminada, al ser propias de cada delegación, van también
 * ahí y no en la ficha compartida. Antes de crear uno se comprueba que no
 * exista ya por nombre normalizado (el mismo criterio que el índice único de
 * la base de datos), para no sembrar el directorio de Mercadonas duplicados.
 *
 * Personas MCM y destinatarios MCM son datos personales: quedan siempre
 * dentro de una delegación, así que 'delegacion' es obligatoria para ellos.
 */
export async function crearContacto(
  admin: AdminClient,
  params: CrearContactoParams,
  actorId: string | null,
): Promise<ContactoPublico> {
  const tipo = params.tipo as ContactoTipo
  if (!CONTACTO_TIPOS.includes(tipo)) {
    throw badRequest(`Tipo de contacto '${params.tipo}' no válido.`, { tipos_validos: CONTACTO_TIPOS })
  }

  const nombre = params.nombre?.trim()
  if (!nombre) throw badRequest("Falta el nombre del contacto.")

  const esProveedor = tipo === "proveedor"
  const delegacion = params.delegacion ? await resolveDelegacion(admin, params.delegacion) : null
  if (!esProveedor && !delegacion) {
    throw badRequest(
      `Los contactos de tipo '${tipo}' pertenecen a una delegación: indica 'delegacion'.`,
    )
  }

  const datosBase = {
    tipo,
    nombre,
    email: params.email?.trim() || null,
    telefono: params.telefono?.trim() || null,
    iban: params.iban?.trim() || null,
    identificador_fiscal: params.identificador_fiscal?.trim() || null,
    direccion: params.direccion?.trim() || null,
    ciudad: params.ciudad?.trim() || null,
    codigo_postal: params.codigo_postal?.trim() || null,
    creado_por: actorId,
  }

  if (esProveedor) {
    const clave = normalizarClaveProveedor(nombre)
    if (clave) {
      const { contactos } = await cargarCatalogos(admin)
      const existente = [...contactos.values()].find(
        (c) => c.tipo === "proveedor" && c.es_global && normalizarClaveProveedor(c.nombre) === clave,
      )
      if (existente) {
        throw conflict(
          `Ya existe un proveedor con ese nombre: "${existente.nombre}". Los proveedores son compartidos por toda la organización: usa su id (${existente.id}) en vez de crear uno nuevo.`,
          { contacto_id: existente.id, nombre: existente.nombre },
        )
      }
    }

    const creado = unwrap(
      await (admin as any)
        .from("contacto")
        .insert({ ...datosBase, es_global: true, delegacion_id: null })
        .select(CONTACTO_COLS)
        .single(),
    ) as ContactoPublico

    if (delegacion) {
      const { error } = await (admin as any).from("contacto_delegacion").upsert(
        {
          contacto_id: creado.id,
          delegacion_id: delegacion.id,
          notas: params.notas?.trim() || null,
          categoria_id_predeterminada: params.categoria_id_predeterminada || null,
        },
        { onConflict: "contacto_id,delegacion_id" },
      )
      if (error) console.warn("No se pudo adoptar el proveedor recién creado:", error.message)
    }

    cache = null
    return creado
  }

  const creado = unwrap(
    await (admin as any)
      .from("contacto")
      .insert({
        ...datosBase,
        es_global: false,
        delegacion_id: delegacion!.id,
        notas: params.notas?.trim() || null,
        categoria_id_predeterminada: params.categoria_id_predeterminada || null,
      })
      .select(CONTACTO_COLS)
      .single(),
  ) as ContactoPublico

  cache = null
  return creado
}
