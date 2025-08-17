"use client"

import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils/format"
import type { Categoria, Movimiento } from "@/lib/types/database"

interface CategoryBalanceProps {
  category: Categoria
  movements: Movimiento[]
}

export function CategoryBalance({ category, movements }: CategoryBalanceProps) {
  // Calculate balance for this category
  const categoryMovements = movements.filter(mov => mov.categoria_id === category.id)
  const balance = categoryMovements.reduce((sum, mov) => sum + mov.importe, 0)
  
  // Determine badge variant based on balance
  let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "outline"
  let balanceColor = "text-muted-foreground"
  
  if (balance > 0) {
    badgeVariant = "default"
    balanceColor = "text-green-700"
  } else if (balance < 0) {
    badgeVariant = "destructive"
    balanceColor = "text-red-700"
  } else {
    badgeVariant = "secondary"
    balanceColor = "text-blue-700"
  }

  return (
    <Badge variant={badgeVariant} className="text-xs font-medium">
      <span className={balanceColor}>
        {formatCurrency(balance)}
      </span>
    </Badge>
  )
}