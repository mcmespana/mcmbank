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
import { Pencil, Check } from "lucide-react"
import type { Movimiento, MovimientoConRelaciones, Cuenta, Categoria } from "@/lib/types/database"

interface TransactionListRowProps {
  movement: MovimientoConRelaciones
  account?: Cuenta
  category?: Categoria
  categories: Categoria[]
  onMovementUpdate: (movementId: string, patch: Partial<Movimiento>) => Promise<void>
  onClick: (movement: MovimientoConRelaciones, e: React.MouseEvent) => void
  onOpenFiles?: (movement: MovimientoConRelaciones) => void
  isSelected?: boolean
  selectionActive?: boolean
  onToggleSelection?: (movementId: string, nextSelected: boolean) => void
}

export const TransactionListRow = memo(function TransactionListRow({
  movement,
  account,
  category,
  categories,
  onMovementUpdate,
  onClick,
  onOpenFiles,
  isSelected = false,
  selectionActive = false,
  onToggleSelection,
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

  const handleSelectionToggle = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    onToggleSelection?.(movement.id, !isSelected)
  }

  return (
    <div className="relative" data-testid="transaction-row">
      <div
        className={cn(
          "bg-card rounded-lg border border-border/50 p-3 hover:bg-muted/50 hover:border-border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md",
          !category && "border-l-4 border-l-amber-400/60 bg-amber-50/30 dark:bg-amber-950/10",
          isSelected && "border-primary/60 bg-primary/10 shadow-md hover:border-primary/60 hover:bg-primary/10",
          selectionActive && !isSelected && "border-primary/30"
        )}
        onClick={(e) => onClick(movement, e)}
        data-account-id={movement.cuenta_id}
        data-delegation-id={account?.delegacion_id}
      >
        <div className="flex items-start gap-3">
          <AccountTooltip account={account}>
            <div className="relative flex-shrink-0" data-testid="account-info">
              <div
                className="group/account relative h-10 w-10"
                title={`Cuenta: ${account?.nombre || "Sin nombre"} - Delegación ID: ${account?.delegacion_id || "Sin delegación"}`}
              >
                <button
                  type="button"
                  onClick={handleSelectionToggle}
                  aria-pressed={isSelected}
                  aria-label={isSelected ? "Quitar de la selección" : "Seleccionar transacción"}
                  className={`absolute left-0 top-0 flex h-10 w-10 items-center justify-center rounded-full border border-primary/40 bg-background/90 text-primary shadow-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${
                    isSelected
                      ? "opacity-100 scale-100 pointer-events-auto bg-primary text-primary-foreground border-primary"
                      : selectionActive
                        ? "opacity-100 scale-100 pointer-events-auto"
                        : "opacity-0 scale-95 pointer-events-none group-hover/account:opacity-100 group-hover/account:scale-100 group-hover/account:pointer-events-auto"
                  }`}
                >
                  {isSelected ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full border border-primary/50" />
                  )}
                </button>

                <div
                  className={cn(
                    "relative h-10 w-10 rounded-full p-0.5 shadow-sm transition-all duration-200",
                    isSelected
                      ? "opacity-0 scale-90"
                      : selectionActive
                        ? "opacity-0 scale-95"
                        : "opacity-100 scale-100 group-hover/account:opacity-0 group-hover/account:scale-95",
                  )}
                  style={{ backgroundColor: account?.color || "#4ECDC4" }}
                >
                  <BankAvatar account={account} />
                </div>
              </div>
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
                    <TransactionRowIndicators 
                      description={movement.descripcion} 
                      fileCount={movement.archivos?.length || 0}
                      onOpenFiles={() => onOpenFiles?.(movement)}
                    />
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
                      movement={movement}
                      account={account}
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
