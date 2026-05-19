import type { LucideIcon } from "lucide-react"
import { Calculator, CheckCircle2, CircleDashed, CircleSlash, Clock, Coins, FileText, Fuel, Gauge } from "lucide-react"
import type { PagoMcmEstado, PagoMcmGasolinaPreset, PagoMcmTipoCalculo } from "@/lib/types/database"

export interface PagoMcmEstadoInfo {
  value: PagoMcmEstado
  label: string
  icon: LucideIcon
  /** Color tonal (token). */
  tone: "muted" | "amber" | "emerald" | "rose"
  /** Punto de color para badges sutiles. */
  dotClass: string
  bgClass: string
  textClass: string
  borderClass: string
}

export const PAGO_MCM_ESTADO_INFO: Record<PagoMcmEstado, PagoMcmEstadoInfo> = {
  borrador: {
    value: "borrador",
    label: "Borrador",
    icon: CircleDashed,
    tone: "muted",
    dotClass: "bg-zinc-400 dark:bg-zinc-500",
    bgClass: "bg-zinc-50 dark:bg-zinc-900/40",
    textClass: "text-zinc-600 dark:text-zinc-300",
    borderClass: "border-zinc-200/70 dark:border-zinc-800/70",
  },
  pendiente: {
    value: "pendiente",
    label: "Pendiente",
    icon: Clock,
    tone: "amber",
    dotClass: "bg-amber-500",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    textClass: "text-amber-700 dark:text-amber-300",
    borderClass: "border-amber-200/70 dark:border-amber-900/60",
  },
  pagado: {
    value: "pagado",
    label: "Pagado",
    icon: CheckCircle2,
    tone: "emerald",
    dotClass: "bg-emerald-500",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    textClass: "text-emerald-700 dark:text-emerald-300",
    borderClass: "border-emerald-200/70 dark:border-emerald-900/60",
  },
  cancelado: {
    value: "cancelado",
    label: "Cancelado",
    icon: CircleSlash,
    tone: "rose",
    dotClass: "bg-rose-500",
    bgClass: "bg-rose-50 dark:bg-rose-950/30",
    textClass: "text-rose-600 dark:text-rose-300",
    borderClass: "border-rose-200/70 dark:border-rose-900/60",
  },
}

export interface PagoMcmTipoCalculoInfo {
  value: PagoMcmTipoCalculo
  label: string
  shortLabel: string
  descripcion: string
  icon: LucideIcon
  disabled?: boolean
}

export const PAGO_MCM_TIPO_CALCULO_INFO: Record<PagoMcmTipoCalculo, PagoMcmTipoCalculoInfo> = {
  manual: {
    value: "manual",
    label: "Importe manual",
    shortLabel: "Manual",
    descripcion: "Importe fijo introducido a mano.",
    icon: Coins,
  },
  gasolina_tickets: {
    value: "gasolina_tickets",
    label: "Gasolina · tickets",
    shortLabel: "Tickets",
    descripcion: "Sube los tickets de gasolina y se reembolsa lo que toca.",
    icon: FileText,
  },
  gasolina_km: {
    value: "gasolina_km",
    label: "Gasolina · €/km",
    shortLabel: "€/km",
    descripcion: "Cálculo automático por kilómetros recorridos.",
    icon: Fuel,
  },
  gasolina_avanzado: {
    value: "gasolina_avanzado",
    label: "Gasolina · avanzado",
    shortLabel: "Avanzado",
    descripcion: "Cálculo más preciso (próximamente).",
    icon: Gauge,
    disabled: true,
  },
}

export interface PagoMcmGasolinaPresetInfo {
  value: PagoMcmGasolinaPreset
  label: string
  precio: number // €/km
  descripcion: string
}

export const PAGO_MCM_GASOLINA_PRESETS: Record<PagoMcmGasolinaPreset, PagoMcmGasolinaPresetInfo> = {
  ivaj_0_12: {
    value: "ivaj_0_12",
    label: "IVAJ · 0,12 €",
    precio: 0.12,
    descripcion: "Precio de referencia del IVAJ.",
  },
  min_0_18: {
    value: "min_0_18",
    label: "Mínimo · 0,18 €",
    precio: 0.18,
    descripcion: "Mínimo recomendado.",
  },
  max_0_20: {
    value: "max_0_20",
    label: "Máximo · 0,20 €",
    precio: 0.20,
    descripcion: "Máximo recomendado.",
  },
  estandar_0_26: {
    value: "estandar_0_26",
    label: "Estándar · 0,26 €",
    precio: 0.26,
    descripcion: "Estándar habitual.",
  },
  personalizado: {
    value: "personalizado",
    label: "Personalizado",
    precio: 0.26,
    descripcion: "Define tu propio precio por kilómetro.",
  },
}

export const PAGO_MCM_GASOLINA_PRESETS_ORDER: readonly PagoMcmGasolinaPreset[] = [
  "ivaj_0_12",
  "min_0_18",
  "max_0_20",
  "estandar_0_26",
  "personalizado",
]

/**
 * Calcula el importe de un pago MCM tipo "gasolina_km".
 * km_un_trayecto * (ida_vuelta ? 2 : 1) * precio_km, redondeado a 2 decimales.
 */
export function calcularImporteGasolinaKm(
  kmUnTrayecto: number | null | undefined,
  idaVuelta: boolean,
  precioKm: number | null | undefined,
): number {
  const km = Number(kmUnTrayecto) || 0
  const precio = Number(precioKm) || 0
  const total = km * (idaVuelta ? 2 : 1) * precio
  return Math.round(total * 100) / 100
}

/**
 * Devuelve el preset cuyo precio coincide con el valor dado.
 * Si no coincide ninguno, devuelve 'personalizado'.
 */
export function inferirPresetGasolina(precioKm: number | null | undefined): PagoMcmGasolinaPreset {
  if (precioKm == null) return "estandar_0_26"
  const eps = 0.0001
  for (const preset of PAGO_MCM_GASOLINA_PRESETS_ORDER) {
    if (preset === "personalizado") continue
    if (Math.abs(PAGO_MCM_GASOLINA_PRESETS[preset].precio - precioKm) < eps) {
      return preset
    }
  }
  return "personalizado"
}
