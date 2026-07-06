import { getDrive, getSheets, type OAuth2Client } from "./google"

/**
 * Lógica de la memoria económica anual: contexto de datos, mapeo por defecto,
 * cálculo de valores y escritura en Google Sheets.
 * SOLO servidor (recibe el cliente Supabase del servidor).
 */

// ---------- Tipos ----------

export type Capitulo = "I" | "II" | "III" | "IV" | "V" | "VI"
export type PeriodoTipo = "curso" | "natural"

export type FuenteCategoria = {
  tipo: "categoria"
  categoriaId: string
}
export type FuenteSaldo = {
  tipo: "saldo_inicial"
  cuentaTipo: "banco" | "caja"
}
export type FuenteLiteral = {
  tipo: "literal"
  valor: number
}
export type Fuente = FuenteCategoria | FuenteSaldo | FuenteLiteral

export interface MapeoFila {
  id: string
  capitulo: Capitulo
  fila: number // fila del template (1-indexed)
  descripcion: string
  /** Si true, escribe `descripcion` en la columna C (capítulos IV/V/VI). */
  escribirDescripcion: boolean
  /** Fuente del valor de la columna D (ingresos / saldo). */
  ingreso?: Fuente | null
  /** Fuente del valor de la columna E (gastos). */
  gasto?: Fuente | null
  /** Si false, la fila se elimina del documento generado. */
  enabled: boolean
}

export interface MapeoConfig {
  filas: MapeoFila[]
  /** Parent de actividades detectado (informativo). */
  actividadesParentId?: string | null
  actividadesParentNombre?: string | null
  /** Capítulos eliminados por completo (incl. cabecera). Solo V y VI. */
  capitulosExcluidos?: Capitulo[]
}

export interface ValorFila {
  ingreso?: number
  gasto?: number
}

export interface Aviso {
  tipo: "subcategoria" | "actividades_overflow" | "sin_actividades"
  mensaje: string
}

export interface CategoriaCatalogo {
  id: string
  nombre: string
  es_global: boolean
  esHija: boolean
}

/**
 * Validación del ejercicio: compara lo que recogerá el informe con la
 * realidad de la app (todos los movimientos del periodo, cuentas activas).
 * La cuenta es la misma que hace la plantilla: remanente + ingresos − gastos.
 */
export interface ResumenValidacion {
  /** Saldo real al inicio del periodo (solo cuentas activas). */
  remanenteBanco: number
  remanenteCaja: number
  remanenteReal: number
  /** Remanente que escribirá el informe (filas activas del capítulo I). */
  remanenteInforme: number
  /** Totales reales del periodo (todos los movimientos no ignorados). */
  realIngresos: number
  realGastos: number
  /** remanenteReal + realIngresos − realGastos = dinero real al cierre. */
  saldoFinalReal: number
  /** Totales que suma el informe (filas activas de capítulos II–VI). */
  informeIngresos: number
  informeGastos: number
  balanceEjercicio: number
  /** remanenteInforme + balanceEjercicio = F49 de la hoja generada. */
  disponibleFinal: number
  /** Movimientos del periodo que ninguna fila del informe recoge. */
  noRecogidoIngresos: number
  noRecogidoGastos: number
  noRecogidoMovs: number
  /** Importes contados en más de una fila (p. ej. madre + subcategoría). */
  dobleContadoIngresos: number
  dobleContadoGastos: number
  /** disponibleFinal − saldoFinalReal. */
  descuadre: number
  cuadra: boolean
}

export interface TextosInforme {
  titulo: string
  capituloI: string
  capituloIV: string
  saldoBanco: string
  saldoCaja: string
  balance: string
  remanente: string
}

export interface PreviewResultado {
  mapeo: MapeoConfig
  valores: Record<string, ValorFila>
  avisos: Aviso[]
  resumen: ResumenValidacion
  textos: TextosInforme
  periodo: { inicio: string; fin: string; label: string }
  categorias: CategoriaCatalogo[]
}

// ---------- Utilidades ----------

function norm(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
}

export function cursoLabel(anio: number): string {
  return `${anio}-${anio + 1}`
}
function cursoShort(anio: number): string {
  return `${String(anio).slice(2)}-${String(anio + 1).slice(2)}`
}

export function periodoRango(periodoTipo: PeriodoTipo, anio: number) {
  if (periodoTipo === "curso") {
    return {
      inicio: `${anio}-09-01`,
      fin: `${anio + 1}-09-01`,
      label: cursoLabel(anio),
      labelHeader: cursoLabel(anio),
    }
  }
  return {
    inicio: `${anio}-01-01`,
    fin: `${anio + 1}-01-01`,
    label: String(anio),
    labelHeader: String(anio),
  }
}

function nombreCorto(nombre: string): string {
  return nombre.replace(/^MCM\s+/i, "").trim()
}

// ---------- Contexto de datos ----------

interface CategoriaRow {
  id: string
  nombre: string
  es_global: boolean
  orden: number | null
  esta_activa: boolean
  delegacion_id: string | null
  categoria_padre_id: string | null
}
interface MovRow {
  cuenta_id: string | null
  fecha: string
  importe: number
  categoria_id: string | null
}

export interface MemoriaContext {
  delegacionId: string
  delegacionNombre: string
  periodoTipo: PeriodoTipo
  anio: number
  rango: ReturnType<typeof periodoRango>
  categorias: CategoriaRow[]
  catById: Map<string, CategoriaRow>
  childrenByParent: Map<string, CategoriaRow[]>
  cuentaTipoById: Map<string, "banco" | "caja">
  movs: MovRow[]
}

async function fetchAllMovimientos(supabase: any, delegacionId: string, finISO: string): Promise<MovRow[]> {
  const all: MovRow[] = []
  const pageSize = 1000
  let from = 0
  for (;;) {
    const { data, error } = await supabase
      .from("movimiento")
      .select("cuenta_id, fecha, importe, categoria_id, ignorado")
      .eq("delegacion_id", delegacionId)
      .lt("fecha", finISO)
      .range(from, from + pageSize - 1)
    if (error) throw error
    const rows = (data || []).filter((r: any) => !r.ignorado)
    for (const r of rows) {
      all.push({
        cuenta_id: r.cuenta_id,
        fecha: r.fecha,
        importe: Number(r.importe) || 0,
        categoria_id: r.categoria_id,
      })
    }
    if (!data || data.length < pageSize) break
    from += pageSize
  }
  return all
}

export async function buildContext(
  supabase: any,
  delegacionId: string,
  periodoTipo: PeriodoTipo,
  anio: number,
): Promise<MemoriaContext> {
  const rango = periodoRango(periodoTipo, anio)

  const { data: deleg, error: delegErr } = await supabase
    .from("delegacion")
    .select("nombre")
    .eq("id", delegacionId)
    .maybeSingle()
  if (delegErr) throw delegErr

  const { data: catData, error: catErr } = await supabase
    .from("categoria")
    .select("id, nombre, es_global, orden, esta_activa, delegacion_id, categoria_padre_id")
    .or(`es_global.eq.true,delegacion_id.eq.${delegacionId}`)
  if (catErr) throw catErr
  const categorias = (catData || []) as CategoriaRow[]

  const { data: cuentaData, error: cuentaErr } = await supabase
    .from("cuenta")
    .select("id, tipo, activa")
    .eq("delegacion_id", delegacionId)
  if (cuentaErr) throw cuentaErr

  const catById = new Map<string, CategoriaRow>()
  const childrenByParent = new Map<string, CategoriaRow[]>()
  for (const c of categorias) {
    catById.set(c.id, c)
    if (c.categoria_padre_id) {
      const arr = childrenByParent.get(c.categoria_padre_id) || []
      arr.push(c)
      childrenByParent.set(c.categoria_padre_id, arr)
    }
  }

  // Solo cuentas activas: el dashboard también las excluye (join con cuenta,
  // activa=true), así el informe cuadra con lo que el usuario ve en la app.
  const cuentaTipoById = new Map<string, "banco" | "caja">()
  for (const c of cuentaData || []) {
    if (c.activa === false) continue
    cuentaTipoById.set(c.id, c.tipo === "caja" ? "caja" : "banco")
  }

  const movsAll = await fetchAllMovimientos(supabase, delegacionId, rango.fin)
  const movs = movsAll.filter((m) => m.cuenta_id && cuentaTipoById.has(m.cuenta_id))

  return {
    delegacionId,
    delegacionNombre: deleg?.nombre || "",
    periodoTipo,
    anio,
    rango,
    categorias,
    catById,
    childrenByParent,
    cuentaTipoById,
    movs,
  }
}

// ---------- Cálculo ----------

function descendantIds(ctx: MemoriaContext, catId: string): Set<string> {
  const ids = new Set<string>([catId])
  const stack = [catId]
  while (stack.length) {
    const cur = stack.pop()!
    for (const child of ctx.childrenByParent.get(cur) || []) {
      if (!ids.has(child.id)) {
        ids.add(child.id)
        stack.push(child.id)
      }
    }
  }
  return ids
}

function enPeriodo(ctx: MemoriaContext, fecha: string): boolean {
  return fecha >= ctx.rango.inicio && fecha < ctx.rango.fin
}

/** Ingresos/gastos de una categoría (+descendientes) en el periodo. */
function sumaCategoria(ctx: MemoriaContext, catId: string): { ingreso: number; gasto: number } {
  const ids = descendantIds(ctx, catId)
  let ingreso = 0
  let gasto = 0
  for (const m of ctx.movs) {
    if (!m.categoria_id || !ids.has(m.categoria_id)) continue
    if (!enPeriodo(ctx, m.fecha)) continue
    if (m.importe >= 0) ingreso += m.importe
    else gasto += -m.importe
  }
  return { ingreso, gasto }
}

/** Saldo inicial (a fecha de corte) de las cuentas de un tipo. */
function saldoInicial(ctx: MemoriaContext, cuentaTipo: "banco" | "caja"): number {
  let saldo = 0
  for (const m of ctx.movs) {
    if (!m.cuenta_id) continue
    if (ctx.cuentaTipoById.get(m.cuenta_id) !== cuentaTipo) continue
    if (m.fecha < ctx.rango.inicio) saldo += m.importe
  }
  return saldo
}

function valorFuente(ctx: MemoriaContext, fuente: Fuente, columna: "ingreso" | "gasto"): number {
  if (fuente.tipo === "literal") return fuente.valor
  if (fuente.tipo === "saldo_inicial") return saldoInicial(ctx, fuente.cuentaTipo)
  const { ingreso, gasto } = sumaCategoria(ctx, fuente.categoriaId)
  return columna === "ingreso" ? ingreso : gasto
}

// ---------- Detección de actividades ----------

function detectActividadesParent(ctx: MemoriaContext): CategoriaRow | null {
  const candidatos = ctx.categorias.filter((c) => norm(c.nombre).startsWith("actividades"))
  if (candidatos.length === 0) return null
  const tokens = [
    cursoShort(ctx.anio),
    cursoLabel(ctx.anio),
    String(ctx.anio),
    String(ctx.anio + 1),
  ].map(norm)
  let best: CategoriaRow | null = null
  let bestScore = -1
  for (const c of candidatos) {
    const n = norm(c.nombre)
    let score = 0
    for (const t of tokens) if (t && n.includes(t)) score += 2
    // preferir los que tienen hijos en esta delegación
    const hijos = (ctx.childrenByParent.get(c.id) || []).filter(
      (h) => h.delegacion_id === ctx.delegacionId,
    )
    if (hijos.length > 0) score += 1
    if (score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

function actividadesDeDelegacion(ctx: MemoriaContext, parentId: string): CategoriaRow[] {
  const hijos = (ctx.childrenByParent.get(parentId) || []).filter(
    (h) => h.esta_activa && (h.delegacion_id === ctx.delegacionId || h.es_global),
  )
  return hijos.sort((a, b) => {
    const oa = a.orden ?? 9999
    const ob = b.orden ?? 9999
    if (oa !== ob) return oa - ob
    return a.nombre.localeCompare(b.nombre, "es")
  })
}

// ---------- Mapeo por defecto ----------

const GASTOS_FUNCIONAMIENTO: { fila: number; nombre: string }[] = [
  { fila: 13, nombre: "Compras Material" },
  { fila: 14, nombre: "Compras Inversión" },
  { fila: 15, nombre: "Comidas, dietas, viajes y eventos" },
  { fila: 16, nombre: "Formación" },
  { fila: 17, nombre: "Suministros" },
  { fila: 18, nombre: "Software y suscripciones" },
  { fila: 19, nombre: "Seguros" },
  { fila: 20, nombre: "Comisiones bancos" },
  { fila: 21, nombre: "Otros" },
]

// Filas disponibles por capítulo en el template
export const FILAS_ACTIVIDADES = [23, 24, 25, 26, 27, 28, 29, 30, 31, 32]
export const FILAS_CAMPANAS = [34, 35, 36, 37, 38]
/** Fila fija "Donativo total realizado" del capítulo V (gasto en E39). */
export const FILA_DONATIVO = 39
export const FILAS_CAP6 = [41, 42, 43]

// Rango COMPLETO de cada capítulo opcional (cabecera + contenido + subtotal).
// Si el capítulo se excluye, se eliminan TODAS estas filas del documento.
export const CAP_RANGES: Partial<Record<Capitulo, number[]>> = {
  V: [33, 34, 35, 36, 37, 38, 39],
  VI: [40, 41, 42, 43],
}

function wordTokens(s: string): string[] {
  return norm(s)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2)
}

/**
 * Busca la categoría que mejor encaja con un nombre del template.
 * Exacto → uno prefijo del otro → solapamiento de palabras significativas.
 * Tolera diferencias como "Comidas, dietas, viajes y eventos" vs
 * "Comidas, dietas y viajes".
 */
function findCatByName(ctx: MemoriaContext, nombre: string): CategoriaRow | undefined {
  const n = norm(nombre)
  // 1. exacto (global primero)
  const exact =
    ctx.categorias.find((c) => c.es_global && norm(c.nombre) === n) ||
    ctx.categorias.find((c) => norm(c.nombre) === n)
  if (exact) return exact

  // 2. prefijo en cualquier dirección
  const prefix = ctx.categorias.find((c) => {
    const cn = norm(c.nombre)
    return cn.startsWith(n) || n.startsWith(cn)
  })
  if (prefix) return prefix

  // 3. solapamiento de palabras (mejor puntuación, exige primera palabra común)
  const targetTokens = wordTokens(nombre)
  if (targetTokens.length === 0) return undefined
  let best: CategoriaRow | undefined
  let bestScore = 0
  for (const c of ctx.categorias) {
    const ct = wordTokens(c.nombre)
    if (ct.length === 0 || ct[0] !== targetTokens[0]) continue
    const shared = targetTokens.filter((t) => ct.includes(t)).length
    const score = shared / Math.max(targetTokens.length, ct.length)
    if (shared >= 2 && score > bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

export function buildDefaultMapeo(ctx: MemoriaContext): MapeoConfig {
  const filas: MapeoFila[] = []

  // Cap I — saldos
  filas.push({
    id: "cap1-banco",
    capitulo: "I",
    fila: 4,
    descripcion: "Saldo Cuenta Bancaria",
    escribirDescripcion: false,
    ingreso: { tipo: "saldo_inicial", cuentaTipo: "banco" },
    enabled: true,
  })
  filas.push({
    id: "cap1-caja",
    capitulo: "I",
    fila: 5,
    descripcion: "Saldo Caja",
    escribirDescripcion: false,
    ingreso: { tipo: "saldo_inicial", cuentaTipo: "caja" },
    enabled: true,
  })

  // Cap II — cuotas y subvenciones
  // Cada fila del template calcula F = D − E, así que todas las filas de
  // categoría suman AMBOS lados (entradas en D y salidas en E). Si no, los
  // abonos/devoluciones se pierden y el informe no cuadra con las cuentas.
  const cuotasMic = findCatByName(ctx, "Cuotas MIC-COM")
  const cuotasCom = findCatByName(ctx, "Cuotas COM-LC +18")
  const cuotaEce = findCatByName(ctx, "Cuota anual enviada al ECE")
  const ambos = (cat: CategoriaRow | undefined): Pick<MapeoFila, "ingreso" | "gasto"> => ({
    ingreso: cat ? { tipo: "categoria", categoriaId: cat.id } : null,
    gasto: cat ? { tipo: "categoria", categoriaId: cat.id } : null,
  })
  filas.push({
    id: "cap2-miccom",
    capitulo: "II",
    fila: 7,
    descripcion: "Cuotas - MIC y COM",
    escribirDescripcion: false,
    ...ambos(cuotasMic),
    enabled: true,
  })
  filas.push({
    id: "cap2-comlc",
    capitulo: "II",
    fila: 8,
    descripcion: "Cuotas - COM y LC +18",
    escribirDescripcion: false,
    ...ambos(cuotasCom),
    enabled: true,
  })
  filas.push({
    id: "cap2-ece",
    capitulo: "II",
    fila: 10,
    descripcion: "Cuota anual enviada al ECE",
    escribirDescripcion: false,
    ...ambos(cuotaEce),
    enabled: true,
  })

  // Cap III — gastos funcionamiento
  for (const g of GASTOS_FUNCIONAMIENTO) {
    const cat = findCatByName(ctx, g.nombre)
    filas.push({
      id: `cap3-${g.fila}`,
      capitulo: "III",
      fila: g.fila,
      descripcion: g.nombre,
      escribirDescripcion: false,
      ...ambos(cat),
      enabled: true,
    })
  }

  // Cap IV — actividades
  const parent = detectActividadesParent(ctx)
  const actividades = parent ? actividadesDeDelegacion(ctx, parent.id) : []
  FILAS_ACTIVIDADES.forEach((fila, idx) => {
    const act = actividades[idx]
    filas.push({
      id: `cap4-${fila}`,
      capitulo: "IV",
      fila,
      descripcion: act?.nombre ?? "",
      escribirDescripcion: true,
      ingreso: act ? { tipo: "categoria", categoriaId: act.id } : null,
      gasto: act ? { tipo: "categoria", categoriaId: act.id } : null,
      enabled: !!act, // filas sin actividad se eliminan por defecto
    })
  })

  // Cap V — campañas solidarias (vacías por defecto, el usuario las rellena)
  FILAS_CAMPANAS.forEach((fila) => {
    filas.push({
      id: `cap5-${fila}`,
      capitulo: "V",
      fila,
      descripcion: "",
      escribirDescripcion: true,
      enabled: false,
    })
  })
  // Fila fija del template "Donativo total realizado" (solo gasto, E39).
  filas.push({
    id: `cap5-${FILA_DONATIVO}`,
    capitulo: "V",
    fila: FILA_DONATIVO,
    descripcion: "Donativo total realizado",
    escribirDescripcion: false,
    gasto: null,
    enabled: false,
  })

  // Cap VI — otros (vacío por defecto)
  FILAS_CAP6.forEach((fila) => {
    filas.push({
      id: `cap6-${fila}`,
      capitulo: "VI",
      fila,
      descripcion: "",
      escribirDescripcion: true,
      enabled: false,
    })
  })

  return {
    filas,
    actividadesParentId: parent?.id ?? null,
    actividadesParentNombre: parent?.nombre ?? null,
    // Campañas (V) y Otros (VI) van desactivados de inicio; el usuario los activa.
    capitulosExcluidos: ["V", "VI"],
  }
}

// ---------- Preview (valores + avisos) ----------

export function computeValores(ctx: MemoriaContext, mapeo: MapeoConfig): {
  valores: Record<string, ValorFila>
  avisos: Aviso[]
} {
  const valores: Record<string, ValorFila> = {}
  const avisos: Aviso[] = []
  const avisosCats = new Set<string>()

  for (const fila of mapeo.filas) {
    if (!fila.enabled) continue
    const v: ValorFila = {}
    if (fila.ingreso) v.ingreso = valorFuente(ctx, fila.ingreso, "ingreso")
    if (fila.gasto) v.gasto = valorFuente(ctx, fila.gasto, "gasto")
    valores[fila.id] = v

    // Aviso de subcategorías con movimientos
    for (const fuente of [fila.ingreso, fila.gasto]) {
      if (fuente && fuente.tipo === "categoria") {
        const hijos = ctx.childrenByParent.get(fuente.categoriaId) || []
        if (hijos.length > 0 && !avisosCats.has(fuente.categoriaId)) {
          const tieneMovs = hijos.some((h) => {
            const ids = descendantIds(ctx, h.id)
            return ctx.movs.some(
              (m) => m.categoria_id && ids.has(m.categoria_id) && enPeriodo(ctx, m.fecha),
            )
          })
          if (tieneMovs) {
            avisosCats.add(fuente.categoriaId)
            const cat = ctx.catById.get(fuente.categoriaId)
            avisos.push({
              tipo: "subcategoria",
              mensaje: `La categoría "${cat?.nombre ?? ""}" tiene subcategorías con movimientos. Revisa que el importe agregado sea correcto.`,
            })
          }
        }
      }
    }
  }

  return { valores, avisos }
}

/**
 * Valida el ejercicio: remanente + entradas − salidas del informe frente al
 * dinero real de las cuentas. También detecta movimientos que ninguna fila
 * recoge y los contados dos veces (madre + subcategoría en filas distintas).
 */
export function computeResumen(
  ctx: MemoriaContext,
  mapeo: MapeoConfig,
  valores: Record<string, ValorFila>,
): ResumenValidacion {
  const excluidos = new Set<Capitulo>(mapeo.capitulosExcluidos ?? [])
  const activa = (f: MapeoFila) => f.enabled && !excluidos.has(f.capitulo)

  const remanenteBanco = saldoInicial(ctx, "banco")
  const remanenteCaja = saldoInicial(ctx, "caja")
  const remanenteReal = remanenteBanco + remanenteCaja

  let realIngresos = 0
  let realGastos = 0
  for (const m of ctx.movs) {
    if (!enPeriodo(ctx, m.fecha)) continue
    if (m.importe >= 0) realIngresos += m.importe
    else realGastos += -m.importe
  }

  // Totales del informe + cuántas filas recogen cada categoría (por columna)
  let remanenteInforme = 0
  let informeIngresos = 0
  let informeGastos = 0
  const ingresoCount = new Map<string, number>()
  const gastoCount = new Map<string, number>()
  for (const f of mapeo.filas) {
    if (!activa(f)) continue
    const v = valores[f.id] || {}
    if (f.capitulo === "I") {
      remanenteInforme += v.ingreso ?? 0
      continue
    }
    informeIngresos += v.ingreso ?? 0
    informeGastos += v.gasto ?? 0
    if (f.ingreso?.tipo === "categoria") {
      for (const id of descendantIds(ctx, f.ingreso.categoriaId)) {
        ingresoCount.set(id, (ingresoCount.get(id) ?? 0) + 1)
      }
    }
    if (f.gasto?.tipo === "categoria") {
      for (const id of descendantIds(ctx, f.gasto.categoriaId)) {
        gastoCount.set(id, (gastoCount.get(id) ?? 0) + 1)
      }
    }
  }

  let noRecogidoIngresos = 0
  let noRecogidoGastos = 0
  let noRecogidoMovs = 0
  let dobleContadoIngresos = 0
  let dobleContadoGastos = 0
  for (const m of ctx.movs) {
    if (!enPeriodo(ctx, m.fecha)) continue
    const esIngreso = m.importe >= 0
    const counts = esIngreso ? ingresoCount : gastoCount
    const veces = m.categoria_id ? counts.get(m.categoria_id) ?? 0 : 0
    const abs = Math.abs(m.importe)
    if (veces === 0) {
      noRecogidoMovs++
      if (esIngreso) noRecogidoIngresos += abs
      else noRecogidoGastos += abs
    } else if (veces > 1) {
      if (esIngreso) dobleContadoIngresos += (veces - 1) * abs
      else dobleContadoGastos += (veces - 1) * abs
    }
  }

  const balanceEjercicio = informeIngresos - informeGastos
  const disponibleFinal = remanenteInforme + balanceEjercicio
  const saldoFinalReal = remanenteReal + realIngresos - realGastos
  const descuadre = disponibleFinal - saldoFinalReal

  return {
    remanenteBanco,
    remanenteCaja,
    remanenteReal,
    remanenteInforme,
    realIngresos,
    realGastos,
    saldoFinalReal,
    informeIngresos,
    informeGastos,
    balanceEjercicio,
    disponibleFinal,
    noRecogidoIngresos,
    noRecogidoGastos,
    noRecogidoMovs,
    dobleContadoIngresos,
    dobleContadoGastos,
    descuadre,
    cuadra: Math.abs(descuadre) < 0.005,
  }
}

export function buildPreview(ctx: MemoriaContext, mapeoEntrada?: MapeoConfig | null): PreviewResultado {
  const mapeo = mapeoEntrada ?? buildDefaultMapeo(ctx)
  const { valores, avisos } = computeValores(ctx, mapeo)

  // Aviso de overflow de actividades
  const parent = mapeo.actividadesParentId
  if (parent) {
    const total = actividadesDeDelegacion(ctx, parent).length
    if (total === 0) {
      avisos.push({ tipo: "sin_actividades", mensaje: "No se detectaron actividades para este periodo." })
    } else if (total > FILAS_ACTIVIDADES.length) {
      avisos.push({
        tipo: "actividades_overflow",
        mensaje: `Hay ${total} actividades y solo ${FILAS_ACTIVIDADES.length} filas en la plantilla. Revisa el documento generado y añade filas si es necesario.`,
      })
    }
  }

  const corto = nombreCorto(ctx.delegacionNombre)
  const esCurso = ctx.periodoTipo === "curso"
  const palabra = esCurso ? "CURSO" : "AÑO"
  const palabraMin = esCurso ? "curso" : "año"
  const fechaSaldo = esCurso ? "1 septiembre" : "1 enero"
  const textos: TextosInforme = {
    titulo: `MCM ${corto} · Balance Económico · ${esCurso ? "Curso " : "Año "}${ctx.rango.label}`,
    capituloI: `CAPÍTULO I - SALDOS ${palabra} ANTERIOR`,
    capituloIV: `CAPÍTULO IV - ACTIVIDADES ${ctx.rango.labelHeader}`,
    saldoBanco: `Saldo Cuenta Bancaria - ${fechaSaldo}`,
    saldoCaja: `Saldo Caja - ${fechaSaldo}`,
    balance: `BALANCE ${palabra} ${ctx.rango.label}\n(sin remanente ${palabraMin} anterior)`,
    remanente: `INCORPORANDO REMANENTE DEL ${palabra} ANTERIOR`,
  }

  const categorias: CategoriaCatalogo[] = ctx.categorias
    .filter((c) => c.esta_activa)
    .map((c) => ({
      id: c.id,
      nombre: c.nombre,
      es_global: c.es_global,
      esHija: !!c.categoria_padre_id,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))

  return {
    mapeo,
    valores,
    avisos,
    resumen: computeResumen(ctx, mapeo, valores),
    textos,
    periodo: { inicio: ctx.rango.inicio, fin: ctx.rango.fin, label: ctx.rango.label },
    categorias,
  }
}

// ---------- Generación en Google Sheets ----------

export interface GenerarResultado {
  spreadsheetId: string
  webViewLink: string | null
  titulo: string
  /** Remanente del curso anterior leído de la celda F3. */
  remanente: number | null
  /** Balance anual leído de la celda F46 del documento generado. */
  balanceAnual: number | null
  /** Disponible final de año leído de la celda F49. */
  disponibleFinal: number | null
  /** Validación calculada con los datos de la app. */
  resumen: ResumenValidacion
  /** true si F46/F49 de la hoja coinciden con lo esperado por la app. */
  cuadraConHoja: boolean
}

export async function generarSheet(
  client: OAuth2Client,
  opts: {
    templateId: string
    ctx: MemoriaContext
    mapeo: MapeoConfig
    titulo: string
  },
): Promise<GenerarResultado> {
  const { templateId, ctx, mapeo, titulo } = opts
  const drive = getDrive(client)
  const sheets = getSheets(client)

  // 1. Copiar plantilla a "Mi unidad" del usuario.
  //    `parents: ["root"]` fuerza el destino a Mi unidad. Sin esto, al copiar un
  //    archivo de una unidad compartida la copia se intenta crear en esa misma
  //    unidad, y si el usuario no tiene rol de creación allí Drive devuelve 403.
  const fechaGen = new Intl.DateTimeFormat("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date())
  const copy = await drive.files.copy({
    fileId: templateId,
    requestBody: {
      name: titulo,
      parents: ["root"],
      description: `Generado desde MCM Bank el ${fechaGen}`,
    },
    fields: "id",
    supportsAllDrives: true,
  })
  const spreadsheetId = copy.data.id!
  if (!spreadsheetId) throw new Error("No se pudo copiar la plantilla")

  // sheetId (gid) de la primera hoja
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" })
  const sheetId = meta.data.sheets?.[0]?.properties?.sheetId ?? 0

  const preview = buildPreview(ctx, mapeo)
  const excluidos = new Set<Capitulo>(mapeo.capitulosExcluidos ?? [])

  // 2. Preparar valores (saltando capítulos excluidos por completo)
  const updates: { range: string; values: any[][] }[] = []
  updates.push({ range: "C1", values: [[preview.textos.titulo]] })
  updates.push({ range: "A3", values: [[preview.textos.capituloI]] })
  updates.push({ range: "C4", values: [[preview.textos.saldoBanco]] })
  updates.push({ range: "C5", values: [[preview.textos.saldoCaja]] })
  updates.push({ range: "A22", values: [[preview.textos.capituloIV]] })
  updates.push({ range: "C45", values: [[preview.textos.balance]] })
  updates.push({ range: "C48", values: [[preview.textos.remanente]] })

  // Corrección de fórmulas del template: D46 original suma también D3 (los
  // saldos del curso anterior), con lo que F46 ("balance sin remanente") SÍ
  // incluía el remanente y F49 (= F3 + F46) lo contaba DOS veces. Se reescriben
  // los totales para que sumen solo los capítulos II–VI y todo cuadre:
  //   F46 = balance del ejercicio · F49 = remanente + balance = disponible.
  updates.push({ range: "D46", values: [["=D6+D12+D22+D33+D40"]] })
  updates.push({ range: "E46", values: [["=E6+E12+E22+E33+E40"]] })

  // Si el capítulo V va incluido, limpiar el placeholder "XXXXXXXX" de D39
  // (fila "Donativo total realizado": su importe va como gasto en E39).
  if (!excluidos.has("V")) {
    updates.push({ range: `D${FILA_DONATIVO}`, values: [[""]] })
  }

  for (const fila of mapeo.filas) {
    if (!fila.enabled || excluidos.has(fila.capitulo)) continue
    const v = preview.valores[fila.id] || {}
    if (fila.escribirDescripcion && fila.descripcion) {
      updates.push({ range: `C${fila.fila}`, values: [[fila.descripcion]] })
    }
    // Los ceros no se escriben: en el template la celda vacía ya vale 0 para
    // las fórmulas y el documento queda más limpio (salvo los saldos del
    // capítulo I, que se muestran siempre aunque sean 0).
    const esSaldo = fila.capitulo === "I"
    if (fila.ingreso && typeof v.ingreso === "number" && (esSaldo || Math.abs(v.ingreso) >= 0.005)) {
      updates.push({ range: `D${fila.fila}`, values: [[v.ingreso]] })
    }
    if (fila.gasto && typeof v.gasto === "number" && (esSaldo || Math.abs(v.gasto) >= 0.005)) {
      updates.push({ range: `E${fila.fila}`, values: [[v.gasto]] })
    }
  }

  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: { valueInputOption: "USER_ENTERED", data: updates },
  })

  // 3. Renombrar pestaña + OCULTAR las filas sobrantes (no eliminarlas).
  //    Ocultar en vez de borrar evita romper las fórmulas de totales/balance que
  //    referencian celdas concretas (#REF!). Las filas ocultas no aparecen al
  //    exportar a PDF, así que el resultado es el mismo de cara al documento.
  //    Se ocultan: filas deshabilitadas y los rangos completos (cabecera incluida)
  //    de los capítulos excluidos.
  const tabTitle = ctx.periodoTipo === "curso" ? `Curso ${cursoLabel(ctx.anio)}` : `Año ${ctx.anio}`
  const requests: any[] = [
    { updateSheetProperties: { properties: { sheetId, title: tabTitle }, fields: "title" } },
  ]

  const aOcultar = new Set<number>()
  for (const f of mapeo.filas) if (!f.enabled) aOcultar.add(f.fila)
  for (const cap of excluidos) for (const fila of CAP_RANGES[cap] ?? []) aOcultar.add(fila)
  for (const fila of aOcultar) {
    requests.push({
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: fila - 1, endIndex: fila },
        properties: { hiddenByUser: true },
        fields: "hiddenByUser",
      },
    })
  }

  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } })

  // 4. Leer totales calculados (F3 = remanente, F46 = balance, F49 = disponible)
  let remanente: number | null = null
  let balanceAnual: number | null = null
  let disponibleFinal: number | null = null
  try {
    const vals = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: ["F3", "F46", "F49"],
      valueRenderOption: "UNFORMATTED_VALUE",
    })
    const ranges = vals.data.valueRanges ?? []
    const f3 = ranges[0]?.values?.[0]?.[0]
    const f46 = ranges[1]?.values?.[0]?.[0]
    const f49 = ranges[2]?.values?.[0]?.[0]
    if (typeof f3 === "number") remanente = f3
    if (typeof f46 === "number") balanceAnual = f46
    if (typeof f49 === "number") disponibleFinal = f49
  } catch {
    // no bloqueante: si no se pueden leer, se dejan en null
  }

  // 5. Verificar que la hoja calcula lo mismo que la app
  const resumen = preview.resumen
  const cuadraConHoja =
    balanceAnual !== null &&
    disponibleFinal !== null &&
    Math.abs(balanceAnual - resumen.balanceEjercicio) < 0.01 &&
    Math.abs(disponibleFinal - resumen.disponibleFinal) < 0.01

  // 6. Enlace
  const file = await drive.files.get({
    fileId: spreadsheetId,
    fields: "webViewLink",
    supportsAllDrives: true,
  })

  return {
    spreadsheetId,
    webViewLink: file.data.webViewLink ?? null,
    titulo,
    remanente,
    balanceAnual,
    disponibleFinal,
    resumen,
    cuadraConHoja,
  }
}
