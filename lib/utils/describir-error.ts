/**
 * Convierte un error en algo que se pueda leer y, sobre todo, reenviar.
 *
 * La app estaba llena de `toast.error("Error al guardar")`: el usuario no sabía
 * qué había pasado y quien tenía que arreglarlo tampoco, porque el detalle se
 * quedaba en la consola del navegador de otra persona. Aquí se enseña **todo lo
 * que trae el error** — mensaje, `details`, `hint` y código de Postgres —
 * asumiendo que es feo. Un texto feo que se puede copiar en un mensaje vale
 * mucho más que uno bonito que no dice nada.
 *
 * Los errores de PostgREST/Supabase no son `Error`: son objetos planos con
 * `message`/`details`/`hint`/`code`, así que `err instanceof Error` no basta.
 */
export function describirError(error: unknown, contexto?: string): string {
  const partes: string[] = []

  if (typeof error === "string") {
    partes.push(error)
  } else if (error && typeof error === "object") {
    const e = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    if (typeof e.message === "string" && e.message.trim()) partes.push(e.message.trim())
    if (typeof e.details === "string" && e.details.trim()) partes.push(e.details.trim())
    if (typeof e.hint === "string" && e.hint.trim()) partes.push(`Pista: ${e.hint.trim()}`)
    if (typeof e.code === "string" && e.code.trim()) partes.push(`[${e.code.trim()}]`)
  }

  // Duplicados fuera: PostgREST repite el mensaje en `details` a menudo.
  const detalle = Array.from(new Set(partes)).join(" · ")

  if (!detalle) return contexto ?? "Ha fallado algo y el error ha venido vacío"
  return contexto ? `${contexto}: ${detalle}` : detalle
}

/**
 * Un abort no es un fallo: pasa al cambiar de pestaña o al filtrar rápido.
 * Nunca debería salir como alerta roja.
 */
export function esAbort(error: unknown): boolean {
  if (!error) return false
  if (typeof error === "object" && "name" in error && (error as { name?: unknown }).name === "AbortError") return true
  const texto = typeof error === "string" ? error : (error as { message?: unknown })?.message
  return typeof texto === "string" && /abort/i.test(texto)
}
