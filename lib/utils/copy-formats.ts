import type { PagoMcmConRelaciones } from "@/lib/types/database"
import { formatCurrency } from "./format"
import { formatearIban, normalizarIban } from "./iban"
import { getConceptoTransferenciaSugerido } from "./transferencia"

/**
 * Devuelve sólo los pagos pendientes que cuentan con IBAN (los únicos
 * "transferibles" sin más). Los demás formatos derivan de este filtro.
 */
export function getPagosTransferibles(pagos: PagoMcmConRelaciones[]): PagoMcmConRelaciones[] {
  return pagos.filter((p) => p.estado === "pendiente" && p.contacto?.iban)
}

/** Formato compacto: una línea por pago, separadas por " — ". */
function lineaCompacta(p: PagoMcmConRelaciones): string {
  const nombre = p.contacto?.nombre ?? "Contacto"
  const iban = formatearIban(p.contacto?.iban ?? "")
  const importe = formatCurrency(Number(p.importe))
  const concepto = getConceptoTransferenciaSugerido(p)
  return `${nombre} — ${iban} — ${importe} — ${concepto}`
}

export function formatCompacto(pagos: PagoMcmConRelaciones[]): string {
  return pagos.map(lineaCompacta).join("\n")
}

/** Tabla legible: columnas alineadas, util para WhatsApp/email en monoespaciado. */
export function formatTabla(pagos: PagoMcmConRelaciones[]): string {
  const filas = pagos.map((p) => ({
    nombre: p.contacto?.nombre ?? "Contacto",
    iban: formatearIban(p.contacto?.iban ?? ""),
    importe: formatCurrency(Number(p.importe)),
    concepto: getConceptoTransferenciaSugerido(p),
  }))
  const w = {
    nombre: Math.max(8, ...filas.map((f) => f.nombre.length)),
    iban: Math.max(4, ...filas.map((f) => f.iban.length)),
    importe: Math.max(7, ...filas.map((f) => f.importe.length)),
  }
  const pad = (s: string, n: number) => s + " ".repeat(Math.max(0, n - s.length))
  const head = `${pad("Nombre", w.nombre)}  ${pad("IBAN", w.iban)}  ${pad("Importe", w.importe)}  Concepto`
  const sep = "-".repeat(head.length)
  const body = filas.map(
    (f) => `${pad(f.nombre, w.nombre)}  ${pad(f.iban, w.iban)}  ${pad(f.importe, w.importe)}  ${f.concepto}`,
  )
  return [head, sep, ...body].join("\n")
}

/**
 * CSV importable en Excel / hojas de cálculo. Importe con coma decimal
 * (formato español). IBAN sin espacios para que sea pegable directamente
 * en pasarelas bancarias.
 */
export function formatCSV(pagos: PagoMcmConRelaciones[]): string {
  const escape = (s: string) => {
    if (/[",;\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const head = ["Nombre", "IBAN", "Importe", "Concepto"].join(";")
  const rows = pagos.map((p) => {
    const nombre = p.contacto?.nombre ?? "Contacto"
    const iban = normalizarIban(p.contacto?.iban ?? "")
    const importe = Number(p.importe).toFixed(2).replace(".", ",")
    const concepto = getConceptoTransferenciaSugerido(p)
    return [nombre, iban, importe, concepto].map(escape).join(";")
  })
  return [head, ...rows].join("\n")
}

export type CopyFormatId = "compacto" | "tabla" | "csv"

export const COPY_FORMATS: Record<
  CopyFormatId,
  { label: string; description: string; build: (pagos: PagoMcmConRelaciones[]) => string }
> = {
  compacto: {
    label: "Lista compacta",
    description: "Una línea por pago. Ideal para WhatsApp o un mensaje rápido.",
    build: formatCompacto,
  },
  tabla: {
    label: "Tabla alineada",
    description: "Columnas en monoespaciado. Perfecto para email o un comentario.",
    build: formatTabla,
  },
  csv: {
    label: "CSV (Excel)",
    description: "Separado por punto y coma, importe con coma decimal. Pégalo en una hoja de cálculo.",
    build: formatCSV,
  },
}
