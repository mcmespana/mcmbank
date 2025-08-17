"use client"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CategoryBalance } from "./category-balance"
import { CategoryDateFilter } from "./category-date-filter"
import { formatCurrency } from "@/lib/utils/format"
import type { Categoria, Movimiento } from "@/lib/types/database"

interface CategoryListProps {
  categories: Categoria[]
  movements: Movimiento[]
  dateFrom?: string
  dateTo?: string
  onDateRangeChange: (dateFrom?: string, dateTo?: string) => void
}

export function CategoryList({ 
  categories, 
  movements, 
  dateFrom, 
  dateTo, 
  onDateRangeChange 
}: CategoryListProps) {
  // Filter movements by date range if specified
  const filteredMovements = movements.filter(mov => {
    if (!dateFrom && !dateTo) return true
    
    const movDate = new Date(mov.fecha)
    if (dateFrom && movDate < new Date(dateFrom)) return false
    if (dateTo && movDate > new Date(dateTo)) return false
    
    return true
  })

  // Calculate total balance
  const totalBalance = filteredMovements.reduce((sum, mov) => sum + mov.importe, 0)

  return (
    <div className="space-y-6">
      {/* Header with date filter */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Categorías</h2>
          <p className="text-muted-foreground">
            Balance total: <span className={totalBalance >= 0 ? "text-green-600" : "text-red-600"}>
              {formatCurrency(totalBalance)}
            </span>
          </p>
        </div>
        <CategoryDateFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateRangeChange={onDateRangeChange}
        />
      </div>

      {/* Categories Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((category) => {
          const categoryMovements = filteredMovements.filter(mov => mov.categoria_id === category.id)
          const categoryBalance = categoryMovements.reduce((sum, mov) => sum + mov.importe, 0)
          const transactionCount = categoryMovements.length

          return (
            <Card key={category.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {category.emoji && (
                      <span className="text-2xl">{category.emoji}</span>
                    )}
                    <CardTitle className="text-lg">{category.nombre}</CardTitle>
                  </div>
                  <CategoryBalance 
                    category={category} 
                    movements={filteredMovements} 
                  />
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="space-y-3">
                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Transacciones:</span>
                    <span className="font-medium">{transactionCount}</span>
                  </div>
                  
                  {/* Balance breakdown */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Ingresos:</span>
                      <span className="text-green-600">
                        {formatCurrency(
                          categoryMovements
                            .filter(mov => mov.importe > 0)
                            .reduce((sum, mov) => sum + mov.importe, 0)
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Gastos:</span>
                      <span className="text-red-600">
                        {formatCurrency(
                          Math.abs(
                            categoryMovements
                              .filter(mov => mov.importe < 0)
                              .reduce((sum, mov) => sum + mov.importe, 0)
                          )
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" size="sm" className="flex-1">
                      Ver transacciones
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1">
                      Editar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12">
          <p className="text-muted-foreground">No se encontraron categorías</p>
        </div>
      )}
    </div>
  )
}
