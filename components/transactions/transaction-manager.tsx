"use client"

import { useEffect, useMemo, useState } from "react"
import type React from "react"
import { useSearchParams } from "next/navigation"
import { TransactionFiltersComponent } from "./transaction-filters"
import { TransactionList } from "./transaction-list"
import { TransactionDetail } from "./transaction-detail"
import { TransactionCreatePanel } from "./transaction-create-panel"
import { CategoryMegaSelector } from "./category-mega-selector"
import { DateRangeFilter } from "./date-range-filter"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useCategorias } from "@/hooks/use-categorias"
import { useCuentas } from "@/hooks/use-cuentas"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { SelectionCheckbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Download,
  Upload,
  Filter,
  ChevronUp,
  Check,
  Tags,
  Trash2,
  Type,
  FileText,
  Skull,
} from "lucide-react"
import { toast } from "sonner"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { exportMovementsToExcel } from "@/lib/utils/export-to-excel"
import type { MovimientoConRelaciones, Categoria, Cuenta } from "@/lib/types/database"
import { TransactionImportPanel } from "./transaction-import-panel"

export interface TransactionFilters {
  dateFrom?: string
  dateTo?: string
  categoryIds?: string[]
  accountId?: string
  search?: string
  amountFrom?: number
  amountTo?: number
  uncategorized?: boolean
}

export function TransactionManager() {
  const {
    selectedDelegation,
    delegations,
    loading: delegationsLoading,
    getCurrentDelegation,
  } = useDelegationContext()

  const [filters, setFilters] = useState<TransactionFilters>({})
  const [selectedMovementId, setSelectedMovementId] = useState<string | null>(null)
  const [selectedMovementSnapshot, setSelectedMovementSnapshot] =
    useState<MovimientoConRelaciones | null>(null)
  const [detailInitialTab, setDetailInitialTab] = useState<"datos" | "archivos">("datos")
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [createFormOpen, setCreateFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [downloadState, setDownloadState] = useState<"idle" | "downloading" | "success">("idle")
  const [selectedMovementIds, setSelectedMovementIds] = useState<string[]>([])
  const [bulkCategoryOpen, setBulkCategoryOpen] = useState(false)
  const [bulkConceptOpen, setBulkConceptOpen] = useState(false)
  const [bulkDescriptionOpen, setBulkDescriptionOpen] = useState(false)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkActionLoading, setBulkActionLoading] = useState(false)
  const [bulkCategoryLoading, setBulkCategoryLoading] = useState(false)
  const [bulkConceptValue, setBulkConceptValue] = useState("")
  const [bulkAppendValue, setBulkAppendValue] = useState("")
  const searchParams = useSearchParams()

  const currentDelegation = getCurrentDelegation()
  console.log(`🏢 TransactionManager: selectedDelegation = ${selectedDelegation}, currentDelegation = ${currentDelegation?.nombre}`)

  const {
    movimientos: movements,
    loading,
    error,
    updateCategoria,
    updateMovimiento,
    updateManyCategorias,
    updateManyMovimientos,
    deleteMovimientos,
    createMovimiento,
    refetch,
    loadMore,
    hasMore,
  } = useMovimientos(selectedDelegation, {
    fechaDesde: filters.dateFrom,
    fechaHasta: filters.dateTo,
    categoriaIds: filters.categoryIds,
    cuentaId: filters.accountId,
    busqueda: filters.search,
    amountFrom: filters.amountFrom,
    amountTo: filters.amountTo,
    uncategorized: filters.uncategorized,
  })

  const { categorias: categories } = useCategorias(selectedDelegation)
  const { cuentas: accounts } = useCuentas(selectedDelegation)

  const visibleMovementIds = useMemo(() => movements.map((movement) => movement.id), [movements])
  const visibleSelectionCount = useMemo(
    () => selectedMovementIds.filter((id) => visibleMovementIds.includes(id)).length,
    [selectedMovementIds, visibleMovementIds],
  )
  const allVisibleSelected = visibleMovementIds.length > 0 && visibleSelectionCount === visibleMovementIds.length
  const someVisibleSelected = visibleSelectionCount > 0 && !allVisibleSelected
  const isSelectionMode = selectedMovementIds.length > 0
  const selectedMovements = useMemo(
    () => movements.filter((movement) => selectedMovementIds.includes(movement.id)),
    [movements, selectedMovementIds],
  )
  const hiddenSelectionCount = Math.max(0, selectedMovementIds.length - visibleSelectionCount)

  useEffect(() => {
    setSelectedMovementIds((prev) => {
      const filtered = prev.filter((id) => visibleMovementIds.includes(id))
      if (filtered.length === prev.length) {
        return prev
      }
      return filtered
    })
  }, [visibleMovementIds])

  useEffect(() => {
    if (selectedMovementIds.length === 0) {
      setBulkCategoryOpen(false)
      setBulkConceptOpen(false)
      setBulkDescriptionOpen(false)
      setBulkDeleteOpen(false)
    }
  }, [selectedMovementIds.length])

  const handleDownload = async () => {
    setDownloadState("downloading")
    toast.success("Descarga iniciada")
    try {
      await exportMovementsToExcel(
        movements as unknown as MovimientoConRelaciones[],
        accounts as unknown as Cuenta[],
        categories as unknown as Categoria[],
      )
      setDownloadState("success")
      setTimeout(() => setDownloadState("idle"), 2000)
    } catch {
      toast.error("No se pudo generar el archivo")
      setDownloadState("idle")
    }
  }

  const handleMovementClick = (movement: MovimientoConRelaciones) => {
    setSelectedMovementId(movement.id)
    setSelectedMovementSnapshot(movement)
    setDetailInitialTab("datos")
  }

  const handleOpenFiles = (movement: MovimientoConRelaciones) => {
    setSelectedMovementId(movement.id)
    setSelectedMovementSnapshot(movement)
    setDetailInitialTab("archivos")
  }

  const handleMovementUpdate = async (
    movementId: string,
    patch: Partial<MovimientoConRelaciones>,
  ) => {
    try {
      const patchWithCategory = { ...patch }
      const { categoria_id: categoriaIdForMovement, ...movementPatch } = patchWithCategory

      if (categoriaIdForMovement !== undefined) {
        await updateCategoria(movementId, categoriaIdForMovement)
      }

      if (Object.keys(movementPatch).length > 0) {
        await updateMovimiento(movementId, movementPatch)
      }

      if (selectedMovementId === movementId) {
        setSelectedMovementSnapshot((prev) =>
          prev
            ? {
                ...prev,
                ...movementPatch,
                ...(categoriaIdForMovement !== undefined
                  ? { categoria_id: categoriaIdForMovement }
                  : {}),
              }
            : prev,
        )
      }
    } catch (error) {
      console.error("Error updating movement:", error)
      throw error
    }
  }

  const handleToggleSelection = (movementId: string, checked: boolean) => {
    setSelectedMovementIds((prev) => {
      if (checked) {
        if (prev.includes(movementId)) {
          return prev
        }
        return [...prev, movementId]
      }
      return prev.filter((id) => id !== movementId)
    })
  }

  const handleToggleAllVisible = () => {
    setSelectedMovementIds((prev) => {
      if (allVisibleSelected) {
        return prev.filter((id) => !visibleMovementIds.includes(id))
      }
      const next = new Set(prev)
      visibleMovementIds.forEach((id) => next.add(id))
      return Array.from(next)
    })
  }

  const handleClearSelection = () => {
    setSelectedMovementIds([])
  }

  const handleSelectionChange = (movement: MovimientoConRelaciones, checked: boolean) => {
    handleToggleSelection(movement.id, checked)
  }

  const handleRowClick = (movement: MovimientoConRelaciones, event: React.MouseEvent) => {
    const target = event.currentTarget as HTMLElement | null
    if (target?.dataset.forceDetail === "true") {
      handleMovementClick(movement)
      return
    }

    if (isSelectionMode) {
      const isCurrentlySelected = selectedMovementIds.includes(movement.id)
      handleToggleSelection(movement.id, !isCurrentlySelected)
      return
    }

    handleMovementClick(movement)
  }

  const handleCreateMovement = async (
    data: Partial<MovimientoConRelaciones>,
  ) => {
    try {
      const accountDelegationId =
        accounts.find((a) => a.id === data.cuenta_id)?.delegacion_id || selectedDelegation
      if (!accountDelegationId) {
        throw new Error("Delegación no seleccionada")
      }
      await createMovimiento({
        ...data,
        // Normalize optional UUIDs to null instead of empty string
        categoria_id: (data as { categoria_id?: string | null })?.categoria_id || null,
        delegacion_id: accountDelegationId,
      })
      await refetch()
      setCreateFormOpen(false)
    } catch (error) {
      console.error("Error creating movement:", error)
      toast.error("Error al crear la transacción")
      throw error
    }
  }

  const handleBulkCategoryApply = async (categoryId: string) => {
    if (selectedMovementIds.length === 0) {
      return
    }

    setBulkCategoryLoading(true)
    try {
      await updateManyCategorias(selectedMovementIds, categoryId)
      toast.success(
        `Categoría actualizada en ${selectedMovementIds.length} transacciones`,
      )
      setBulkCategoryOpen(false)
      handleClearSelection()
    } catch (error) {
      console.error("Error updating categories in bulk:", error)
      toast.error("No se pudieron actualizar las categorías seleccionadas")
    } finally {
      setBulkCategoryLoading(false)
    }
  }

  const handleBulkConceptSubmit = async () => {
    const newConcept = bulkConceptValue.trim()
    if (!newConcept) {
      toast.error("Introduce un concepto para continuar")
      return
    }

    setBulkActionLoading(true)
    try {
      await updateManyMovimientos(selectedMovementIds, { concepto: newConcept })
      toast.success(
        `Concepto actualizado en ${selectedMovementIds.length} transacciones`,
      )
      setBulkConceptOpen(false)
      setBulkConceptValue("")
      handleClearSelection()
    } catch (error) {
      console.error("Error updating concepts in bulk:", error)
      toast.error("No se pudieron actualizar los conceptos seleccionados")
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDescriptionSubmit = async () => {
    const textToAppend = bulkAppendValue.trim()
    if (!textToAppend) {
      toast.error("Introduce un texto para añadir a la descripción")
      return
    }

    setBulkActionLoading(true)
    try {
      const updates = selectedMovements
        .map((movement) => {
          if (!movement) {
            return null
          }
          const base = movement.descripcion?.trim() ?? ""
          const separator = base ? " " : ""
          return {
            id: movement.id,
            descripcion: `${base}${separator}${textToAppend}`,
          }
        })
        .filter(Boolean) as { id: string; descripcion: string }[]

      await Promise.all(
        updates.map(({ id, descripcion }) => updateMovimiento(id, { descripcion })),
      )

      toast.success(
        `Descripción actualizada en ${updates.length} transacciones`,
      )
      setBulkDescriptionOpen(false)
      setBulkAppendValue("")
      handleClearSelection()
    } catch (error) {
      console.error("Error appending descriptions in bulk:", error)
      toast.error("No se pudieron actualizar las descripciones seleccionadas")
    } finally {
      setBulkActionLoading(false)
    }
  }

  const handleBulkDeleteConfirm = async () => {
    if (selectedMovementIds.length === 0) {
      return
    }

    setBulkActionLoading(true)
    try {
      await deleteMovimientos(selectedMovementIds)
      toast.success(
        selectedMovementIds.length === 1
          ? "Transacción eliminada"
          : `${selectedMovementIds.length} transacciones eliminadas`,
      )
      setBulkDeleteOpen(false)
      handleClearSelection()
    } catch (error) {
      console.error("Error deleting movements in bulk:", error)
      toast.error("No se pudieron eliminar las transacciones seleccionadas")
    } finally {
      setBulkActionLoading(false)
    }
  }

  const clearFilters = () => {
    setFilters({})
  }

  const uncategorizedCount = movements.filter((m) => !m.categoria_id).length

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === "dateFrom" || key === "dateTo") return false
    if (key === "categoryIds") {
      return Array.isArray(value) && value.length > 0
    }
    return value !== undefined && value !== "" && value !== false
  })

  useEffect(() => {
    if (!selectedMovementId) {
      return
    }

    const updatedMovement = movements.find((movement) => movement.id === selectedMovementId) || null

    if (updatedMovement) {
      if (updatedMovement !== selectedMovementSnapshot) {
        setSelectedMovementSnapshot(updatedMovement)
      }
    } else if (!loading) {
      setSelectedMovementId(null)
      setSelectedMovementSnapshot(null)
    }
  }, [selectedMovementId, movements, loading, selectedMovementSnapshot])

  useEffect(() => {
    const panel = searchParams.get("panel")
    if (panel === "create") {
      setCreateFormOpen(true)
    }
    if (panel === "import") {
      setImportOpen(true)
    }
    if (searchParams.get("uncategorized") === "1") {
      setFilters((prev) => ({ ...prev, uncategorized: true }))
    }

    const movId = searchParams.get("mov")
    if (movId) {
      const found = movements.find((m) => m.id === movId)
      if (found) {
        setSelectedMovementId(found.id)
        setSelectedMovementSnapshot(found)
        setDetailInitialTab("datos")
      }
    }
  }, [searchParams, movements])

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
          sidebarCollapsed ? "w-0 overflow-hidden" : "w-80"
        }`}
      >
        {!sidebarCollapsed && (
          <div className="p-6 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold">Filtros</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarCollapsed(true)}
                className="hover:bg-muted"
                title="Ocultar filtros"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>

            <TransactionFiltersComponent
              filters={filters}
              onFiltersChange={setFilters}
              onClearFilters={clearFilters}
              categories={categories}
              accounts={accounts}
              uncategorizedCount={uncategorizedCount}
            />
          </div>
        )}
      </div>

      {sidebarCollapsed && (
        <div className="hidden lg:flex items-start p-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSidebarCollapsed(false)}
            className="rotate-0"
            title="Mostrar filtros"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Date Filter and Actions */}
        <div className="sticky top-0 z-10 bg-background border-b p-4 space-y-4">
          <div className="flex items-center justify-between gap-2 min-h-[40px]">
            {/* Date Filter - Responsive width */}
            <div className="flex-shrink-0">
              <div className="w-[200px] sm:w-[240px] md:w-[280px] lg:w-[320px]">
                <DateRangeFilter
                  dateFrom={filters.dateFrom}
                  dateTo={filters.dateTo}
                  onDateRangeChange={(dateFrom, dateTo) => setFilters((prev) => ({ ...prev, dateFrom, dateTo }))}
                />
              </div>
            </div>

            {/* Action Buttons - Responsive text visibility */}
            <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
              {/* Mobile Filter Button */}
              <Button
                variant={hasActiveFilters ? "default" : "outline"}
                size="sm"
                onClick={() => setFiltersOpen(!filtersOpen)}
                className={`lg:hidden flex-shrink-0 relative ${
                  hasActiveFilters ? "bg-blue-600 hover:bg-blue-700 text-white" : ""
                }`}
                title="Filtros"
              >
                <Filter className="h-4 w-4" />
                <span className="hidden sm:ml-2 sm:inline">Filtros</span>
                {hasActiveFilters && (
                  <div className="absolute -top-1 -right-1 h-2 w-2 bg-orange-500 rounded-full animate-pulse" />
                )}
              </Button>

              {/* Add Button - Always show text on sm+ screens */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateFormOpen(true)}
                className="flex-shrink-0"
                title="Añadir transacción"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:ml-2 sm:inline">Añadir</span>
              </Button>

              {/* Import Button - Hide text on smaller screens */}
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0 bg-transparent"
                title="Importar transacciones"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="h-4 w-4" />
                <span className="hidden lg:ml-2 lg:inline">Importar</span>
              </Button>

              {/* Download Button - Hide text on smaller screens */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={downloadState === "downloading"}
                className={`flex-shrink-0 bg-transparent ${
                  downloadState === "success" ? "bg-green-500 hover:bg-green-600 text-white" : ""
                }`}
                title="Descargar transacciones"
              >
                {downloadState === "downloading" ? (
                  <LoadingSpinner size="sm" />
                ) : downloadState === "success" ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                <span className="hidden lg:ml-2 lg:inline">
                  {downloadState === "downloading"
                    ? "Descargando..."
                    : downloadState === "success"
                    ? "Descargado"
                    : "Descargar"}
                </span>
              </Button>
            </div>
          </div>

          {isSelectionMode && (
            <div className="rounded-xl border border-primary/40 bg-primary/5 px-3 py-3 sm:px-4 sm:py-3 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-3">
                  <SelectionCheckbox
                    checked={
                      allVisibleSelected
                        ? true
                        : someVisibleSelected
                        ? "indeterminate"
                        : false
                    }
                    onCheckedChange={() => handleToggleAllVisible()}
                    disabled={bulkCategoryLoading || bulkActionLoading}
                    className="h-10 w-10"
                  />
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold leading-tight">
                      {selectedMovementIds.length === 1
                        ? "1 transacción seleccionada"
                        : `${selectedMovementIds.length} transacciones seleccionadas`}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      {hiddenSelectionCount > 0 && (
                        <span>
                          {hiddenSelectionCount === 1
                            ? "1 fuera de la vista"
                            : `${hiddenSelectionCount} fuera de la vista`}
                        </span>
                      )}
                      {(bulkCategoryLoading || bulkActionLoading) && (
                        <span className="flex items-center gap-1 font-medium text-primary">
                          <LoadingSpinner size="sm" className="h-3 w-3 border" /> Procesando...
                        </span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="hidden sm:inline-flex"
                    onClick={handleClearSelection}
                    disabled={bulkCategoryLoading || bulkActionLoading}
                  >
                    Limpiar
                  </Button>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkCategoryOpen(true)}
                    disabled={bulkCategoryLoading || bulkActionLoading}
                  >
                    <Tags className="h-4 w-4" />
                    <span className="ml-2">Editar categoría</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBulkConceptValue(selectedMovements[0]?.concepto ?? "")
                      setBulkConceptOpen(true)
                    }}
                    disabled={bulkCategoryLoading || bulkActionLoading}
                  >
                    <Type className="h-4 w-4" />
                    <span className="ml-2">Cambiar concepto</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBulkAppendValue("")
                      setBulkDescriptionOpen(true)
                    }}
                    disabled={bulkCategoryLoading || bulkActionLoading}
                  >
                    <FileText className="h-4 w-4" />
                    <span className="ml-2">Añadir descripción</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBulkDeleteOpen(true)}
                    disabled={bulkCategoryLoading || bulkActionLoading}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="ml-2">Eliminar</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="sm:hidden"
                    onClick={handleClearSelection}
                    disabled={bulkCategoryLoading || bulkActionLoading}
                  >
                    Limpiar
                  </Button>
                </div>
              </div>
            </div>
          )}

          {filtersOpen && (
            <Card className="lg:hidden p-4 border-2 border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-800">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-blue-600" />
                  <h3 className="font-semibold text-blue-700 dark:text-blue-300">Filtros</h3>
                  {hasActiveFilters && <div className="h-2 w-2 bg-orange-500 rounded-full animate-pulse" />}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFiltersOpen(false)}
                  className="text-blue-600 hover:text-blue-700 hover:bg-blue-100 dark:text-blue-400"
                >
                  <ChevronUp className="h-4 w-4" />
                </Button>
              </div>
              <TransactionFiltersComponent
                filters={filters}
                onFiltersChange={setFilters}
                onClearFilters={clearFilters}
                categories={categories}
                accounts={accounts}
                uncategorizedCount={uncategorizedCount}
              />
            </Card>
          )}
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
            onMovementClick={(movement, event) =>
              handleRowClick(movement as unknown as MovimientoConRelaciones, event)
            }
            onMovementUpdate={async (movementId, patch) => {
              const fullPatch: Partial<MovimientoConRelaciones> = patch
              await handleMovementUpdate(movementId, fullPatch)
            }}
            onLoadMore={loadMore}
            hasMore={hasMore}
            onOpenFiles={(movement) => handleOpenFiles(movement as unknown as MovimientoConRelaciones)}
            selectedMovements={selectedMovementIds}
            onSelectionChange={(movement, checked) =>
              handleSelectionChange(movement as unknown as MovimientoConRelaciones, checked)
            }
            selectionMode={isSelectionMode}
          />
        </div>
      </div>

      {bulkCategoryOpen && selectedMovementIds.length > 0 && (
        <div
          className="fixed inset-0 z-[95] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={() => {
            if (!bulkCategoryLoading) {
              setBulkCategoryOpen(false)
            }
          }}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <CategoryMegaSelector
              categories={categories}
              selectedCategoryId={null}
              onSelect={(categoryId) => handleBulkCategoryApply(categoryId)}
              onClose={() => {
                if (!bulkCategoryLoading) {
                  setBulkCategoryOpen(false)
                }
              }}
              headline={
                selectedMovementIds.length === 1
                  ? "1 transacción seleccionada"
                  : `${selectedMovementIds.length} transacciones seleccionadas`
              }
            />
          </div>
        </div>
      )}

      <Dialog
        open={bulkConceptOpen && selectedMovementIds.length > 0}
        onOpenChange={(open) => {
          if (!bulkActionLoading) {
            setBulkConceptOpen(open)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar concepto</DialogTitle>
            <DialogDescription>
              El nuevo concepto se aplicará a {selectedMovementIds.length} transacciones.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              value={bulkConceptValue}
              onChange={(event) => setBulkConceptValue(event.target.value)}
              placeholder="Nuevo concepto"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setBulkConceptOpen(false)}
                disabled={bulkActionLoading}
                className="bg-transparent"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleBulkConceptSubmit}
                disabled={bulkActionLoading || bulkConceptValue.trim() === ""}
              >
                {bulkActionLoading ? "Aplicando..." : "Aplicar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkDescriptionOpen && selectedMovementIds.length > 0}
        onOpenChange={(open) => {
          if (!bulkActionLoading) {
            setBulkDescriptionOpen(open)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Añadir descripción</DialogTitle>
            <DialogDescription>
              El texto se sumará al final de la descripción existente de cada transacción seleccionada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              value={bulkAppendValue}
              onChange={(event) => setBulkAppendValue(event.target.value)}
              placeholder="Texto a añadir"
              rows={4}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setBulkDescriptionOpen(false)}
                disabled={bulkActionLoading}
                className="bg-transparent"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleBulkDescriptionSubmit}
                disabled={bulkActionLoading || bulkAppendValue.trim() === ""}
              >
                {bulkActionLoading ? "Añadiendo..." : "Añadir"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkDeleteOpen && selectedMovementIds.length > 0}
        onOpenChange={(open) => {
          if (!bulkActionLoading) {
            setBulkDeleteOpen(open)
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-destructive">
              ¿ESTÁS ABSOLUTAMENTE SEGURO DE QUE QUIERES ELIMINAR ESTAS TRANSACCIONES?
            </DialogTitle>
            <DialogDescription className="text-destructive">
              Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="flex items-center gap-3">
                <Skull className="h-12 w-12 text-destructive animate-bounce" />
                <span className="text-lg font-semibold text-destructive">
                  {selectedMovementIds.length === 1
                    ? "1 transacción será eliminada"
                    : `${selectedMovementIds.length} transacciones serán eliminadas`}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Respira hondo, tómate un segundo y confirma solo si estás segurísimo.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button
                variant="outline"
                onClick={() => setBulkDeleteOpen(false)}
                disabled={bulkActionLoading}
                className="bg-transparent"
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                onClick={handleBulkDeleteConfirm}
                disabled={bulkActionLoading}
                className="flex-1 sm:flex-none"
              >
                {bulkActionLoading ? "Eliminando..." : "Eliminar para siempre"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <TransactionDetail
        movement={selectedMovementSnapshot}
        accounts={accounts as unknown as Cuenta[]}
        categories={categories as unknown as Categoria[]}
        open={selectedMovementId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMovementId(null)
            setSelectedMovementSnapshot(null)
          }
        }}
        onUpdate={async (movementId, patch) => {
          const fullPatch: Partial<MovimientoConRelaciones> = patch
          await handleMovementUpdate(movementId, fullPatch)
        }}
        initialTab={detailInitialTab}
      />

      {/* Create Transaction Panel */}
      <TransactionCreatePanel
        accounts={accounts as unknown as Cuenta[]}
        categories={categories as unknown as Categoria[]}
        open={createFormOpen}
        onOpenChange={setCreateFormOpen}
        onCreate={handleCreateMovement}
      />

      <TransactionImportPanel
        accounts={accounts as unknown as Cuenta[]}
        open={importOpen}
        onOpenChange={setImportOpen}
        delegacionId={selectedDelegation}
        onImported={(importedCount) => {
          console.log(`🔄 TransactionManager: Iniciando refetch después de importar ${importedCount || 0} transacciones para delegación ${selectedDelegation}`)
          refetch()
          // Refetch adicional después de un delay para asegurar sincronización
          setTimeout(() => {
            console.log('🔄 TransactionManager: Segundo refetch para asegurar sincronización')
            refetch()
          }, 1000)
        }}
      />
    </div>
  )
}
