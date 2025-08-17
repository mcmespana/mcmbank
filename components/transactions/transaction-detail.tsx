"use client"

import { TransactionFormEnhanced } from "./transaction-form-enhanced"
import type { Movimiento, Cuenta, Categoria } from "@/lib/types/database"

interface TransactionDetailProps {
  movement: Movimiento | null
  accounts: Cuenta[]
  categories: Categoria[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (movementId: string, patch: Partial<Movimiento>) => Promise<void>
}

export function TransactionDetail({
  movement,
  accounts,
  categories,
  open,
  onOpenChange,
  onUpdate,
}: TransactionDetailProps) {
  const handleEditSave = async (data: Partial<any>) => {
    try {
      await onUpdate(movement?.id || "", data)
    } catch (error) {
      console.error("Error updating movement:", error)
      throw error
    }
  }

  if (!movement) return null

  return (
    <TransactionFormEnhanced
      open={open}
      onOpenChange={onOpenChange}
      movement={movement as any}
      accounts={accounts}
      categories={categories}
      onSave={handleEditSave}
      mode="edit"
    />
  )
}
