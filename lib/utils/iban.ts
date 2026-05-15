// Utilidades mínimas para IBAN: limpiar, formatear y validar mod-97.

export function normalizarIban(value: string | null | undefined): string {
  if (!value) return ""
  return value.replace(/\s+/g, "").toUpperCase()
}

export function formatearIban(value: string | null | undefined): string {
  const clean = normalizarIban(value)
  if (!clean) return ""
  return clean.match(/.{1,4}/g)?.join(" ") ?? clean
}

// Valida con el algoritmo mod-97 (estándar ISO 13616).
// Devuelve true si parece un IBAN válido o si está vacío (campo opcional).
export function validarIban(value: string | null | undefined): boolean {
  const iban = normalizarIban(value)
  if (!iban) return true
  if (iban.length < 15 || iban.length > 34) return false
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(iban)) return false

  // Mover los 4 primeros caracteres al final y reemplazar letras por números (A=10..Z=35)
  const rearranged = iban.slice(4) + iban.slice(0, 4)
  let numeric = ""
  for (const char of rearranged) {
    const code = char.charCodeAt(0)
    if (code >= 48 && code <= 57) {
      numeric += char
    } else if (code >= 65 && code <= 90) {
      numeric += (code - 55).toString()
    } else {
      return false
    }
  }

  // Mod 97 sobre cadena larga
  let remainder = 0
  for (let i = 0; i < numeric.length; i++) {
    remainder = (remainder * 10 + Number(numeric[i])) % 97
  }
  return remainder === 1
}
