import { cn } from "../utils"

// Force thousands separator for 4+ digit integers regardless of browser locale quirks.
// Some environments use minimumGroupingDigits=2 for es-ES, which omits 1,000 grouping.
export function formatCurrency(amount: number, currency = "€"): string {
  const abs = Math.abs(amount)

  // Build "es"-style string manually to ensure 3-digit grouping always applies
  const [intPart, fracPart] = abs.toFixed(2).split(".")
  const intWithGrouping = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ".")
  const formatted = `${intWithGrouping},${fracPart}`

  return `${amount < 0 ? "-" : ""}${formatted} ${currency}`
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat("es-ES", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date)
}

export function getAmountColorClass(amount: number): string {
  return cn("font-medium", amount > 0 ? "text-green-600" : "text-red-600")
}
