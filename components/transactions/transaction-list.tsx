"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ErrorMessage } from "@/components/ui/error-message"
import { BankAvatar } from "./bank-avatar"
import { CategoryChip } from "./category-chip"
import { AmountDisplay } from "@/components/ui/amount-display"
import { AccountTooltip } from "./account-tooltip"
import { formatDate } from "@/lib/utils/format"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
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
  onLoadMore?: () => void
  hasMore?: boolean
  loadingMore?: boolean
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
  onLoadMore,
  hasMore,
  loadingMore,
}: TransactionListProps) {
  const [updatingMovements, setUpdatingMovements] = useState<Set<string>>(new Set())
  const [editingConcept, setEditingConcept] = useState<string | null>(null)
  const [conceptValue, setConceptValue] = useState("")
  const loaderRef = useRef<HTMLDivElement | null>(null)

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

  useEffect(() => {
    if (!onLoadMore) return
    const el = loaderRef.current
    if (!el) return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        onLoadMore()
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, [onLoadMore])

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
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto bg-muted/50 rounded-full flex items-center justify-center">
            <span className="text-2xl text-muted-foreground">📊</span>
          </div>
          <h3 className="text-lg font-medium text-foreground">No se encontraron transacciones</h3>
          <p className="text-sm text-muted-foreground max-w-sm">
            Prueba ajustando los filtros o agrega una nueva transacción para comenzar.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-1 p-2 sm:p-4">
      <div className="flex items-center justify-between mb-3 px-1 sm:px-0">
        <p className="text-sm text-muted-foreground font-medium">{total} transacciones encontradas</p>
      </div>

      {movements.map((movement) => {
        const account = accounts.find((acc) => acc.id === movement.cuenta_id)
        const category = categories.find((cat) => cat.id === movement.categoria_id) as Categoria | undefined
        const isUpdating = updatingMovements.has(movement.id)
        const isEditingThisConcept = editingConcept === movement.id

        return (
          <div key={movement.id} className="relative" data-testid="transaction-row">
            <div
              className={cn(
                "bg-card rounded-lg border border-border/50 p-3 hover:bg-muted/50 hover:border-border transition-all duration-200 cursor-pointer shadow-sm hover:shadow-md",
                !category && "border-l-4 border-l-amber-400/60 bg-amber-50/30 dark:bg-amber-950/10"
              )}
              onClick={(e) => handleTransactionClick(movement, e)}
              data-account-id={movement.cuenta_id}
              data-delegation-id={movement.delegacion_id}
            >
              <div className="flex items-start gap-3">
                <AccountTooltip account={account}>
                  <div
                    className="rounded-full p-0.5 cursor-pointer hover:scale-105 transition-transform flex-shrink-0 shadow-sm"
                    style={{
                      backgroundColor: account?.color || "#4ECDC4",
                    }}
                    data-testid="account-info"
                    title={`Cuenta: ${account?.nombre || 'Sin nombre'} - Delegación ID: ${account?.delegacion_id || 'Sin delegación'}`}
                  >
                    <BankAvatar account={account} />
                  </div>
                </AccountTooltip>

                {/* Content - Reorganized as requested */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {/* Title */}
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
                          className="font-semibold text-sm leading-tight cursor-pointer hover:text-primary line-clamp-1 transition-colors mb-1"
                          onClick={(e) => handleConceptClick(movement, e)}
                        >
                          {movement.concepto}
                        </h3>
                      )}
                      
                      {/* Category directly below title */}
                      <div onClick={(e) => e.stopPropagation()}>
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

                    {/* Right side: Amount and Date stacked */}
                    <div className="flex-shrink-0 text-right min-w-0">
                      <div className="mb-0.5">
                        <AmountDisplay amount={movement.importe} size="sm" />
                      </div>
                      <div className="text-xs text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-md whitespace-nowrap inline-block">
                        {formatDate(movement.fecha)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
      {onLoadMore && hasMore && (
        <div ref={loaderRef} className="flex justify-center py-4">
          {loadingMore && <LoadingSpinner />}
        </div>
      )}
    </div>
  )
}
