"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ErrorMessage } from "@/components/ui/error-message"
import { formatCurrency, formatDate, getAmountColorClass } from "@/lib/utils/format"
import { getAccountDisplayName, getAccountIcon } from "@/lib/utils/movement-utils"
import type { Movimiento, Cuenta, Categoria } from "@/lib/types"

interface TransactionTableProps {
  movements: Movimiento[]
  accounts: Cuenta[]
  categories: Categoria[]
  loading: boolean
  error: string | null
  total: number
  onMovementClick: (movement: Movimiento) => void
  onMovementUpdate: (movementId: string, patch: Partial<Movimiento>) => Promise<void>
}

export function TransactionTable({
  movements,
  accounts,
  categories,
  loading,
  error,
  total,
  onMovementClick,
  onMovementUpdate,
}: TransactionTableProps) {
  const [updatingMovements, setUpdatingMovements] = useState<Set<string>>(new Set())

  const handleCategoryChange = async (movementId: string, categoryId: string) => {
    setUpdatingMovements((prev) => new Set(prev).add(movementId))
    try {
      await onMovementUpdate(movementId, { categoria_id: categoryId || null })
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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{total} transacciones encontradas</p>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Concepto</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cuenta</TableHead>
              <TableHead className="text-right">Importe</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {movements.map((movement) => {
              const account = accounts.find((acc) => acc.id === movement.cuenta_id)
              const category = categories.find((cat) => cat.id === movement.categoria_id)
              const isUpdating = updatingMovements.has(movement.id)

              return (
                <TableRow
                  key={movement.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => onMovementClick(movement)}
                >
                  <TableCell className="font-medium">
                    <div className="max-w-[200px] truncate">{movement.concepto}</div>
                    {movement.descripcion && (
                      <div className="text-xs text-muted-foreground max-w-[200px] truncate">{movement.descripcion}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div onClick={(e) => e.stopPropagation()}>
                      {isUpdating ? (
                        <div className="flex items-center gap-2">
                          <LoadingSpinner size="sm" />
                          <span className="text-xs text-muted-foreground">Actualizando...</span>
                        </div>
                      ) : (
                        <Select
                          value={movement.categoria_id || "none"}
                          onValueChange={(value) => handleCategoryChange(movement.id, value)}
                        >
                          <SelectTrigger className="h-8 w-[160px]">
                            <SelectValue placeholder="Sin categoría">
                              {category && (
                                <div className="flex items-center gap-1">
                                  {category.emoji && <span className="text-xs">{category.emoji}</span>}
                                  <span className="truncate text-xs">{category.nombre}</span>
                                </div>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">Sin categoría</SelectItem>
                            {categories.map((cat) => (
                              <SelectItem key={cat.id} value={cat.id}>
                                <div className="flex items-center gap-2">
                                  {cat.emoji && <span>{cat.emoji}</span>}
                                  <span>{cat.nombre}</span>
                                </div>
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-sm">{formatDate(movement.fecha)}</TableCell>
                  <TableCell>
                    {account && (
                      <Badge variant="secondary" className="gap-1">
                        <span>{getAccountIcon(account)}</span>
                        <span className="truncate max-w-[120px]">{getAccountDisplayName(account)}</span>
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className={`text-right ${getAmountColorClass(movement.importe)}`}>
                    {formatCurrency(movement.importe)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
