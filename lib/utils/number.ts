/**
 * Convierte un valor a número soportando formato europeo (coma decimal) y
 * americano (punto decimal). Pensado para la entrada de importes en una app
 * española, donde el usuario escribe "270,41" en lugar de "270.41".
 *
 * Ejemplos:
 *   "270,41"       -> 270.41
 *   "1.234,56"     -> 1234.56   (miles europeo + decimal)
 *   "1,234.56"     -> 1234.56   (miles americano + decimal)
 *   "1.234"        -> 1234      (miles europeo sin decimales)
 *   "1234.56"      -> 1234.56   (decimal americano)
 *   "-12,5 €"      -> -12.5
 *
 * Devuelve NaN si el valor no es parseable (cadena vacía, texto, etc.),
 * de modo que quien llame pueda validarlo con Number.isFinite().
 */
export function parseEuropeanNumber(value: string | number | null | undefined): number {
  if (typeof value === "number") return value
  if (value == null) return NaN

  // Limpiar el valor: quitar espacios, símbolos de euro, paréntesis, etc.
  const cleanValue = String(value)
    .trim()
    .replace(/\s/g, "") // Quitar espacios
    .replace(/€/g, "") // Quitar símbolo de euro
    .replace(/[()]/g, "") // Quitar paréntesis (para números negativos)
    .replace(/^[+-]\s*/, (match) => match.replace(/\s/g, "")) // Mantener signo sin espacios

  if (cleanValue === "" || cleanValue === "-" || cleanValue === "+") {
    return NaN
  }

  // Si no tiene comas ni puntos, es un número entero
  if (!/[,.]/.test(cleanValue)) {
    return parseFloat(cleanValue)
  }

  const commaCount = (cleanValue.match(/,/g) || []).length
  const dotCount = (cleanValue.match(/\./g) || []).length

  if (commaCount === 0 && dotCount === 1) {
    // Solo punto: decimal inglés (1234.56) o miles español (1.234)
    const parts = cleanValue.split(".")
    if (parts[1].length <= 2) {
      return parseFloat(cleanValue)
    }
    return parseFloat(cleanValue.replace(".", ""))
  }

  if (dotCount === 0 && commaCount === 1) {
    // Solo coma: decimal español (270,41) -> 270.41
    return parseFloat(cleanValue.replace(",", "."))
  }

  if (commaCount === 1 && dotCount >= 1) {
    // Formato europeo: 1.234.567,89 -> 1234567.89
    const lastCommaIndex = cleanValue.lastIndexOf(",")
    const beforeComma = cleanValue.substring(0, lastCommaIndex).replace(/\./g, "")
    const afterComma = cleanValue.substring(lastCommaIndex + 1)
    return parseFloat(beforeComma + "." + afterComma)
  }

  if (dotCount === 1 && commaCount >= 1) {
    // Formato americano: 1,234,567.89 -> 1234567.89
    const lastDotIndex = cleanValue.lastIndexOf(".")
    const beforeDot = cleanValue.substring(0, lastDotIndex).replace(/,/g, "")
    const afterDot = cleanValue.substring(lastDotIndex + 1)
    return parseFloat(beforeDot + "." + afterDot)
  }

  // Formato ambiguo: usar la estrategia más común (europeo)
  return parseFloat(cleanValue.replace(/\./g, "").replace(",", "."))
}
