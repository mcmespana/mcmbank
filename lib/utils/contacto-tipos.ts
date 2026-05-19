import type { LucideIcon } from "lucide-react"
import { Building2, Target, User } from "lucide-react"
import type { ContactoTipo } from "@/lib/types/database"

export interface ContactoTipoInfo {
  value: ContactoTipo
  label: string
  shortLabel: string
  descripcion: string
  emoji: string
  icon: LucideIcon
  color: string
  dotClass: string
  bgClass: string
  textClass: string
  borderClass: string
}

export const CONTACTO_TIPO_INFO: Record<ContactoTipo, ContactoTipoInfo> = {
  proveedor: {
    value: "proveedor",
    label: "Proveedor",
    shortLabel: "Proveedor",
    descripcion: "Empresa o autónomo que nos vende o factura.",
    emoji: "🏢",
    icon: Building2,
    color: "#2563EB",
    dotClass: "bg-blue-500",
    bgClass: "bg-blue-50 dark:bg-blue-950/30",
    textClass: "text-blue-700 dark:text-blue-300",
    borderClass: "border-blue-200/70 dark:border-blue-900/60",
  },
  persona_mcm: {
    value: "persona_mcm",
    label: "Persona MCM",
    shortLabel: "Persona",
    descripcion: "Socio, voluntario, monitor, miembro de equipo. Candidato a reembolsos.",
    emoji: "🧑",
    icon: User,
    color: "#059669",
    dotClass: "bg-emerald-500",
    bgClass: "bg-emerald-50 dark:bg-emerald-950/30",
    textClass: "text-emerald-700 dark:text-emerald-300",
    borderClass: "border-emerald-200/70 dark:border-emerald-900/60",
  },
  destinatario_mcm: {
    value: "destinatario_mcm",
    label: "Destinatario MCM",
    shortLabel: "Destinatario",
    descripcion: "Destinatario final de nuestras actividades o su familia. Suele ser origen de ingresos.",
    emoji: "🎯",
    icon: Target,
    color: "#D97706",
    dotClass: "bg-amber-500",
    bgClass: "bg-amber-50 dark:bg-amber-950/30",
    textClass: "text-amber-700 dark:text-amber-300",
    borderClass: "border-amber-200/70 dark:border-amber-900/60",
  },
}

export const CONTACTO_TIPO_DEFAULT_EMOJIS: readonly string[] = ["🏢", "🧑", "🎯"]

export const CONTACTO_TIPO_ORDER: ContactoTipo[] = ["proveedor", "persona_mcm", "destinatario_mcm"]

export function getContactoTipoInfo(tipo: ContactoTipo): ContactoTipoInfo {
  return CONTACTO_TIPO_INFO[tipo]
}

export function getDefaultEmoji(tipo: ContactoTipo): string {
  return CONTACTO_TIPO_INFO[tipo].emoji
}

export function getDefaultColor(tipo: ContactoTipo): string {
  return CONTACTO_TIPO_INFO[tipo].color
}
