"use client"

import { useState, memo } from "react"
import { BankAvatar } from "./bank-avatar"
import { CategoryChip } from "./category-chip"
import { AmountDisplay } from "@/components/ui/amount-display"
import { AccountTooltip } from "./account-tooltip"
import { TransactionRowIndicators } from "./transaction-row-indicators"
import { formatDate } from "@/lib/utils/format"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { cn } from "@/lib/utils"
import type { Movimiento, MovimientoConRelaciones, Cuenta, Categoria } from "@/lib/types/database"

interface TransactionListRowProps {
  movement: MovimientoConRelaciones
  account?: Cuenta
  category?: Categoria
  categories: Categoria[]
  onMovementUpdate: (movementId: string, patch: Partial<Movimiento>) => Promise<void>
  onClick: (movement: MovimientoConRelaciones, e: React.MouseEvent) => void
}

export const TransactionListRow = memo(function TransactionListRow({
  movement,
  account,
  category,
  categories,
  onMovementUpdate,
  onClick,
}: TransactionListRowProps) {
  const [isUpdating, setIsUpdating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [conceptValue, setConceptValue] = useState(movement.concepto)

  const handleCategoryChange = async (categoryId: string | null) => {
    setIsUpdating(true)
    try {
      await onMovementUpdate(movement.id, { categoria_id: categoryId })
    } catch (error) {
      console.error("Error updating category:", error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleConceptClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditing(true)
  }

  const handleConceptSave = async () => {
    if (conceptValue.trim() !== "" && conceptValue.trim() !== movement.concepto) {
      try {
        await onMovementUpdate(movement.id, { concepto: conceptValue.trim() })
      } catch (error) {
        console.error("Error updating concept:", error)
      }
    }
    setEditing(false)
  }

  const handleConceptCancel = () => {
    setConceptValue(movement.concepto)
    setEditing(false)
  }

  return (
    <div
      className="relative rounded-lg border bg-card text-card-foreground shadow-sm transition-all duration-200 hover:border-primary/30 hover:shadow-md"
      data-testid="transaction-row"
    >
      <div
        className="grid cursor-pointer grid-cols-12 items-center gap-3 p-3"
        onClick={(e) => onClick(movement, e)}
        data-account-id={movement.cuenta_id}
        data-delegation-id={account?.delegacion_id}
      >
        {/* Uncategorized indicator */}
        {!category && (
          <div
            className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-amber-400"
            title="Sin categorizar"
          />
        )}

        {/* Account Avatar */}
        <div className="col-span-1">
          <AccountTooltip account={account}>
            <div
              className="flex-shrink-0 cursor-pointer p-0.5 transition-transform hover:scale-105"
              style={{ backgroundColor: account?.color || "#4ECDC4" }}
              data-testid="account-info"
              title={`Cuenta: ${account?.nombre || 'Sin nombre'} - Delegación ID: ${account?.delegacion_id || 'Sin delegación'}`}
            >
              <BankAvatar account={account} />
            </div>
          </AccountTooltip>
        </div>

        {/* Concept and Category */}
        <div className="col-span-11 sm:col-span-7 md:col-span-8">
          {editing ? (
            <Input
              value={conceptValue}
              onChange={(e) => setConceptValue(e.target.value)}
              onBlur={handleConceptSave}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConceptSave()
                else if (e.key === "Escape") handleConceptCancel()
              }}
              className="h-7 px-2 text-sm font-semibold"
              autoFocus
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <div className="flex items-center gap-2">
              <h3
                className="flex-1 cursor-pointer truncate text-sm font-semibold leading-tight transition-colors hover:text-primary"
                onClick={handleConceptClick}
              >
                {movement.concepto}
              </h3>
              <TransactionRowIndicators description={movement.descripcion} fileCount={movement.archivos?.length || 0} />
            </div>
          )}
          <div className="mt-1" onClick={(e) => e.stopPropagation()}>
            {isUpdating ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="sm" />
                <span className="hidden text-xs text-muted-foreground sm:inline">Actualizando...</span>
              </div>
            ) : (
              <CategoryChip
                category={category}
                categories={categories}
                onCategoryChange={(categoryId) => handleCategoryChange(categoryId)}
              />
            )}
          </div>
        </div>

        {/* Amount and Date */}
        <div className="col-span-12 mt-2 text-right sm:col-span-4 sm:mt-0 md:col-span-3">
          <div className="mb-0.5">
            <AmountDisplay amount={movement.importe} size="sm" />
          </div>
          <div className="inline-block whitespace-nowrap rounded-md bg-muted/50 px-2 py-0.5 text-xs text-muted-foreground">
            {formatDate(movement.fecha)}
          </div>
        </div>
      </div>
    </div>
  )
})

