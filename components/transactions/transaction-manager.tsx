"use client"

import { useState, useMemo } from "react"
import { TransactionFiltersComponent } from "./transaction-filters"
import { TransactionTable } from "./transaction-table"
import { TransactionDetail } from "./transaction-detail"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovements } from "@/hooks/use-movements"
import { useCategories } from "@/hooks/use-categories"
import { useAccounts } from "@/hooks/use-accounts"
import type { ListMovementsParams } from "@/lib/data-adapter"
import type { Movimiento } from "@/lib/types"

export interface TransactionFilters {
  dateFrom?: string
  dateTo?: string
  categoryId?: string
  amountMin?: number
  amountMax?: number
}

export function TransactionManager() {
  const { selectedDelegation } = useDelegationContext()
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [selectedMovement, setSelectedMovement] = useState<Movimiento | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const movementParams: ListMovementsParams = useMemo(
    () => ({
      delegation_id: selectedDelegation || "",
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      category_id: filters.categoryId,
      amount_min: filters.amountMin,
      amount_max: filters.amountMax,
      page: 1,
      page_size: 100,
    }),
    [selectedDelegation, filters.dateFrom, filters.dateTo, filters.categoryId, filters.amountMin, filters.amountMax],
  )

  const { movements, total, loading, error, updateMovement } = useMovements(movementParams)
  const { categories } = useCategories("org-1") // TODO: Get from delegation context
  const { accounts } = useAccounts(selectedDelegation || "")

  const handleMovementClick = (movement: Movimiento) => {
    setSelectedMovement(movement)
    setDetailOpen(true)
  }

  const handleMovementUpdate = async (movementId: string, patch: Partial<Movimiento>) => {
    try {
      await updateMovement(movementId, patch)
      // Update selected movement if it's the one being edited
      if (selectedMovement?.id === movementId) {
        setSelectedMovement((prev) => (prev ? { ...prev, ...patch } : null))
      }
    } catch (error) {
      console.error("Error updating movement:", error)
      throw error
    }
  }

  const clearFilters = () => {
    setFilters({})
  }

  if (!selectedDelegation) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Selecciona una delegación para ver las transacciones</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <TransactionFiltersComponent
        filters={filters}
        onFiltersChange={setFilters}
        onClearFilters={clearFilters}
        categories={categories}
      />

      <TransactionTable
        movements={movements}
        accounts={accounts}
        categories={categories}
        loading={loading}
        error={error}
        total={total}
        onMovementClick={handleMovementClick}
        onMovementUpdate={handleMovementUpdate}
      />

      <TransactionDetail
        movement={selectedMovement}
        accounts={accounts}
        categories={categories}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdate={handleMovementUpdate}
      />
    </div>
  )
}
