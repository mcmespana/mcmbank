import type { AvisoDestinatario } from "@/lib/types/avisos"

/**
 * Cómo se llama un lado (oficina técnica / delegación) en las frases del
 * panel. La oficina técnica se llama siempre igual; la delegación se llama
 * por su nombre visto desde fuera, o "nosotros/vosotros" vista desde dentro.
 */
export function ladoLabel(
  lado: AvisoDestinatario,
  slot: "origen" | "destino",
  miLado: AvisoDestinatario,
  delegacionNombre: string,
): string {
  if (lado === "oficina_tecnica") return "Oficina técnica"
  if (miLado !== "delegacion") return delegacionNombre
  return slot === "origen" ? "Nosotros" : "Vosotros"
}

/** A quién avisaría el correo si se manda: "los tesoreros de X" | "la oficina técnica". */
export function descripcionDestinoCorreo(destinatario: AvisoDestinatario, delegacionNombre: string): string {
  return destinatario === "delegacion" ? `los tesoreros de ${delegacionNombre}` : "la oficina técnica"
}

/** "ahora", "hace 5 min", "hace 3 h", "ayer", "12 jul", "12 jul 2024". */
export function formatRelativoCorto(value?: string | null): string {
  if (!value) return ""
  const fecha = new Date(value)
  if (Number.isNaN(fecha.getTime())) return ""

  const ahora = new Date()
  const segundos = Math.max(0, Math.round((ahora.getTime() - fecha.getTime()) / 1000))

  if (segundos < 60) return "ahora"
  if (segundos < 3600) return `hace ${Math.floor(segundos / 60)} min`
  if (segundos < 86400) return `hace ${Math.floor(segundos / 3600)} h`

  const mismoDia = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
  const ayer = new Date(ahora)
  ayer.setDate(ayer.getDate() - 1)
  if (mismoDia(fecha, ayer)) return "ayer"

  const mismoAnio = fecha.getFullYear() === ahora.getFullYear()
  return fecha.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    ...(mismoAnio ? {} : { year: "numeric" }),
  })
}

/** Fecha completa para el title de los tiempos relativos. */
export function formatFechaCompleta(value?: string | null): string {
  if (!value) return ""
  const fecha = new Date(value)
  if (Number.isNaN(fecha.getTime())) return ""
  return fecha.toLocaleString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

/** Primer nombre, para que la línea de meta no se haga larga. */
export function primerNombre(nombre?: string | null): string | null {
  if (!nombre) return null
  const limpio = nombre.trim()
  if (!limpio) return null
  return limpio.split(/\s+/)[0]
}

/** "31 dic" (o "31 dic 2027" si no es este año). `fechaIso` es "yyyy-mm-dd". */
export function formatFechaLimiteCorta(fechaIso?: string | null): string | null {
  if (!fechaIso) return null
  // new Date("yyyy-mm-dd") se interpreta en UTC; se fuerza mediodía local para no desplazar el día.
  const fecha = new Date(`${fechaIso}T12:00:00`)
  if (Number.isNaN(fecha.getTime())) return null
  const mismoAnio = fecha.getFullYear() === new Date().getFullYear()
  return fecha.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "short",
    ...(mismoAnio ? {} : { year: "numeric" }),
  })
}

/** true si la fecha límite (fecha, sin hora) ya ha pasado. */
export function estaVencida(fechaIso?: string | null): boolean {
  if (!fechaIso) return false
  const limite = new Date(`${fechaIso}T23:59:59`)
  if (Number.isNaN(limite.getTime())) return false
  return limite.getTime() < Date.now()
}
