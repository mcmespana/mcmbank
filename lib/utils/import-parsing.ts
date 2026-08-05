// Utilidades puras para la importación manual de Excel/CSV
// (components/transactions/transaction-import-panel.tsx). Sin imports de
// Supabase — deben permanecer testeables de forma aislada.

export type ImportDateError = Error & { code: "INVALID_DATE" }

function invalidDateError(raw: string | number): ImportDateError {
  return Object.assign(new Error(`Fecha inválida: "${raw}"`), { code: "INVALID_DATE" as const })
}

function pad2(n: number): string {
  return String(n).padStart(2, "0")
}

/**
 * Convierte un valor de fecha proveniente de una celda de Excel/CSV a una
 * cadena "yyyy-MM-dd", sin pasar nunca por un `Date` interpretado en hora
 * local para el resultado final (eso es lo que causaba el desfase de ±1 día
 * según la zona horaria del navegador). Lanza un error con `code:
 * "INVALID_DATE"` si el valor no se puede interpretar.
 */
export function parseImportDate(raw: string | number): string {
  if (typeof raw === "number") {
    // Número serial de Excel (días desde 1899-12-30). Se calcula el
    // instante UTC correspondiente y se lee con getters UTC — nunca con
    // format() en hora local.
    const utcMs = Math.round(raw - 25569) * 86400 * 1000
    const date = new Date(utcMs)
    if (isNaN(date.getTime())) throw invalidDateError(raw)
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())}`
  }

  const dateString = raw.trim()

  if (dateString.includes("/")) {
    // d/M/yyyy o dd/MM/yyyy — se parte el texto directamente, sin pasar por
    // date-fns/Date (evita cualquier ambigüedad de zona horaria).
    const parts = dateString.split("/")
    if (parts.length !== 3) throw invalidDateError(raw)
    const [d, m, y] = parts.map((p) => Number(p))
    if (!Number.isFinite(d) || !Number.isFinite(m) || !Number.isFinite(y)) throw invalidDateError(raw)
    // Validamos que sea una fecha real (p.ej. rechaza 31/02) usando un Date
    // local solo para la validación; el string de salida se construye a mano.
    const check = new Date(y, m - 1, d)
    if (check.getFullYear() !== y || check.getMonth() !== m - 1 || check.getDate() !== d) {
      throw invalidDateError(raw)
    }
    return `${y}-${pad2(m)}-${pad2(d)}`
  }

  const isoMatch = dateString.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoMatch) {
    // yyyy-MM-dd (con o sin sufijo de hora) — se valida y se devuelve la
    // parte de fecha tal cual, sin reinterpretarla.
    const [, y, m, d] = isoMatch
    const check = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)))
    if (isNaN(check.getTime())) throw invalidDateError(raw)
    return `${y}-${m}-${d}`
  }

  // Cualquier otro formato: se parsea y se lee con getters UTC, coherente
  // con la convención de las cadenas ISO anteriores.
  const parsed = new Date(dateString)
  if (isNaN(parsed.getTime())) throw invalidDateError(raw)
  return `${parsed.getUTCFullYear()}-${pad2(parsed.getUTCMonth() + 1)}-${pad2(parsed.getUTCDate())}`
}

/**
 * Parser CSV mínimo (separador coma, comillas dobles para escapar comas).
 * Limitación conocida y aceptada: no soporta saltos de línea dentro de un
 * campo entrecomillado (se corta en el salto de línea igual que antes de
 * esta extracción) — ver el test de caracterización correspondiente.
 */
export function parseCsv(text: string): string[][] {
  return text
    .split("\n")
    .map((line) => {
      const cells: string[] = []
      let currentCell = ""
      let inQuotes = false
      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === "," && !inQuotes) {
          cells.push(currentCell.trim())
          currentCell = ""
        } else {
          currentCell += char
        }
      }
      cells.push(currentCell.trim())
      return cells
    })
    .filter((row) => row.some((cell) => cell.length > 0))
}
