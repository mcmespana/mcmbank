import type { LucideIcon } from "lucide-react"
import { BadgeCheck, CheckCircle2, Clock, ExternalLink, Inbox, Mail, Upload } from "lucide-react"
import type { FacturaEstado, FacturaOrigen, MovimientoConRelaciones } from "@/lib/types/database"

export interface FacturaEstadoInfo {
  value: FacturaEstado
  label: string
  descripcion: string
  icon: LucideIcon
  tone: "sky" | "amber" | "emerald" | "violet"
  dotClass: string
  bgClass: string
  textClass: string
  borderClass: string
}

export const FACTURA_ESTADO_INFO: Record<FacturaEstado, FacturaEstadoInfo> = {
  bandeja: {
    value: "bandeja",
    label: "En bandeja",
    descripcion: "Recién subida, pendiente de revisar y completar datos.",
    icon: Inbox,
    tone: "sky",
    dotClass: "bg-sky-500",
    bgClass: "bg-sky-50 dark:bg-sky-950/30",
    textClass: "text-sky-700 dark:text-sky-300",
    borderClass: "border-sky-200/70 dark:border-sky-900/60",
  },
  sin_pagar: {
    value: "sin_pagar",
    label: "Sin pagar",
    descripcion: "Registrada, pendiente de pago.",
    icon: Clock,
    tone: "amber",
    dotClass: "bg-amber-500",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    textClass: "text-amber-700 dark:text-amber-300",
    borderClass: "border-amber-200/70 dark:border-amber-900/60",
  },
  pagada: {
    value: "pagada",
    label: "Pagada",
    descripcion: "Pagada y vinculada a un movimiento de MCM Bank.",
    icon: CheckCircle2,
    tone: "emerald",
    dotClass: "bg-emerald-500",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    textClass: "text-emerald-700 dark:text-emerald-300",
    borderClass: "border-emerald-200/70 dark:border-emerald-900/60",
  },
  pagada_fuera: {
    value: "pagada_fuera",
    label: "Pagada fuera",
    descripcion: "Pagada, pero el movimiento está fuera de MCM Bank.",
    icon: BadgeCheck,
    tone: "violet",
    dotClass: "bg-violet-500",
    bgClass: "bg-violet-50 dark:bg-violet-950/30",
    textClass: "text-violet-700 dark:text-violet-300",
    borderClass: "border-violet-200/70 dark:border-violet-900/60",
  },
}

export const FACTURA_ESTADO_ORDER: readonly FacturaEstado[] = [
  "bandeja",
  "sin_pagar",
  "pagada",
  "pagada_fuera",
]

export interface FacturaOrigenInfo {
  value: FacturaOrigen
  label: string
  icon: LucideIcon
}

export const FACTURA_ORIGEN_INFO: Record<FacturaOrigen, FacturaOrigenInfo> = {
  subida: { value: "subida", label: "Subida a mano", icon: Upload },
  movimiento: { value: "movimiento", label: "Creada desde un movimiento", icon: ExternalLink },
  email: { value: "email", label: "Recibida por email", icon: Mail },
}

/**
 * Margen de importe para buscar movimientos candidatos de una factura:
 * un 2% del importe con un mínimo de 0,50 € ("un pelín de margen").
 */
export function margenImporteFactura(importe: number): number {
  return Math.max(Math.abs(importe) * 0.02, 0.5)
}

export interface CandidatoScore {
  score: number
  importeExacto: boolean
  fechaCercana: boolean
  mismoContacto: boolean
}

/**
 * Puntúa un movimiento como candidato para una factura. El precio manda:
 * importe exacto pesa mucho más que la fecha; el contacto ayuda a desempatar.
 */
export function scoreCandidatoMovimiento(
  factura: { importe?: number | null; fecha_emision?: string | null; contacto_id?: string | null },
  movimiento: Pick<MovimientoConRelaciones, "importe" | "fecha" | "contacto_id">,
): CandidatoScore {
  let score = 0

  const importeExacto =
    factura.importe != null && Math.abs(Math.abs(Number(movimiento.importe)) - Math.abs(Number(factura.importe))) < 0.005
  if (importeExacto) score += 4
  else if (factura.importe != null) score += 1 // dentro del margen (la query ya filtró)

  let fechaCercana = false
  if (factura.fecha_emision && movimiento.fecha) {
    const diffDias = Math.abs(
      (new Date(movimiento.fecha).getTime() - new Date(factura.fecha_emision).getTime()) / 86400000,
    )
    if (diffDias <= 5) {
      score += 2
      fechaCercana = true
    } else if (diffDias <= 20) {
      score += 1
    }
  }

  const mismoContacto = Boolean(factura.contacto_id && movimiento.contacto_id === factura.contacto_id)
  if (mismoContacto) score += 2

  return { score, importeExacto, fechaCercana, mismoContacto }
}

/**
 * Un candidato es "match directo" si tiene importe exacto y destaca claramente
 * sobre el segundo (o es el único).
 */
export function esMatchDirecto(scores: CandidatoScore[]): boolean {
  if (scores.length === 0) return false
  const [primero, segundo] = scores
  if (!primero.importeExacto) return false
  if (!segundo) return true
  return primero.score >= segundo.score + 2
}
