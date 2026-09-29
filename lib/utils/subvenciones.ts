import {
  CheckCircle2,
  CircleDashed,
  FileCheck2,
  Lock,
  Send,
  XCircle,
  type LucideIcon,
} from "lucide-react"
import type { Subvencion, SubvencionEstado } from "@/lib/types/database"

export { SUBVENCION_ESTADOS, esSubvencionEstado } from "@/lib/types/database"

/**
 * Subvenciones: lógica pura (sin Supabase) para la pantalla, la acción en lote
 * de Movimientos y la API externa.
 */

export interface SubvencionEstadoInfo {
  value: SubvencionEstado
  label: string
  descripcion: string
  icon: LucideIcon
  dotClass: string
  bgClass: string
  textClass: string
  borderClass: string
}

// Mismo esquema de color que FACTURA_ESTADO_INFO (lib/utils/facturas.ts).
export const SUBVENCION_ESTADO_INFO: Record<SubvencionEstado, SubvencionEstadoInfo> = {
  en_preparacion: {
    value: "en_preparacion",
    label: "En preparación",
    descripcion: "Todavía no se ha presentado la solicitud.",
    icon: CircleDashed,
    dotClass: "bg-slate-400",
    bgClass: "bg-muted/60",
    textClass: "text-muted-foreground",
    borderClass: "border-border",
  },
  solicitada: {
    value: "solicitada",
    label: "Solicitada",
    descripcion: "Presentada, esperando resolución.",
    icon: Send,
    dotClass: "bg-sky-500",
    bgClass: "bg-sky-50 dark:bg-sky-950/30",
    textClass: "text-sky-700 dark:text-sky-300",
    borderClass: "border-sky-200/70 dark:border-sky-900/60",
  },
  concedida: {
    value: "concedida",
    label: "Concedida · por justificar",
    descripcion: "Concedida: hay que imputarle gastos y justificarla.",
    icon: CheckCircle2,
    dotClass: "bg-amber-500",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    textClass: "text-amber-700 dark:text-amber-300",
    borderClass: "border-amber-200/70 dark:border-amber-900/60",
  },
  denegada: {
    value: "denegada",
    label: "Denegada",
    descripcion: "No se concedió.",
    icon: XCircle,
    dotClass: "bg-red-500",
    bgClass: "bg-red-50 dark:bg-red-950/30",
    textClass: "text-red-700 dark:text-red-300",
    borderClass: "border-red-200/70 dark:border-red-900/60",
  },
  justificada: {
    value: "justificada",
    label: "Justificada",
    descripcion: "Justificación presentada; falta el cierre.",
    icon: FileCheck2,
    dotClass: "bg-emerald-500",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    textClass: "text-emerald-700 dark:text-emerald-300",
    borderClass: "border-emerald-200/70 dark:border-emerald-900/60",
  },
  cerrada: {
    value: "cerrada",
    label: "Cerrada",
    descripcion: "Cobrada y cerrada. No se esperan más cambios.",
    icon: Lock,
    dotClass: "bg-slate-500",
    bgClass: "bg-muted/60",
    textClass: "text-muted-foreground",
    borderClass: "border-border",
  },
}

// ---------------------------------------------------------------------------
// Asignar movimientos: qué entra, qué ya estaba y qué está en otra
// ---------------------------------------------------------------------------

export interface RepartoAsignacion {
  /** Movimientos que se pueden imputar a la subvención destino. */
  nuevos: string[]
  /** Ya estaban en la subvención destino: no hay nada que hacer. */
  yaEnEsta: string[]
  /** Están en otra subvención, agrupados por ella. No se tocan. */
  enOtra: Map<string, string[]>
}

/**
 * Reparte una selección de movimientos entre los que se pueden imputar a
 * `destinoId` y los que no.
 *
 * Los que ya están en otra subvención **no se mueven solos**: quitar un gasto
 * de una justificación es una decisión, no un efecto secundario de seleccionar
 * de más. La base de datos lo impediría igualmente (UNIQUE movimiento_id), pero
 * así se puede decir cuáles son y dónde están antes de intentarlo.
 */
export function repartirAsignacion(
  seleccion: string[],
  existentes: { movimiento_id: string; subvencion_id: string }[],
  destinoId: string,
): RepartoAsignacion {
  const dondeEsta = new Map(existentes.map((e) => [e.movimiento_id, e.subvencion_id]))
  const vistos = new Set<string>()
  const reparto: RepartoAsignacion = { nuevos: [], yaEnEsta: [], enOtra: new Map() }

  for (const id of seleccion) {
    if (vistos.has(id)) continue
    vistos.add(id)
    const actual = dondeEsta.get(id)
    if (!actual) reparto.nuevos.push(id)
    else if (actual === destinoId) reparto.yaEnEsta.push(id)
    else reparto.enOtra.set(actual, [...(reparto.enOtra.get(actual) ?? []), id])
  }
  return reparto
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
