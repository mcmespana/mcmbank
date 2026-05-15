import type { ContactoTipo } from "@/lib/types/database"

export interface ContactoTipoInfo {
  value: ContactoTipo
  label: string
  shortLabel: string
  descripcion: string
  emoji: string
  color: string
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
    color: "#3B82F6",
    bgClass: "bg-blue-100 dark:bg-blue-950/40",
    textClass: "text-blue-700 dark:text-blue-300",
    borderClass: "border-blue-200 dark:border-blue-900",
  },
  persona_mcm: {
    value: "persona_mcm",
    label: "Persona MCM",
    shortLabel: "Persona",
    descripcion: "Socio, voluntario, monitor, miembro de equipo. Candidato a reembolsos.",
    emoji: "🧑",
    color: "#10B981",
    bgClass: "bg-emerald-100 dark:bg-emerald-950/40",
    textClass: "text-emerald-700 dark:text-emerald-300",
    borderClass: "border-emerald-200 dark:border-emerald-900",
  },
  destinatario_mcm: {
    value: "destinatario_mcm",
    label: "Destinatario MCM",
    shortLabel: "Destinatario",
    descripcion: "Destinatario final de nuestras actividades o su familia. Suele ser origen de ingresos.",
    emoji: "🎯",
    color: "#F59E0B",
    bgClass: "bg-amber-100 dark:bg-amber-950/40",
    textClass: "text-amber-700 dark:text-amber-300",
    borderClass: "border-amber-200 dark:border-amber-900",
  },
}

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
