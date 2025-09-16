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
import { Button } from "@/components/ui/button"
import { Pencil } from "lucide-react"
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
    if (conceptValue.trim() !== "") {
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
    <div className="relative" data-testid="transaction-row">
      <div
        className={cn(
          "bg-card rounded-lg border border-border/50 p-3 hover:bg-muted/50 hover:border-border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md",
          !category && "border-l-4 border-l-amber-400/60 bg-amber-50/30 dark:bg-amber-950/10"
        )}
        onClick={(e) => onClick(movement, e)}
        data-account-id={movement.cuenta_id}
        data-delegation-id={account?.delegacion_id}
      >
        <div className="flex items-start gap-3">
          <AccountTooltip account={account}>
            <div
              className="rounded-full p-0.5 cursor-pointer hover:scale-105 transition-transform flex-shrink-0 shadow-sm"
              style={{ backgroundColor: account?.color || "#4ECDC4" }}
              data-testid="account-info"
              title={`Cuenta: ${account?.nombre || 'Sin nombre'} - Delegación ID: ${account?.delegacion_id || 'Sin delegación'}`}
            >
              <BankAvatar account={account} />
            </div>
          </AccountTooltip>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {editing ? (
                  <Input
                    value={conceptValue}
                    onChange={(e) => setConceptValue(e.target.value)}
                    onBlur={handleConceptSave}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleConceptSave()
                      else if (e.key === "Escape") handleConceptCancel()
                    }}
                    className="text-sm font-semibold h-6 px-2"
                    autoFocus
                  />
                ) : (
                  <div className="flex items-center gap-2 mb-1">
                    <h3
                      className="font-semibold text-sm leading-tight cursor-pointer hover:text-primary line-clamp-1 transition-colors flex-1"
                      onClick={handleConceptClick}
                    >
                      {movement.concepto}
                    </h3>
                    <TransactionRowIndicators description={movement.descripcion} fileCount={movement.archivos?.length || 0} />
                  </div>
                )}

                <div onClick={(e) => e.stopPropagation()}>
                  {isUpdating ? (
                    <div className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      <span className="text-xs text-muted-foreground hidden sm:inline">Actualizando...</span>
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

              <div className="flex-shrink-0 flex items-start gap-2 min-w-0">
                <div className="text-right">
                  <div className="mb-0.5">
                    <AmountDisplay amount={movement.importe} size="sm" />
                  </div>
                  <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md whitespace-nowrap inline-block">
                    {formatDate(movement.fecha)}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={(e) => {
                    e.stopPropagation()
                    onClick(movement, e)
                  }}
                  aria-label="Editar transacción"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})

