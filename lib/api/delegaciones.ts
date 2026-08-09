import type { createAdminClient } from "@/lib/supabase/admin"
import { badRequest, notFound, unwrap } from "@/lib/api/errors"
import { esUuid } from "@/lib/api/actor"

type AdminClient = ReturnType<typeof createAdminClient>

/**
 * Resolución de delegaciones por lenguaje natural.
 *
 * Quien usa esta API es un administrador multidelegación que habla de
 * "Sevilla", "la delegación de Madrid" o "MCM-SEV", no de UUIDs. Aquí se
 * traduce ese texto a una delegación concreta, y cuando hay ambigüedad se
 * devuelve un error que **lista los candidatos**, para que el agente pueda
 * reintentar con el nombre exacto sin tener que preguntar al usuario.
 */

export interface DelegacionPublica {
  id: string
  codigo: string | null
  nombre: string
}

/** Quita acentos y mayúsculas para comparar "Cádiz" con "cadiz". */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
}

/** Palabras de relleno que la gente escribe al nombrar una delegación. */
const RUIDO = /^(la |el |de |del |delegacion |delegación |mcm )+/

function claveBusqueda(texto: string): string {
  let t = normalizar(texto)
  let anterior: string
  do {
    anterior = t
    t = t.replace(RUIDO, "")
  } while (t !== anterior)
  return t.trim()
}

let cache: { cargadoEn: number; delegaciones: DelegacionPublica[] } | null = null
const CACHE_TTL_MS = 60 * 1000

/** Todas las delegaciones de la organización, ordenadas por nombre. */
export async function listDelegaciones(
  admin: AdminClient,
  options: { forzarRecarga?: boolean } = {},
): Promise<DelegacionPublica[]> {
  if (!options.forzarRecarga && cache && Date.now() - cache.cargadoEn < CACHE_TTL_MS) {
    return cache.delegaciones
  }

  const data = unwrap(
    await (admin as any).from("delegacion").select("id, codigo, nombre").order("nombre"),
  )
  const delegaciones = (data ?? []) as DelegacionPublica[]
  cache = { cargadoEn: Date.now(), delegaciones }
  return delegaciones
}

/** Mapa id → delegación, para adjuntar la delegación a listas de movimientos. */
export async function mapaDelegaciones(
  admin: AdminClient,
): Promise<Map<string, DelegacionPublica>> {
  const lista = await listDelegaciones(admin)
  return new Map(lista.map((d) => [d.id, d]))
}

/**
 * Resuelve **una** delegación a partir de un id, un código o un nombre
 * aproximado. Lanza si no hay ninguna coincidencia o si hay varias.
 */
export async function resolveDelegacion(
  admin: AdminClient,
  entrada: string,
): Promise<DelegacionPublica> {
  return encontrarDelegacion(await listDelegaciones(admin), entrada)
}

/**
 * El emparejamiento en sí, separado de la consulta para poder probarlo con una
 * lista de delegaciones cualquiera.
 */
export function encontrarDelegacion(
  todas: DelegacionPublica[],
  entrada: string,
): DelegacionPublica {
  const texto = (entrada ?? "").trim()
  if (!texto) throw badRequest("Falta la delegación.")

  if (esUuid(texto)) {
    const porId = todas.find((d) => d.id === texto)
    if (porId) return porId
    throw notFound(`No existe ninguna delegación con el id ${texto}.`)
  }

  const clave = claveBusqueda(texto)

  // 1) Código exacto (MCM-SEV, SEV…) — lo más preciso.
  const porCodigo = todas.filter((d) => d.codigo && normalizar(d.codigo) === normalizar(texto))
  if (porCodigo.length === 1) return porCodigo[0]

  // 2) Nombre exacto (ya sin acentos ni "delegación de").
  const porNombre = todas.filter((d) => claveBusqueda(d.nombre) === clave)
  if (porNombre.length === 1) return porNombre[0]
  if (porNombre.length > 1) throw ambiguo(texto, porNombre)

  // 3) Coincidencia parcial: "sevilla" encuentra "Sevilla Este".
  const parciales = todas.filter((d) => {
    const nombre = claveBusqueda(d.nombre)
    const codigo = d.codigo ? normalizar(d.codigo) : ""
    return nombre.includes(clave) || clave.includes(nombre) || (codigo && codigo.includes(clave))
  })
  if (parciales.length === 1) return parciales[0]
  if (parciales.length > 1) throw ambiguo(texto, parciales)

  throw notFound(
    `No encuentro ninguna delegación que se parezca a "${texto}".`,
    { delegaciones_disponibles: todas.map((d) => d.nombre) },
  )
}

function ambiguo(texto: string, candidatos: DelegacionPublica[]) {
  return badRequest(
    `"${texto}" coincide con ${candidatos.length} delegaciones. Concreta cuál usando el nombre completo o el id.`,
    { candidatos: candidatos.map((d) => ({ id: d.id, codigo: d.codigo, nombre: d.nombre })) },
  )
}

/**
 * Resuelve una lista de delegaciones. `undefined`, `null` o lista vacía
 * significan **todas** las delegaciones (el caso normal para un admin
 * multidelegación: "búscame movimientos de Mercadona en todas").
 *
 * Devuelve `null` cuando el ámbito es "todas", para que quien consulte pueda
 * omitir el filtro por delegación en la query en vez de enumerar 18 ids.
 */
export async function resolveAmbitoDelegaciones(
  admin: AdminClient,
  entrada?: string | string[] | null,
): Promise<DelegacionPublica[] | null> {
  if (entrada == null) return null
  const lista = Array.isArray(entrada) ? entrada : [entrada]
  const limpias = lista.map((x) => String(x ?? "").trim()).filter(Boolean)
  if (limpias.length === 0) return null

  const resueltas: DelegacionPublica[] = []
  for (const item of limpias) {
    const delegacion = await resolveDelegacion(admin, item)
    if (!resueltas.some((d) => d.id === delegacion.id)) resueltas.push(delegacion)
  }
  return resueltas
}
