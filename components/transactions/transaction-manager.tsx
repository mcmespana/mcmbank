"use client"

import { useState, useMemo } from "react"
import { TransactionFiltersComponent } from "./transaction-filters"
import { TransactionList } from "./transaction-list"
import { TransactionDetail } from "./transaction-detail"
import { DateRangeFilter } from "./date-range-filter"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovements } from "@/hooks/use-movements"
import { useCategories } from "@/hooks/use-categories"
import { useAccounts } from "@/hooks/use-accounts"
import { Button } from "@/components/ui/button"
import { Plus, Download, Upload, Filter } from "lucide-react"
import type { ListMovementsParams } from "@/lib/data-adapter"
import type { Movimiento } from "@/lib/types"

export interface TransactionFilters {
  dateFrom?: string
  dateTo?: string
  categoryId?: string
  amountMin?: number
  amountMax?: number
}

export function TransactionManager() {
  const { selectedDelegation } = useDelegationContext()
  const [filters, setFilters] = useState<TransactionFilters>({})
  const [selectedMovement, setSelectedMovement] = useState<Movimiento | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const movementParams: ListMovementsParams = useMemo(
    () => ({
      delegation_id: selectedDelegation || "",
      date_from: filters.dateFrom,
      date_to: filters.dateTo,
      category_id: filters.categoryId,
      amount_min: filters.amountMin,
      amount_max: filters.amountMax,
      page: 1,
      page_size: 100,
    }),
    [selectedDelegation, filters.dateFrom, filters.dateTo, filters.categoryId, filters.amountMin, filters.amountMax],
  )

  const { movements, total, loading, error, updateMovement } = useMovements(movementParams)
  const { categories } = useCategories("org-1") // TODO: Get from delegation context
  const { accounts } = useAccounts(selectedDelegation || "")

  const handleMovementClick = (movement: Movimiento) => {
    setSelectedMovement(movement)
    setDetailOpen(true)
  }

  const handleMovementUpdate = async (movementId: string, patch: Partial<Movimiento>) => {
    try {
      await updateMovement(movementId, patch)
      // Update selected movement if it's the one being edited
      if (selectedMovement?.id === movementId) {
        setSelectedMovement((prev) => (prev ? { ...prev, ...patch } : null))
      }
    } catch (error) {
      console.error("Error updating movement:", error)
      throw error
    }
  }

  const clearFilters = () => {
    setFilters({})
  }

  if (!selectedDelegation) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Selecciona una delegación para ver las transacciones</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden">
      {/* Desktop Sidebar Filters */}
      <div
        className={`hidden lg:block w-80 border-r bg-card transition-all duration-300 ${filtersOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Filtros</h3>
            <Button variant="ghost" size="sm" onClick={() => setFiltersOpen(!filtersOpen)} className="lg:hidden">
              <Filter className="h-4 w-4" />
            </Button>
          </div>
          <TransactionFiltersComponent
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={clearFilters}
            categories={categories}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Date Filter and Actions */}
        <div className="sticky top-0 z-10 bg-background border-b p-4 space-y-4">
          {/* Date Range Filter */}
          <DateRangeFilter
            dateFrom={filters.dateFrom}
            dateTo={filters.dateTo}
            onDateRangeChange={(dateFrom, dateTo) => setFilters((prev) => ({ ...prev, dateFrom, dateTo }))}
          />

          {/* Action Buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* Mobile Filter Button */}
              <Button variant="outline" size="sm" onClick={() => setFiltersOpen(!filtersOpen)} className="lg:hidden">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Añadir</span>
              </Button>
              <Button variant="outline" size="sm">
                <Upload className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Importar</span>
              </Button>
              <Button variant="outline" size="sm">
                <Download className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Descargar</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Transaction List */}
        <div className="flex-1 overflow-auto">
          <TransactionList
            movements={movements}
            accounts={accounts}
            categories={categories}
            loading={loading}
            error={error}
            total={total}
            onMovementClick={handleMovementClick}
            onMovementUpdate={handleMovementUpdate}
          />
        </div>
      </div>

      {/* Mobile Filters Overlay */}
      {filtersOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-background">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Filtros</h3>
              <Button variant="ghost" size="sm" onClick={() => setFiltersOpen(false)}>
                ✕
              </Button>
            </div>
          </div>
          <div className="p-4">
            <TransactionFiltersComponent
              filters={filters}
              onFiltersChange={setFilters}
              onClearFilters={clearFilters}
              categories={categories}
            />
          </div>
        </div>
      )}

      <TransactionDetail
        movement={selectedMovement}
        accounts={accounts}
        categories={categories}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdate={handleMovementUpdate}
      />
    </div>
  )
}
