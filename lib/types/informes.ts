import type { Informe } from "./database"

export type InformeEstado =
  | "pendiente"
  | "en_desarrollo"
  | "hecho"
  | "revisado"
  | "aprobado"

export type Periodicidad = "anual" | "semestral" | "trimestral"
export type PeriodoTipo = "curso" | "natural"
export type InformeTipo = "anual" | "actividad"
export type InformeOrigen = "subido" | "generado"

export interface EstadoConfig {
  value: InformeEstado
  label: string
  /** Clases tailwind para badge (claro + oscuro). */
  badgeClass: string
  /** Color del puntito indicador. */
  dotClass: string
  /** Color de la franja de acento a la izquierda de la fila. */
  accentClass: string
}

export const ESTADO_ORDER: InformeEstado[] = [
  "pendiente",
  "en_desarrollo",
  "hecho",
  "revisado",
  "aprobado",
]

export const ESTADOS: Record<InformeEstado, EstadoConfig> = {
  pendiente: {
    value: "pendiente",
    label: "Pendiente",
    badgeClass:
      "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700",
    dotClass: "bg-slate-400",
    accentClass: "bg-slate-300 dark:bg-slate-600",
  },
  en_desarrollo: {
    value: "en_desarrollo",
    label: "En desarrollo",
    badgeClass:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
    dotClass: "bg-amber-500",
    accentClass: "bg-amber-400 dark:bg-amber-500",
  },
  hecho: {
    value: "hecho",
    label: "Hecho",
    badgeClass:
      "bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/40 dark:text-sky-300 dark:border-sky-800",
    dotClass: "bg-sky-500",
    accentClass: "bg-sky-400 dark:bg-sky-500",
  },
  revisado: {
    value: "revisado",
    label: "Revisado",
    badgeClass:
      "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-900/40 dark:text-violet-300 dark:border-violet-800",
    dotClass: "bg-violet-500",
    accentClass: "bg-violet-400 dark:bg-violet-500",
  },
  aprobado: {
    value: "aprobado",
    label: "Aprobado",
    badgeClass:
      "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800",
    dotClass: "bg-emerald-500",
    accentClass: "bg-emerald-400 dark:bg-emerald-500",
  },
}

export function getEstadoConfig(estado: string): EstadoConfig {
  return ESTADOS[estado as InformeEstado] ?? ESTADOS.pendiente
}

export const PERIODICIDAD_LABEL: Record<Periodicidad, string> = {
  anual: "Anual",
  semestral: "Semestral",
  trimestral: "Trimestral",
}

export const PERIODO_TIPO_LABEL: Record<PeriodoTipo, string> = {
  curso: "Curso académico",
  natural: "Año natural",
}

/** "2024-2025" a partir del año de inicio del curso. */
export function cursoLabelFromAnio(anioInicio: number): string {
  return `${anioInicio}-${anioInicio + 1}`
}

/** Sub-periodos disponibles según periodicidad. */
export function getSubPeriodos(
  periodicidad: Periodicidad,
): { value: string; label: string }[] {
  if (periodicidad === "semestral") {
    return [
      { value: "S1", label: "1er semestre" },
      { value: "S2", label: "2º semestre" },
    ]
  }
  if (periodicidad === "trimestral") {
    return [
      { value: "T1", label: "1er trimestre" },
      { value: "T2", label: "2º trimestre" },
      { value: "T3", label: "3er trimestre" },
      { value: "T4", label: "4º trimestre" },
    ]
  }
  return []
}

/**
 * Opciones de periodo (año/curso) recientes. `anioActual` por defecto el año en curso.
 * Para cursos genera "2024-2025"; para año natural genera "2026".
 */
export function buildPeriodoOptions(
  periodoTipo: PeriodoTipo,
  anioActual: number = new Date().getFullYear(),
  cantidad = 6,
): { value: number; label: string }[] {
  const opciones: { value: number; label: string }[] = []
  for (let i = 0; i < cantidad; i++) {
    const anio = anioActual - i
    opciones.push({
      value: anio,
      label: periodoTipo === "curso" ? cursoLabelFromAnio(anio) : String(anio),
    })
  }
  return opciones
}

/** Texto legible del periodo de un informe. */
export function periodoDisplay(informe: Pick<
  Informe,
  "periodo_tipo" | "anio" | "curso_label" | "sub_periodo" | "periodicidad"
>): string {
  const base =
    informe.periodo_tipo === "curso"
      ? informe.curso_label || cursoLabelFromAnio(informe.anio)
      : String(informe.anio)
  if (!informe.sub_periodo) return base
  const sub = getSubPeriodos(informe.periodicidad as Periodicidad).find(
    (s) => s.value === informe.sub_periodo,
  )
  return sub ? `${sub.label} · ${base}` : `${informe.sub_periodo} · ${base}`
}

/** Quita el prefijo "MCM " del nombre de la delegación. */
export function nombreDelegacionCorto(nombre: string): string {
  return nombre.replace(/^MCM\s+/i, "").trim()
}

/** Título sugerido para un informe nuevo. */
export function suggestTitulo(
  nombreDelegacion: string,
  periodo: { periodo_tipo: PeriodoTipo; anio: number },
): string {
  const corto = nombreDelegacionCorto(nombreDelegacion)
  const label =
    periodo.periodo_tipo === "curso"
      ? cursoLabelFromAnio(periodo.anio)
      : String(periodo.anio)
  return `MCM ${corto} · Memoria Económica ${label}`
}

export type ArchivoKind = "pdf" | "docx" | "xlsx" | "drive" | "otro"

export function archivoKind(nombre: string, mime?: string | null): ArchivoKind {
  const ext = nombre.split(".").pop()?.toLowerCase()
  if (ext === "pdf" || mime === "application/pdf") return "pdf"
  if (ext === "docx" || ext === "doc") return "docx"
  if (ext === "xlsx" || ext === "xls") return "xlsx"
  return "otro"
}

/** MIME types aceptados al subir un informe. */
export const INFORME_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]

export const INFORME_MAX_FILE_SIZE = 25 * 1024 * 1024 // 25 MB
