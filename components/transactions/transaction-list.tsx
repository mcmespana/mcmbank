"use client"

import type React from "react"

import { useState } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ErrorMessage } from "@/components/ui/error-message"
import { BankAvatar } from "./bank-avatar"
import { CategoryChip } from "./category-chip"
import { AmountDisplay } from "@/components/ui/amount-display"
import { AccountTooltip } from "./account-tooltip"
import { formatDate } from "@/lib/utils/format"
import { Input } from "@/components/ui/input"
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
  const [updatingMovements, setUpdatingMovements] = useState<Set<string>>(new Set())
  const [editingConcept, setEditingConcept] = useState<string | null>(null)
  const [conceptValue, setConceptValue] = useState("")

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

  const handleConceptClick = (movement: Movimiento, e: React.MouseEvent) => {
    e.stopPropagation()
    setEditingConcept(movement.id)
    setConceptValue(movement.concepto)
  }

  const handleConceptSave = async (movementId: string) => {
    if (conceptValue.trim() !== "") {
      try {
        await onMovementUpdate(movementId, { concepto: conceptValue.trim() })
      } catch (error) {
        console.error("Error updating concept:", error)
      }
    }
    setEditingConcept(null)
    setConceptValue("")
  }

  const handleConceptCancel = () => {
    setEditingConcept(null)
    setConceptValue("")
  }

  const handleTransactionClick = (movement: Movimiento, e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest("button") && !target.closest('[role="button"]') && !target.closest("input")) {
      onMovementClick(movement)
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
    <div className="space-y-1 p-2 sm:p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">{total} transacciones encontradas</p>
      </div>

      {movements.map((movement) => {
        const account = accounts.find((acc) => acc.id === movement.cuenta_id)
        const category = categories.find((cat) => cat.id === movement.categoria_id) as Categoria | undefined
        const isUpdating = updatingMovements.has(movement.id)
        const isEditingThisConcept = editingConcept === movement.id

        return (
          <div key={movement.id} className="relative">
            <div
              className="bg-card rounded-lg border p-3 sm:p-4 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={(e) => handleTransactionClick(movement, e)}
            >
              <div className="flex items-start gap-3">
                <AccountTooltip account={account}>
                  <div
                    className="rounded-full p-0.5 cursor-pointer hover:scale-105 transition-transform flex-shrink-0"
                    style={{
                      backgroundColor: account?.color || "#4ECDC4",
                      boxShadow: `0 0 0 2px ${account?.color || "#4ECDC4"}20`,
                    }}
                  >
                    <BankAvatar account={account} />
                  </div>
                </AccountTooltip>

                {/* Content - Mobile optimized */}
                <div className="flex-1 min-w-0 space-y-2">
                  {/* Top row: Concept and Amount */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {isEditingThisConcept ? (
                        <Input
                          value={conceptValue}
                          onChange={(e) => setConceptValue(e.target.value)}
                          onBlur={() => handleConceptSave(movement.id)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              handleConceptSave(movement.id)
                            } else if (e.key === "Escape") {
                              handleConceptCancel()
                            }
                          }}
                          className="text-sm font-semibold h-6 px-2"
                          autoFocus
                        />
                      ) : (
                        <h3
                          className="font-semibold text-sm leading-tight cursor-pointer hover:text-primary line-clamp-2 sm:line-clamp-1"
                          onClick={(e) => handleConceptClick(movement, e)}
                        >
                          {movement.concepto}
                        </h3>
                      )}
                    </div>

                    <div className="flex-shrink-0">
                      <AmountDisplay amount={movement.importe} size="sm" />
                    </div>
                  </div>

                  {/* Bottom row: Date and Category */}
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground/70 bg-muted/30 px-2 py-1 rounded-md whitespace-nowrap">
                        {formatDate(movement.fecha)}
                      </span>
                    </div>

                    <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                      {isUpdating ? (
                        <div className="flex items-center gap-2">
                          <LoadingSpinner size="sm" />
                          <span className="text-xs text-muted-foreground hidden sm:inline">Actualizando...</span>
                        </div>
                      ) : (
                        <CategoryChip
                          category={category as unknown as Categoria}
                          categories={categories as unknown as Categoria[]}
                          onCategoryChange={(categoryId) => handleCategoryChange(movement.id, categoryId)}
                        />
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
