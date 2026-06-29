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
import { Check, Pencil } from "lucide-react"
import { CONTACTO_TIPO_INFO } from "@/lib/utils/contacto-tipos"
import type { Movimiento, MovimientoConRelaciones, Cuenta, Categoria } from "@/lib/types/database"

interface TransactionListRowProps {
  movement: MovimientoConRelaciones
  account?: Cuenta
  category?: Categoria
  categories: Categoria[]
  onMovementUpdate: (movementId: string, patch: Partial<Movimiento>) => Promise<void>
  onClick: (movement: MovimientoConRelaciones, e: React.MouseEvent) => void
  onOpenFiles?: (movement: MovimientoConRelaciones) => void
  isSelected: boolean
  selectionActive: boolean
  onSelectionChange: (selected: boolean, rangeFromAnchor?: boolean) => void
  onRequestCreateCategory?: (assign: (categoryId: string) => void | Promise<void>) => void
}

export const TransactionListRow = memo(function TransactionListRow({
  movement,
  account,
  category,
  categories,
  onMovementUpdate,
  onClick,
  onOpenFiles,
  isSelected,
  selectionActive,
  onSelectionChange,
  onRequestCreateCategory,
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

  const handleSelectionClick = (event: React.MouseEvent | React.KeyboardEvent) => {
    event.stopPropagation()
    if ("preventDefault" in event) event.preventDefault()
    const rangeFromAnchor =
      "shiftKey" in event && (event.shiftKey || event.metaKey || event.ctrlKey)
    onSelectionChange(!isSelected, rangeFromAnchor)
  }

  return (
    <div className="relative" data-testid="transaction-row">
      <div
        className={cn(
          "bg-card rounded-lg border border-border/50 p-3 hover:bg-muted/50 hover:border-border transition-[background-color,border-color,box-shadow] duration-200 cursor-pointer shadow-sm hover:shadow-md",
          !category && "border-l-4 border-l-amber-400/60 bg-amber-50/30 dark:bg-amber-950/10",
          isSelected && "border-primary/60 bg-primary/5 ring-1 ring-primary/40 hover:bg-primary/10",
        )}
        onClick={(e) => onClick(movement, e)}
        data-account-id={movement.cuenta_id}
        data-delegation-id={account?.delegacion_id}
      >
        <div className="flex items-start gap-3">
          <div className="relative flex-shrink-0 group" data-testid="transaction-selection">
            <AccountTooltip account={account}>
              <div
                className={cn(
                  "rounded-full p-0.5 cursor-pointer transition-[transform,opacity] duration-200 shadow-sm",
                  isSelected
                    ? "scale-90 opacity-0"
                    : selectionActive
                    ? "scale-95 opacity-0"
                    : "group-hover:scale-95 group-hover:opacity-0 group-hover:rotate-3",
                )}
                style={{ backgroundColor: account?.color || "#4ECDC4" }}
                data-testid="account-info"
                title={`Cuenta: ${account?.nombre || 'Sin nombre'} - Delegación ID: ${account?.delegacion_id || 'Sin delegación'}`}
              >
                <BankAvatar account={account} />
              </div>
            </AccountTooltip>

            <button
              type="button"
              role="checkbox"
              aria-checked={isSelected}
              aria-label={
                isSelected
                  ? "Quitar de la selección. Mantén Shift para seleccionar un rango."
                  : "Seleccionar transacción. Mantén Shift para seleccionar un rango."
              }
              title={
                isSelected
                  ? "Click para deseleccionar · Shift+Click para seleccionar un rango"
                  : "Click para seleccionar · Shift+Click para seleccionar un rango"
              }
              data-testid="transaction-selection-toggle"
              onClick={handleSelectionClick}
              onPointerDown={(event) => event.stopPropagation()}
              onKeyDown={(event) => {
                if (event.key === " " || event.key === "Enter") {
                  handleSelectionClick(event)
                }
              }}
              className={cn(
                "absolute -inset-2 sm:-inset-2.5 flex items-center justify-center rounded-full transition-[opacity,background-color] duration-200 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                isSelected
                  ? "opacity-100 pointer-events-auto bg-primary/5 hover:bg-primary/10"
                  : selectionActive
                  ? "opacity-100 pointer-events-auto hover:bg-primary/10"
                  : "opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-hover:bg-primary/5",
              )}
            >
              <span
                className={cn(
                  "h-9 w-9 rounded-full border-2 flex items-center justify-center transition-[color,background-color,border-color,box-shadow] shadow-md",
                  isSelected
                    ? "bg-primary border-primary text-primary-foreground shadow-lg"
                    : "bg-background border-input text-transparent",
                )}
                aria-hidden="true"
              >
                <Check className="h-5 w-5" strokeWidth={3} />
              </span>
            </button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                {editing ? (
                  <Input
                    value={conceptValue}
                    onChange={(e) => setConceptValue(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                    onFocus={(e) => e.target.select()}
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
                      pagoMcmId={(movement as any).pago_mcm_id}
                      onOpenFiles={() => onOpenFiles?.(movement)}
                    />
                  </div>
                )}

                <div onClick={(e) => e.stopPropagation()} className="flex items-center gap-1.5 flex-wrap">
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
                      onCreateCategory={
                        onRequestCreateCategory
                          ? () => onRequestCreateCategory(handleCategoryChange)
                          : undefined
                      }
                    />
                  )}
                  {movement.contacto && (
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium",
                        CONTACTO_TIPO_INFO[movement.contacto.tipo].bgClass,
                        CONTACTO_TIPO_INFO[movement.contacto.tipo].textClass,
                        CONTACTO_TIPO_INFO[movement.contacto.tipo].borderClass,
                      )}
                      title={`${CONTACTO_TIPO_INFO[movement.contacto.tipo].label}: ${movement.contacto.nombre}`}
                    >
                      <span aria-hidden>{movement.contacto.emoji ?? CONTACTO_TIPO_INFO[movement.contacto.tipo].emoji}</span>
                      <span className="max-w-[120px] truncate">{movement.contacto.nombre}</span>
                    </span>
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
