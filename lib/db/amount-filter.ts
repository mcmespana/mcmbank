/**
 * Aplica un filtro por VALOR ABSOLUTO de `importe` sobre un query de Supabase.
 * Hace coincidir tanto importes positivos como negativos cuyo |importe| esté
 * en el rango [from, to].
 *
 * Nota de implementación: evita `and()` anidado dentro de `or()` (poco fiable en
 * PostgREST/supabase-js) combinando un rango encadenado con un único `or()`.
 *
 * Función pura sobre el query builder (no importa el cliente de Supabase), por
 * lo que es directamente testeable.
 */
export function applyAbsoluteAmountFilter<T extends { gte: any; lte: any; or: any }>(
  query: T,
  amountFrom: number | undefined,
  amountTo: number | undefined
): T {
  if (amountFrom !== undefined && amountTo !== undefined) {
    const minAbs = Math.min(Math.abs(amountFrom), Math.abs(amountTo))
    const maxAbs = Math.max(Math.abs(amountFrom), Math.abs(amountTo))
    // |importe| in [minAbs, maxAbs] ⇔ importe in [-maxAbs, -minAbs] ∪ [minAbs, maxAbs]
    // Equivalently: -maxAbs <= importe <= maxAbs AND (importe >= minAbs OR importe <= -minAbs)
    return query
      .gte("importe", -maxAbs)
      .lte("importe", maxAbs)
      .or(`importe.gte.${minAbs},importe.lte.${-minAbs}`)
  }
  if (amountFrom !== undefined) {
    const val = Math.abs(amountFrom)
    return query.or(`importe.gte.${val},importe.lte.${-val}`)
  }
  if (amountTo !== undefined) {
    const val = Math.abs(amountTo)
    return query.gte("importe", -val).lte("importe", val)
  }
  return query
}
