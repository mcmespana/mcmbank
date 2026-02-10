export function formatIsoDateToInput(isoDate?: string | null): string {
  if (!isoDate) return ""

  const isoMatch = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (isoMatch) {
    const [, year, month, day] = isoMatch
    return `${day}/${month}/${year}`
  }

  const parsedDate = new Date(isoDate)
  if (Number.isNaN(parsedDate.getTime())) {
    return ""
  }

  const day = String(parsedDate.getDate()).padStart(2, "0")
  const month = String(parsedDate.getMonth() + 1).padStart(2, "0")
  const year = parsedDate.getFullYear()

  return `${day}/${month}/${year}`
}

export function maskDateInput(rawValue: string): string {
  const digits = rawValue.replace(/\D/g, "").slice(0, 8)

  if (digits.length <= 2) {
    return digits
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

export function parseDateInputToIso(inputValue: string): string | null {
  const digits = inputValue.replace(/\D/g, "")
  if (digits.length !== 8) {
    return null
  }

  const day = Number(digits.slice(0, 2))
  const month = Number(digits.slice(2, 4))
  const year = Number(digits.slice(4, 8))

  const parsedDate = new Date(year, month - 1, day)
  const isValid =
    parsedDate.getFullYear() === year &&
    parsedDate.getMonth() === month - 1 &&
    parsedDate.getDate() === day

  if (!isValid) {
    return null
  }

  const isoDay = String(day).padStart(2, "0")
  const isoMonth = String(month).padStart(2, "0")

  return `${year}-${isoMonth}-${isoDay}`
}
