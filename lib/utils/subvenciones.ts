import {
  Ban,
  BadgeCheck,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  FileCheck2,
  PenLine,
  PieChart,
  Send,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import {
  FINANCIADOR_AMBITOS,
  type FinanciadorAmbito,
  type Subvencion,
  type SubvencionConResumen,
  type SubvencionEstado,
} from "@/lib/types/database"

export { FINANCIADOR_AMBITOS, SUBVENCION_ESTADOS, esSubvencionEstado } from "@/lib/types/database"

/**
 * Subvenciones: lógica pura (sin Supabase) para la pantalla, la acción en lote
 * de Movimientos y la API externa.
 */

/** En qué punto del camino está: sirve para filtrar y para los totales. */
export type SubvencionFase = "pendiente" | "en_curso" | "cerrada" | "descartada"

export interface SubvencionEstadoInfo {
  value: SubvencionEstado
  /** El número del Excel: el orden del camino. */
  paso: number
  label: string
  descripcion: string
  fase: SubvencionFase
  icon: LucideIcon
  dotClass: string
  bgClass: string
  textClass: string
  borderClass: string
}

// Los colores siguen los del desplegable del Excel (gris → amarillo → naranja →
// verde → azul → verde oscuro → teal), para que quien viene de allí los
// reconozca sin leer. Siempre con icono y texto: el color nunca va solo.
export const SUBVENCION_ESTADO_INFO: Record<SubvencionEstado, SubvencionEstadoInfo> = {
  no_convocada: {
    value: "no_convocada",
    paso: 1,
    label: "No convocada",
    descripcion: "Todavía no ha salido la convocatoria de este año.",
    fase: "pendiente",
    icon: CircleDashed,
    dotClass: "bg-slate-400",
    bgClass: "bg-muted/60",
    textClass: "text-muted-foreground",
    borderClass: "border-border",
  },
  por_solicitar: {
    value: "por_solicitar",
    paso: 2,
    label: "Por solicitar",
    descripcion: "Convocada: hay que preparar y presentar la solicitud.",
    fase: "pendiente",
    icon: PenLine,
    dotClass: "bg-yellow-400",
    bgClass: "bg-yellow-50 dark:bg-yellow-950/30",
    textClass: "text-yellow-800 dark:text-yellow-200",
    borderClass: "border-yellow-300/70 dark:border-yellow-900/60",
  },
  solicitada: {
    value: "solicitada",
    paso: 3,
    label: "Solicitada",
    descripcion: "Presentada, esperando resolución.",
    fase: "en_curso",
    icon: Send,
    dotClass: "bg-orange-400",
    bgClass: "bg-orange-50 dark:bg-orange-950/30",
    textClass: "text-orange-800 dark:text-orange-200",
    borderClass: "border-orange-200/70 dark:border-orange-900/60",
  },
  concedida: {
    value: "concedida",
    paso: 4,
    label: "Concedida",
    descripcion: "Aceptada. Toca ejecutar el proyecto e ir imputando gastos.",
    fase: "en_curso",
    icon: BadgeCheck,
    dotClass: "bg-lime-500",
    bgClass: "bg-lime-50 dark:bg-lime-950/30",
    textClass: "text-lime-800 dark:text-lime-200",
    borderClass: "border-lime-200/70 dark:border-lime-900/60",
  },
  por_justificar: {
    value: "por_justificar",
    paso: 5,
    label: "Por justificar",
    descripcion: "El proyecto ya se hizo: falta presentar la justificación.",
    fase: "en_curso",
    icon: ClipboardList,
    dotClass: "bg-blue-600",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    textClass: "text-blue-800 dark:text-blue-200",
    borderClass: "border-blue-200/70 dark:border-blue-900/60",
  },
  justificada: {
    value: "justificada",
    paso: 6,
    label: "Justificada",
    descripcion: "Justificación presentada, esperando el cobro.",
    fase: "en_curso",
    icon: FileCheck2,
    dotClass: "bg-emerald-600",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    textClass: "text-emerald-800 dark:text-emerald-200",
    borderClass: "border-emerald-200/70 dark:border-emerald-900/60",
  },
  cobrada: {
    value: "cobrada",
    paso: 7,
    label: "Cobrada",
    descripcion: "Cobrada entera. Terminada.",
    fase: "cerrada",
    icon: CheckCircle2,
    dotClass: "bg-teal-700",
    bgClass: "bg-teal-50 dark:bg-teal-950/30",
    textClass: "text-teal-800 dark:text-teal-200",
    borderClass: "border-teal-300/70 dark:border-teal-900/60",
  },
  cobrada_parcial: {
    value: "cobrada_parcial",
    paso: 7,
    label: "Cobrada en parte",
    descripcion: "Cobrada, pero menos de lo concedido.",
    fase: "cerrada",
    icon: PieChart,
    dotClass: "bg-cyan-400",
    bgClass: "bg-cyan-50 dark:bg-cyan-950/30",
    textClass: "text-cyan-800 dark:text-cyan-200",
    borderClass: "border-cyan-200/70 dark:border-cyan-900/60",
  },
  rechazada: {
    value: "rechazada",
    paso: 7,
    label: "Rechazada",
    descripcion: "No nos la concedieron.",
    fase: "descartada",
    icon: XCircle,
    dotClass: "bg-red-600",
    bgClass: "bg-red-50 dark:bg-red-950/30",
    textClass: "text-red-700 dark:text-red-300",
    borderClass: "border-red-200/70 dark:border-red-900/60",
  },
  renuncia: {
    value: "renuncia",
    paso: 8,
    label: "Renunciamos",
    descripcion: "Decidimos no presentarnos o renunciar a ella.",
    fase: "descartada",
    icon: Ban,
    dotClass: "bg-slate-400",
    bgClass: "bg-muted/60",
    textClass: "text-muted-foreground",
    borderClass: "border-border",
  },
}

/** Estados con dinero comprometido: cuentan como "confirmado". */
export function cuentaComoConfirmada(estado: SubvencionEstado): boolean {
  return ["concedida", "por_justificar", "justificada", "cobrada", "cobrada_parcial"].includes(estado)
}

/** Se le pueden imputar gastos (una rechazada o renunciada no justifica nada). */
export function admiteGastos(estado: SubvencionEstado): boolean {
  return SUBVENCION_ESTADO_INFO[estado].fase !== "descartada"
}

// ---------------------------------------------------------------------------
// Financiadores: grupos y orden de la lista
// ---------------------------------------------------------------------------

export const FINANCIADOR_AMBITO_INFO: Record<FinanciadorAmbito, { label: string; ejemplo: string }> = {
  autonomico: { label: "Generalitat", ejemplo: "GVA IVAJ, GVA Inclusión" },
  provincial: { label: "Diputaciones", ejemplo: "Diputación CS" },
  local: { label: "Ayuntamientos", ejemplo: "Ayto CS, Ayto Onda" },
  estatal: { label: "Estatales", ejemplo: "Red.es, IRPF estatal" },
  europeo: { label: "Europeas", ejemplo: "Cuerpo Europeo de Solidaridad" },
  privado: { label: "Fundaciones y privadas", ejemplo: "Didania" },
  otro: { label: "Otras", ejemplo: "" },
}

export interface GrupoSubvenciones {
  ambito: FinanciadorAmbito
  label: string
  subvenciones: SubvencionConResumen[]
}

/**
 * Agrupa por ámbito del financiador (Generalitat arriba, lo local y lo raro
 * abajo, como en el Excel) y ordena dentro por el `orden` del financiador y
 * luego por código y nombre. Una subvención sin financiador va a "Otras".
 */
export function agruparPorAmbito(subvenciones: SubvencionConResumen[]): GrupoSubvenciones[] {
  const clave = (s: SubvencionConResumen) =>
    [
      String(s.financiador?.orden ?? 999).padStart(4, "0"),
      (s.financiador?.nombre ?? "").toLowerCase(),
      (s.codigo ?? "").toLowerCase(),
      s.nombre.toLowerCase(),
    ].join("\u0000")

  return FINANCIADOR_AMBITOS.map((ambito) => ({
    ambito,
    label: FINANCIADOR_AMBITO_INFO[ambito].label,
    subvenciones: subvenciones
      .filter((s) => (s.financiador?.ambito ?? "otro") === ambito)
      .sort((a, b) => clave(a).localeCompare(clave(b), "es")),
  })).filter((g) => g.subvenciones.length > 0)
}

// ---------------------------------------------------------------------------
// Totales de un ejercicio (la fila de abajo de cada bloque del Excel)
// ---------------------------------------------------------------------------

export interface TotalesEjercicio {
  /** Lo solicitado en todo lo que sigue vivo ("máximo posible"). */
  solicitado: number
  /** Lo concedido en las que tienen el dinero comprometido. */
  confirmado: number
  cobrado: number
  porCobrar: number
}

/**
 * Lo cobrado de una subvención: el importe cobrado si se ha apuntado, y si no,
 * lo concedido cuando el estado dice "cobrada" (en el Excel no había columna
 * de cobro, así que casi todas las históricas vienen así).
 */
export function importeCobrado(s: Pick<Subvencion, "estado" | "importe_cobrado" | "importe_concedido">): number {
  if (s.importe_cobrado != null) return s.importe_cobrado
  return s.estado === "cobrada" ? (s.importe_concedido ?? 0) : 0
}

export function totalesEjercicio(
  subvenciones: Pick<Subvencion, "estado" | "importe_solicitado" | "importe_concedido" | "importe_cobrado">[],
): TotalesEjercicio {
  let solicitado = 0
  let confirmado = 0
  let cobrado = 0
  for (const s of subvenciones) {
    if (SUBVENCION_ESTADO_INFO[s.estado].fase !== "descartada") solicitado += s.importe_solicitado ?? 0
    if (cuentaComoConfirmada(s.estado)) {
      confirmado += s.importe_concedido ?? 0
      cobrado += importeCobrado(s)
    }
  }
  const r = (n: number) => Math.round(n * 100) / 100
  return {
    solicitado: r(solicitado),
    confirmado: r(confirmado),
    cobrado: r(cobrado),
    porCobrar: r(Math.max(confirmado - cobrado, 0)),
  }
}

// ---------------------------------------------------------------------------
// Próxima fecha que importa
// ---------------------------------------------------------------------------

export interface FechaClave {
  etiqueta: string
  fecha: string
}

/**
 * La siguiente fecha que pide hacer algo, según el estado: el plazo de
 * solicitud mientras no se ha pedido, y las de justificación mientras no se ha
 * justificado. Solo fechas de hoy en adelante; `null` si no queda ninguna.
 */
export function proximaFecha(
  s: Pick<
    Subvencion,
    "estado" | "fecha_convocatoria" | "fecha_limite_solicitud" | "fecha_justificacion_1" | "fecha_justificacion_2"
  >,
  hoy: string,
): FechaClave | null {
  const candidatas: FechaClave[] = []
  const paso = SUBVENCION_ESTADO_INFO[s.estado].paso
  if (SUBVENCION_ESTADO_INFO[s.estado].fase === "descartada") return null
  if (paso <= 2) {
    if (s.fecha_convocatoria) candidatas.push({ etiqueta: "Convocatoria", fecha: s.fecha_convocatoria })
    if (s.fecha_limite_solicitud) candidatas.push({ etiqueta: "Límite para solicitar", fecha: s.fecha_limite_solicitud })
  }
  if (paso >= 3 && paso <= 5) {
    if (s.fecha_justificacion_1) candidatas.push({ etiqueta: "Justificación", fecha: s.fecha_justificacion_1 })
    if (s.fecha_justificacion_2) candidatas.push({ etiqueta: "2ª justificación", fecha: s.fecha_justificacion_2 })
  }
  return candidatas.filter((c) => c.fecha >= hoy).sort((a, b) => a.fecha.localeCompare(b.fecha))[0] ?? null
}

// ---------------------------------------------------------------------------
// Imputar: cuánto queda libre de cada movimiento
// ---------------------------------------------------------------------------

/** Medio céntimo: por debajo, dos importes son el mismo. */
const EPS = 0.005

export const redondear2 = (n: number) => Math.round(n * 100) / 100

export interface Imputacion {
  movimiento_id: string
  subvencion_id: string
  importe_imputado: number
}

/**
 * Lo que queda libre de un movimiento para `subvencionId`: su importe (en
 * positivo) menos lo imputado en **las demás** subvenciones. Lo que ya tenga
 * en esta no resta, porque es justo lo que se está editando.
 */
export function importeLibre(importeMovimiento: number, imputaciones: Imputacion[], subvencionId: string): number {
  const otras = imputaciones
    .filter((i) => i.subvencion_id !== subvencionId)
    .reduce((acc, i) => acc + i.importe_imputado, 0)
  return redondear2(Math.max(Math.abs(importeMovimiento) - otras, 0))
}

export interface RepartoAsignacion {
  /** Se imputarán, cada uno por lo que le queda libre. */
  aImputar: { id: string; importe: number; parcial: boolean }[]
  /** Ya estaban en la subvención destino: no se tocan. */
  yaEnEsta: string[]
  /** Están enteros en otras subvenciones, agrupados por la primera. No cabe nada más. */
  sinHueco: Map<string, string[]>
  /** De los que se imputan, cuántos entran solo en parte porque el resto está en otra. */
  parciales: number
}

/**
 * Reparte una selección de movimientos al imputarlos a `destinoId`.
 *
 * Cada movimiento entra por **lo que le queda libre**: entero si no está en
 * ninguna otra subvención, y el resto si ya está en parte en otra. Así la
 * acción en lote nunca pasa del 100 % ni quita nada a otra subvención; para
 * repartir de otra manera se ajusta después, movimiento a movimiento. Los que
 * ya estaban en esta no se tocan (su parte puede haberse ajustado a mano).
 */
export function repartirAsignacion(
  seleccion: { id: string; importe: number }[],
  existentes: Imputacion[],
  destinoId: string,
): RepartoAsignacion {
  const porMovimiento = new Map<string, Imputacion[]>()
  for (const e of existentes) {
    porMovimiento.set(e.movimiento_id, [...(porMovimiento.get(e.movimiento_id) ?? []), e])
  }

  const vistos = new Set<string>()
  const reparto: RepartoAsignacion = { aImputar: [], yaEnEsta: [], sinHueco: new Map(), parciales: 0 }

  for (const m of seleccion) {
    if (vistos.has(m.id)) continue
    vistos.add(m.id)
    const suyas = porMovimiento.get(m.id) ?? []
    if (suyas.some((i) => i.subvencion_id === destinoId)) {
      reparto.yaEnEsta.push(m.id)
      continue
    }
    const libre = importeLibre(m.importe, suyas, destinoId)
    if (libre <= EPS) {
      const donde = suyas[0]?.subvencion_id ?? ""
      reparto.sinHueco.set(donde, [...(reparto.sinHueco.get(donde) ?? []), m.id])
      continue
    }
    const parcial = suyas.length > 0
    if (parcial) reparto.parciales++
    reparto.aImputar.push({ id: m.id, importe: libre, parcial })
  }
  return reparto
}

/** Porcentaje (0–100, un decimal) que es `parte` de `total`. */
export function porcentajeDe(parte: number, total: number): number {
  const t = Math.abs(total)
  if (t <= 0) return 0
  return Math.round((parte / t) * 1000) / 10
}

/** Euros que son `pct` % de `total`, a céntimos. */
export function importeDesdePorcentaje(pct: number, total: number): number {
  return redondear2((Math.abs(total) * pct) / 100)
}

/**
 * Valida una parte imputada antes de mandarla: positiva y sin pasar de lo
 * libre. Devuelve el mensaje para la persona, o `null` si vale. La base de
 * datos lo comprueba igualmente (scripts/072); esto es para decirlo antes.
 */
export function validarImputacion(importe: number | null, libre: number): string | null {
  if (importe == null || !Number.isFinite(importe)) return "Escribe un importe."
  if (importe <= 0) return "Tiene que ser más de 0 €. Para sacarlo de la subvención, quítalo."
  if (importe > libre + EPS) return `Solo quedan ${libre.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} € libres.`
  return null
}

// ---------------------------------------------------------------------------
// Periodo imputable
// ---------------------------------------------------------------------------

/**
 * `true` si la fecha (yyyy-mm-dd) cae fuera del periodo imputable de la
 * subvención. Sin periodo, o con un solo extremo, solo se comprueba lo que hay.
 * Solo avisa: la pantalla no rechaza el movimiento.
 */
export function fueraDePeriodo(
  fecha: string | null | undefined,
  subvencion: Pick<Subvencion, "periodo_desde" | "periodo_hasta">,
): boolean {
  if (!fecha) return false
  const dia = fecha.slice(0, 10)
  if (subvencion.periodo_desde && dia < subvencion.periodo_desde) return true
  if (subvencion.periodo_hasta && dia > subvencion.periodo_hasta) return true
  return false
}

// ---------------------------------------------------------------------------
// Copiar ids
// ---------------------------------------------------------------------------

export type FormatoIds = "lineas" | "comas" | "json"

export const FORMATOS_IDS: Record<FormatoIds, { label: string; descripcion: string }> = {
  lineas: { label: "Uno por línea", descripcion: "Para pegar en una columna de Excel" },
  comas: { label: "Separados por comas", descripcion: "Para una URL o una fórmula" },
  json: { label: "Lista JSON", descripcion: "Para un script o una llamada a la API" },
}

export function formatearIds(ids: string[], formato: FormatoIds): string {
  switch (formato) {
    case "comas":
      return ids.join(",")
    case "json":
      return JSON.stringify(ids)
    default:
      return ids.join("\n")
  }
}

/** Porcentaje (0–100, sin acotar por arriba) de lo concedido que ya está imputado. */
export function porcentajeImputado(totalGastos: number, concedido: number | null | undefined): number | null {
  if (!concedido || concedido <= 0) return null
  return Math.round((totalGastos / concedido) * 1000) / 10
}
