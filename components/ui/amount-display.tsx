"use client"

import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface AmountDisplayProps {
  amount: number
  size?: "sm" | "md" | "lg"
  variant?: "default" | "compact"
  className?: string
}

export function AmountDisplay({ amount, size = "md", variant = "default", className }: AmountDisplayProps) {
  const isPositive = amount > 0

  const sizeClasses = {
    sm: "text-sm px-3 py-2 min-w-[80px]",
    md: "text-base px-4 py-2.5 min-w-[100px]",
    lg: "text-lg px-5 py-3 min-w-[120px]",
  }

  const baseClasses = cn(
    "font-semibold rounded-full border transition-colors text-center inline-flex items-center justify-center",
    sizeClasses[size],
    isPositive
      ? "text-green-700 bg-green-100 border-green-300 dark:text-green-400 dark:bg-green-950/30 dark:border-green-700"
      : "text-red-700 bg-red-100 border-red-300 dark:text-red-400 dark:bg-red-950/30 dark:border-red-700",
    className,
  )

  return <div className={baseClasses}>{formatCurrency(amount)}</div>
}
