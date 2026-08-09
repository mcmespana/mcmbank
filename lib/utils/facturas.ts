import type { LucideIcon } from "lucide-react"
import { BadgeCheck, CheckCircle2, Clock, ExternalLink, Inbox, Mail, PieChart, Upload } from "lucide-react"
import type { FacturaEstado, FacturaOrigen } from "@/lib/types/database"

// La lógica pura de conciliación vive en `facturas-matching.ts` para que el
// servidor pueda usarla sin arrastrar iconos ni estilos. Se reexporta aquí para
// no cambiar los imports que ya existen en la interfaz.
export {
  importePagadoFactura,
  importePendienteFactura,
  margenImporteFactura,
  scoreCandidatoMovimiento,
  esMatchDirecto,
} from "@/lib/utils/facturas-matching"
export type { CandidatoScore } from "@/lib/utils/facturas-matching"

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
  pagada_parcial: {
    value: "pagada_parcial",
    label: "Pago parcial",
    descripcion: "Vinculada a uno o varios movimientos, pero aún no cubren el importe total.",
    icon: PieChart,
    tone: "amber",
    dotClass: "bg-orange-500",
    bgClass: "bg-orange-50 dark:bg-orange-950/30",
    textClass: "text-orange-700 dark:text-orange-300",
    borderClass: "border-orange-200/70 dark:border-orange-900/60",
  },
  pagada: {
    value: "pagada",
    label: "Pagada",
    descripcion: "Pagada y vinculada a uno o varios movimientos de MCM Bank.",
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
  "pagada_parcial",
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
