/**
 * Utilidades para construir filtros de PostgREST sin romperse con el texto que
 * escriben las personas.
 *
 * El operador `or=(...)` de PostgREST separa condiciones por comas y delimita
 * grupos con paréntesis, así que un término de búsqueda como
 * `"Mercadona, S.A. (Valencia)"` rompe la query si se interpola tal cual. La
 * solución del propio PostgREST es entrecomillar el valor: dentro de comillas
 * dobles, comas y paréntesis son literales y solo hay que escapar `\` y `"`.
 */

/** Escapa un valor para usarlo entrecomillado dentro de `or=(...)`. */
function valorEntrecomillado(valor: string): string {
  return `"${valor.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

/**
 * Cláusula `or` que busca un término en varias columnas con `ilike`.
 *
 * `%` y `_` se dejan pasar como comodines de SQL: es útil ("MERCA%") y quien
 * llama controla el texto.
 */
export function ilikeOrClause(columnas: string[], termino: string): string {
  return columnas.map((col) => `${col}.ilike.${valorEntrecomillado(`%${termino}%`)}`).join(",")
}

/**
 * Divide una búsqueda en palabras. Cada palabra se aplicará como un `or()`
 * independiente, y como supabase-js une los `or()` sucesivos con AND, el
 * resultado es "todas las palabras aparecen en alguna de las columnas".
 *
 * Así `"mercadona valencia"` encuentra un movimiento cuyo concepto es
 * `"COMPRA MERCADONA"` y cuya contraparte es `"Mercadona Valencia"`, en vez de
 * exigir que la frase entera esté en una sola columna.
 */
export function palabrasBusqueda(texto: string, maxPalabras = 6): string[] {
  return texto
    .trim()
    .split(/\s+/)
    .filter((p) => p.length > 0)
    .slice(0, maxPalabras)
}

/** Aplica una búsqueda de texto multi-palabra sobre varias columnas. */
export function aplicarBusquedaTexto<T extends { or: (filtro: string) => T }>(
  query: T,
  texto: string | undefined | null,
  columnas: string[],
): T {
  const limpio = (texto ?? "").trim()
  if (!limpio) return query
  let q = query
  for (const palabra of palabrasBusqueda(limpio)) {
    q = q.or(ilikeOrClause(columnas, palabra))
  }
  return q
}
