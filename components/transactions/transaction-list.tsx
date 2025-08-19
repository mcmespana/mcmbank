"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ErrorMessage } from "@/components/ui/error-message"
import { BankAvatar } from "./bank-avatar"
import { CategoryChip } from "./category-chip"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { getAccountDisplayName } from "@/lib/utils/movement-utils"
import { Info } from "lucide-react"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
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

  const handleTransactionClick = (movement: Movimiento, e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.closest("button") && !target.closest('[role="button"]')) {
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
    <div className="space-y-1 p-4">
      <div className="flex items-center gap-2 mb-4">
        <p className="text-sm text-muted-foreground">{total} transacciones encontradas</p>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground">
              <Info className="h-4 w-4" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-3" align="start">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Información</h4>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Haz clic en cualquier transacción para cambiar su categoría rápidamente.
              </p>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {movements.map((movement) => {
        const account = accounts.find((acc) => acc.id === movement.cuenta_id)
        const category = categories.find((cat) => cat.id === movement.categoria_id) as Categoria | undefined
        const isUpdating = updatingMovements.has(movement.id)

        return (
          <div key={movement.id} className="relative">
            <div
              className="bg-card rounded-lg border p-3 hover:bg-muted/50 transition-colors cursor-pointer"
              onClick={(e) => handleTransactionClick(movement, e)}
            >
              <div className="flex items-center gap-3">
                {/* Bank Avatar */}
                <BankAvatar account={account} />

                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Title and Date in same line */}
                  <div className="flex items-center justify-between mb-1">
                    <h3 className="font-semibold text-sm leading-tight truncate">{movement.concepto}</h3>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatDate(movement.fecha)}</span>
                      {movement.descripcion && (
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Info className="h-3 w-3" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-80 p-3" align="start">
                            <div className="space-y-2">
                              <h4 className="font-medium text-sm">Descripción</h4>
                              <p className="text-sm text-muted-foreground leading-relaxed">{movement.descripcion}</p>
                            </div>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                  </div>

                  {/* Category and Account */}
                  <div className="flex items-center justify-between">
                    <div onClick={(e) => e.stopPropagation()}>
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
                    {account && (
                      <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                        {getAccountDisplayName(account)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Amount */}
                <div className="text-right">
                  <div
                    className={`font-bold text-sm px-2 py-1 rounded-md border ${
                      movement.importe > 0
                        ? "text-green-700 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-950/20 dark:border-green-800"
                        : "text-red-700 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-950/20 dark:border-red-800"
                    }`}
                  >
                    {formatCurrency(movement.importe)}
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
