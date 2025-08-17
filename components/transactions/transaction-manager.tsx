"use client"

import { useState } from "react"
import { TransactionFiltersComponent } from "./transaction-filters"
import { TransactionList } from "./transaction-list"
import { TransactionDetail } from "./transaction-detail"
import { TransactionFormEnhanced } from "./transaction-form-enhanced"
import { DateRangeFilter } from "./date-range-filter"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useCategorias } from "@/hooks/use-categorias"
import { useCuentas } from "@/hooks/use-cuentas"
import { Button } from "@/components/ui/button"
import { ChevronRight, ChevronLeft, Plus, Download, Upload, Filter } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { MovimientoConRelaciones, Categoria, Cuenta } from "@/lib/types/database"

export interface TransactionFilters {
  dateFrom?: string
  dateTo?: string
  categoryId?: string
  accountId?: string
  search?: string
  amountFrom?: number
  amountTo?: number
  uncategorized?: boolean
}

export function TransactionManager() {
  const {
    selectedDelegation,
    setSelectedDelegation,
    delegations,
    loading: delegationsLoading,
    getCurrentDelegation,
  } = useDelegationContext()

  const [filters, setFilters] = useState<TransactionFilters>({})
  const [selectedMovement, setSelectedMovement] = useState<MovimientoConRelaciones | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [createFormOpen, setCreateFormOpen] = useState(false)

  const currentDelegation = getCurrentDelegation()
  const organizacionId = currentDelegation?.organizacion_id

  const {
    movimientos: movements,
    loading,
    error,
    updateCategoria,
  } = useMovimientos(selectedDelegation, {
    fechaDesde: filters.dateFrom,
    fechaHasta: filters.dateTo,
    categoriaId: filters.categoryId,
    cuentaId: filters.accountId,
    busqueda: filters.search,
  })

  const { categorias: categories } = useCategorias(organizacionId)
  const { cuentas: accounts } = useCuentas(selectedDelegation)

  const handleMovementClick = (movement: MovimientoConRelaciones) => {
    setSelectedMovement(movement)
    setDetailOpen(true)
  }

  const handleMovementUpdate = async (movementId: string, patch: Partial<MovimientoConRelaciones>) => {
    try {
      if (patch.categoria_id !== undefined) {
        await updateCategoria(movementId, patch.categoria_id)
      }

      // Update selected movement if it's the one being edited
      if (selectedMovement?.id === movementId) {
        setSelectedMovement((prev) => (prev ? { ...prev, ...patch } : null))
      }
    } catch (error) {
      console.error("Error updating movement:", error)
      throw error
    }
  }

  const handleCreateMovement = async (data: Partial<MovimientoConRelaciones>) => {
    try {
      // Aquí implementarías la lógica para crear un nuevo movimiento
      console.log("Creating new movement:", data)
      // Por ahora solo cerramos el formulario
      setCreateFormOpen(false)
      // TODO: Implementar createMovement en useMovimientos
    } catch (error) {
      console.error("Error creating movement:", error)
      throw error
    }
  }

  const clearFilters = () => {
    setFilters({})
  }

  if (delegationsLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando delegaciones...</p>
        </div>
      </div>
    )
  }

  if (delegations.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">No tienes acceso a ninguna delegación</p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden">
      {/* Desktop Sidebar Filters */}
      <div
        className={`hidden lg:block border-r bg-card transition-all duration-300 ${
          sidebarCollapsed ? "w-16" : "w-80"
        }`}
      >
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className={`text-lg font-semibold transition-opacity ${sidebarCollapsed ? "opacity-0" : "opacity-100"}`}>
              Filtros
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="lg:hidden"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>

          {!sidebarCollapsed && (
            <>
              <TransactionFiltersComponent
                filters={filters}
                onFiltersChange={setFilters}
                onClearFilters={clearFilters}
                categories={categories}
                accounts={accounts}
              />
            </>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Date Filter and Actions */}
        <div className="sticky top-0 z-10 bg-background border-b p-4 space-y-4">
          {/* Delegation selector always visible in topbar */}
          <div className="flex items-center justify-between">
            <Select value={selectedDelegation || ""} onValueChange={setSelectedDelegation}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Seleccionar delegación" />
              </SelectTrigger>
              <SelectContent>
                {delegations.map((delegacion) => (
                  <SelectItem key={delegacion.id} value={delegacion.id}>
                    {delegacion.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Collapse/Expand Filters Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className="hidden lg:flex"
            >
              {sidebarCollapsed ? <ChevronRight className="h-4 w-4 mr-2" /> : <ChevronLeft className="h-4 w-4 mr-2" />}
              {sidebarCollapsed ? "Mostrar filtros" : "Ocultar filtros"}
            </Button>
          </div>

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
              <Button variant="outline" size="sm" onClick={() => setCreateFormOpen(true)}>
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
            accounts={accounts as unknown as Cuenta[]}
            categories={categories as unknown as Categoria[]}
            loading={loading}
            error={error}
            total={movements.length}
            onMovementClick={(movement) =>
              handleMovementClick(movement as unknown as MovimientoConRelaciones)
            }
            onMovementUpdate={async (movementId, patch) => {
              const fullPatch: Partial<MovimientoConRelaciones> = patch
              await handleMovementUpdate(movementId, fullPatch)
            }}
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
          <div className="p-4 space-y-4">
            {/* Delegation selector in mobile filters */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Delegación</label>
              <Select value={selectedDelegation || ""} onValueChange={setSelectedDelegation}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar delegación" />
                </SelectTrigger>
                <SelectContent>
                  {delegations.map((delegacion) => (
                    <SelectItem key={delegacion.id} value={delegacion.id}>
                      {delegacion.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <TransactionFiltersComponent
              filters={filters}
              onFiltersChange={setFilters}
              onClearFilters={clearFilters}
              categories={categories}
              accounts={accounts}
            />
          </div>
        </div>
      )}

      <TransactionDetail
        movement={selectedMovement}
        accounts={accounts as unknown as Cuenta[]}
        categories={categories as unknown as Categoria[]}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onUpdate={async (movementId, patch) => {
          const fullPatch: Partial<MovimientoConRelaciones> = patch
          await handleMovementUpdate(movementId, fullPatch)
        }}
      />

      {/* Create Transaction Form */}
      <TransactionFormEnhanced
        open={createFormOpen}
        onOpenChange={setCreateFormOpen}
        accounts={accounts as unknown as Cuenta[]}
        categories={categories as unknown as Categoria[]}
        onSave={handleCreateMovement}
        mode="create"
      />
    </div>
  )
}
