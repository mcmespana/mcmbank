import { cn } from "../utils"

export function formatCurrency(amount: number, currency = "€"): string {
  const formatted = new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(amount))

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
