"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ErrorMessage } from "@/components/ui/error-message"
import { BankAvatar } from "./bank-avatar"
import { CategoryChip } from "./category-chip"
import { formatCurrency, formatDate, getAmountColorClass } from "@/lib/utils/format"
import { getAccountDisplayName } from "@/lib/utils/movement-utils"
import { ChevronDown, ChevronUp } from "lucide-react"
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

  const handleCategoryChange = async (movementId: string, categoryId: string | null) => {
    setUpdatingMovements((prev) => new Set(prev).add(movementId))
    try {
      await onMovementUpdate(movementId, { categoria_id: categoryId })
    } catch (error) {
      console.error("Error updating category:", error)
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
        const category = categories.find((cat) => cat.id === movement.categoria_id) as Categoria | undefined
        const isExpanded = expandedMovements.has(movement.id)
        const isUpdating = updatingMovements.has(movement.id)

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
                {/* Title */}
                <h3 className="font-semibold text-base leading-tight mb-1 truncate">{movement.concepto}</h3>

                {/* Category */}
                <div className="mb-2" onClick={(e) => e.stopPropagation()}>
                  {isUpdating ? (
                    <div className="flex items-center gap-2">
                      <LoadingSpinner size="sm" />
                      <span className="text-xs text-muted-foreground">Actualizando...</span>
                    </div>
                  ) : (
                    <CategoryChip
                      category={category as unknown as Categoria}
                      categories={categories as unknown as Categoria[]}
                      onCategoryChange={(categoryId) => handleCategoryChange(movement.id, categoryId)}
                    />
                  )}
                </div>

                {/* Date and Account */}
                <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                  <span>{formatDate(movement.fecha)}</span>
                  {account && <span className="truncate max-w-[120px]">{getAccountDisplayName(account)}</span>}
                </div>

                {/* Description (expandable) */}
                {movement.descripcion && (
                  <div className="mt-2">
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
                    {isExpanded && (
                      <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{movement.descripcion}</p>
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
