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
    sm: "text-sm px-2 py-0.5",
    md: "text-base px-4 py-2",
    lg: "text-lg px-5 py-2.5",
  }

  return (
    <div
      className={cn(
        "inline-flex items-center justify-center rounded-full font-semibold transition-all duration-200",
        isPositive
          ? "transaction-amount-positive"
          : "transaction-amount-negative",
        sizeClasses[size],
        className,
      )}
    >
      {formatCurrency(amount)}
    </div>
  )
}
