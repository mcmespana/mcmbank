"use client"

import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface AmountDisplayProps {
  amount: number
  size?: "sm" | "md" | "lg"
  className?: string
}

export function AmountDisplay({ amount, size = "md", className }: AmountDisplayProps) {
  const isPositive = amount > 0

  const sizeClasses = {
    sm: "text-sm px-3 py-1",
    md: "text-base px-4 py-2",
    lg: "text-lg px-5 py-2.5",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold transition-colors",
        isPositive
          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
          : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400",
        sizeClasses[size],
        className,
      )}
    >
      {formatCurrency(amount)}
    </div>
  )
}
