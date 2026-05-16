import type { PagoMcmEstado, PagoMcmGasolinaPreset, PagoMcmTipoCalculo } from "@/lib/types/database"

export interface PagoMcmEstadoInfo {
  value: PagoMcmEstado
  label: string
  emoji: string
  color: string
  bgClass: string
  textClass: string
  borderClass: string
}

export const PAGO_MCM_ESTADO_INFO: Record<PagoMcmEstado, PagoMcmEstadoInfo> = {
  borrador: {
    value: "borrador",
    label: "Borrador",
    emoji: "📝",
    color: "#6B7280",
    bgClass: "bg-zinc-100 dark:bg-zinc-900/40",
    textClass: "text-zinc-700 dark:text-zinc-300",
    borderClass: "border-zinc-200 dark:border-zinc-800",
  },
  pendiente: {
    value: "pendiente",
    label: "Pendiente",
    emoji: "⏳",
    color: "#F59E0B",
    bgClass: "bg-amber-100 dark:bg-amber-950/40",
    textClass: "text-amber-700 dark:text-amber-300",
    borderClass: "border-amber-200 dark:border-amber-900",
  },
  pagado: {
    value: "pagado",
    label: "Pagado",
    emoji: "✅",
    color: "#10B981",
    bgClass: "bg-emerald-100 dark:bg-emerald-950/40",
    textClass: "text-emerald-700 dark:text-emerald-300",
    borderClass: "border-emerald-200 dark:border-emerald-900",
  },
  cancelado: {
    value: "cancelado",
    label: "Cancelado",
    emoji: "✖️",
    color: "#EF4444",
    bgClass: "bg-rose-100 dark:bg-rose-950/40",
    textClass: "text-rose-700 dark:text-rose-300",
    borderClass: "border-rose-200 dark:border-rose-900",
  },
}

export interface PagoMcmTipoCalculoInfo {
  value: PagoMcmTipoCalculo
  label: string
  descripcion: string
  emoji: string
  disabled?: boolean
}

export const PAGO_MCM_TIPO_CALCULO_INFO: Record<PagoMcmTipoCalculo, PagoMcmTipoCalculoInfo> = {
  manual: {
    value: "manual",
    label: "Manual",
    descripcion: "Importe fijo introducido a mano.",
    emoji: "💶",
  },
  gasolina_tickets: {
    value: "gasolina_tickets",
    label: "Gasolina · tickets",
    descripcion: "Subes los tickets de gasolina y se reembolsa lo que toca.",
    emoji: "🧾",
  },
  gasolina_km: {
    value: "gasolina_km",
    label: "Gasolina · €/km",
    descripcion: "Cálculo automático por kilómetros recorridos.",
    emoji: "🛣️",
  },
  gasolina_avanzado: {
    value: "gasolina_avanzado",
    label: "Gasolina · avanzado",
    descripcion: "Cálculo más preciso (próximamente).",
    emoji: "🚧",
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
    label: "IVAJ 0,12 €",
    precio: 0.12,
    descripcion: "Precio de referencia del IVAJ.",
  },
  min_0_18: {
    value: "min_0_18",
    label: "Mínimo 0,18 €",
    precio: 0.18,
    descripcion: "Mínimo recomendado.",
  },
  max_0_20: {
    value: "max_0_20",
    label: "Máximo 0,20 €",
    precio: 0.20,
    descripcion: "Máximo recomendado.",
  },
  estandar_0_26: {
    value: "estandar_0_26",
    label: "Estándar 0,26 €",
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
