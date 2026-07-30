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
