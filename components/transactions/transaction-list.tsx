"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ErrorMessage } from "@/components/ui/error-message"
import { BankAvatar } from "./bank-avatar"
import { CategoryChip } from "./category-chip"
import { formatCurrency, formatDate, getAmountColorClass } from "@/lib/utils/format"
import { getAccountDisplayName } from "@/lib/utils/movement-utils"
import { ChevronDown, ChevronUp, Edit2, Check, X, FileText } from "lucide-react"
import type { Movimiento, Cuenta, Categoria } from "@/lib/types/database"

interface TransactionListProps {
  movements: Movimiento[]
  accounts: Cuenta[]
  categories: Categoria[]
  loading: boolean
  error: string | null
  total: number
  onMovementClick: (movement: Movimiento) => void
  onMovementUpdate: (movementId: string, patch: Partial<Movimiento>) => Promise<void>
}

export function TransactionList({
  movements,
  accounts,
  categories,
  loading,
  error,
  total,
  onMovementClick,
  onMovementUpdate,
}: TransactionListProps) {
  const [expandedMovements, setExpandedMovements] = useState<Set<string>>(new Set())
  const [updatingMovements, setUpdatingMovements] = useState<Set<string>>(new Set())
  const [editingTitle, setEditingTitle] = useState<string | null>(null)
  const [editingValue, setEditingValue] = useState("")

  const toggleExpanded = (movementId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setExpandedMovements((prev) => {
      const next = new Set(prev)
      if (next.has(movementId)) {
        next.delete(movementId)
      } else {
        next.add(movementId)
      }
      return next
    })
  }

  const startEditingTitle = (movement: Movimiento, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingTitle(movement.id)
    setEditingValue(movement.concepto)
  }

  const saveTitle = async (movementId: string) => {
    if (editingValue.trim() === "") return
    
    setUpdatingMovements((prev) => new Set(prev).add(movementId))
    try {
      await onMovementUpdate(movementId, { concepto: editingValue.trim() })
      setEditingTitle(null)
      setEditingValue("")
    } catch (error) {
      console.error("Error updating title:", error)
    } finally {
      setUpdatingMovements((prev) => {
        const next = new Set(prev)
        next.delete(movementId)
        return next
      })
    }
  }

  const cancelEditing = () => {
    setEditingTitle(null)
    setEditingValue("")
  }

  const handleKeyPress = (e: React.KeyboardEvent, movementId: string) => {
    if (e.key === "Enter") {
      saveTitle(movementId)
    } else if (e.key === "Escape") {
      cancelEditing()
    }
  }

  const handleCategoriesChange = async (movementId: string, categoryIds: string[]) => {
    setUpdatingMovements((prev) => new Set(prev).add(movementId))
    try {
      // For now, we'll use the first category as the main category
      // In the future, we might want to store multiple categories in a separate table
      const categoryId = categoryIds.length > 0 ? categoryIds[0] : null
      await onMovementUpdate(movementId, { categoria_id: categoryId })
    } catch (error) {
      console.error("Error updating categories:", error)
    } finally {
      setUpdatingMovements((prev) => {
        const next = new Set(prev)
        next.delete(movementId)
        return next
      })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return <ErrorMessage message={error} />
  }

  if (movements.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">No se encontraron transacciones</p>
      </div>
    )
  }

  return (
    <div className="space-y-1 p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{total} transacciones encontradas</p>
      </div>

      {movements.map((movement) => {
        const account = accounts.find((acc) => acc.id === movement.cuenta_id)
        const category = categories.find((cat) => cat.id === movement.categoria_id)
        const isExpanded = expandedMovements.has(movement.id)
        const isUpdating = updatingMovements.has(movement.id)
        const isEditingTitle = editingTitle === movement.id

        return (
          <div
            key={movement.id}
            className="bg-card rounded-lg border p-4 hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => onMovementClick(movement)}
          >
            <div className="flex items-start gap-3">
              {/* Bank Avatar */}
              <BankAvatar account={account} />

              {/* Content */}
              <div className="flex-1 min-w-0">
                {/* Title with inline editing */}
                <div className="mb-2">
                  {isEditingTitle ? (
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <Input
                        value={editingValue}
                        onChange={(e) => setEditingValue(e.target.value)}
                        onKeyDown={(e) => handleKeyPress(e, movement.id)}
                        className="h-8 text-base font-semibold"
                        autoFocus
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => saveTitle(movement.id)}
                        disabled={isUpdating}
                        className="h-8 w-8 p-0"
                      >
                        {isUpdating ? (
                          <LoadingSpinner size="sm" />
                        ) : (
                          <Check className="h-4 w-4 text-green-600" />
                        )}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={cancelEditing}
                        className="h-8 w-8 p-0"
                      >
                        <X className="h-4 w-4 text-red-600" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 group">
                      <h3 
                        className="font-semibold text-base leading-tight truncate cursor-pointer hover:text-primary transition-colors"
                        onClick={(e) => startEditingTitle(movement, e)}
                      >
                        {movement.concepto}
                      </h3>
                      <button
                        onClick={(e) => startEditingTitle(movement, e)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded"
                      >
                        <Edit2 className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Categories */}
                <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                  {isUpdating ? (
                    <div className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      <span className="text-xs text-muted-foreground">Actualizando...</span>
                    </div>
                  ) : (
                    <CategoryChip
                      categories={category ? [category] : []}
                      allCategories={categories}
                      onCategoriesChange={(categoryIds) => handleCategoriesChange(movement.id, categoryIds)}
                    />
                  )}
                </div>

                {/* Date and Account */}
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                  <span>{formatDate(movement.fecha)}</span>
                  {account && <span className="truncate max-w-[120px]">{getAccountDisplayName(account)}</span>}
                </div>

                {/* Description indicator and expandable content */}
                {movement.descripcion && (
                  <div className="mt-2">
                    <div className="flex items-center gap-2 mb-1">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-auto p-0 text-xs text-muted-foreground hover:text-foreground"
                        onClick={(e) => toggleExpanded(movement.id, e)}
                      >
                        {isExpanded ? (
                          <>
                            <ChevronUp className="h-3 w-3 mr-1" />
                            Ocultar descripción
                          </>
                        ) : (
                          <>
                            <ChevronDown className="h-3 w-3 mr-1" />
                            Ver descripción
                          </>
                        )}
                      </Button>
                    </div>
                    {isExpanded && (
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed pl-5">{movement.descripcion}</p>
                    )}
                  </div>
                )}
              </div>

              {/* Amount */}
              <div className={`text-right ${getAmountColorClass(movement.importe)}`}>
                <div className="font-semibold text-lg">{formatCurrency(movement.importe)}</div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
