"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { TransactionFiltersComponent } from "./transaction-filters"
import { TransactionList } from "./transaction-list"
import { TransactionDetail } from "./transaction-detail"
import { TransactionCreatePanel } from "./transaction-create-panel"
import { DateRangeFilter } from "./date-range-filter"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useCategorias } from "@/hooks/use-categorias"
import { useCuentas } from "@/hooks/use-cuentas"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Download,
  Upload,
  Filter,
  ChevronUp,
  Check,
  Minus,
  Square,
  Tags,
  Trash2,
  TextCursorInput,
  NotebookPen,
  X,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { exportMovementsToExcel } from "@/lib/utils/export-to-excel"
import type { MovimientoConRelaciones, Categoria, Cuenta } from "@/lib/types/database"
import { TransactionImportPanel } from "./transaction-import-panel"
import { CategoryMegaSelector } from "./category-mega-selector"

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
  const [categorySelectorOpen, setCategorySelectorOpen] = useState(false)
  const [conceptDialogOpen, setConceptDialogOpen] = useState(false)
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [isBulkUpdating, setIsBulkUpdating] = useState(false)
  const [isDeleteLoading, setIsDeleteLoading] = useState(false)
  const [bulkConceptValue, setBulkConceptValue] = useState("")
  const [bulkDescriptionValue, setBulkDescriptionValue] = useState("")
  const searchParams = useSearchParams()

  const currentDelegation = getCurrentDelegation()
  console.log(`🏢 TransactionManager: selectedDelegation = ${selectedDelegation}, currentDelegation = ${currentDelegation?.nombre}`)

  const {
    movimientos: movements,
    loading,
    error,
    updateCategoria,
    updateMovimiento,
    bulkUpdateMovimientos,
    deleteMovimientos,
    appendDescripcion,
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

  const selectedIdsSet = useMemo(() => new Set(selectedMovementIds), [selectedMovementIds])
  const visibleMovementIds = useMemo(() => movements.map((movement) => movement.id), [movements])
  const selectionCount = selectedMovementIds.length
  const selectionActive = selectionCount > 0
  const allVisibleSelected =
    visibleMovementIds.length > 0 && visibleMovementIds.every((id) => selectedIdsSet.has(id))
  const partiallySelected = selectionActive && !allVisibleSelected
  const selectedMovements = useMemo(
    () => movements.filter((movement) => selectedIdsSet.has(movement.id)),
    [movements, selectedIdsSet],
  )
  const sharedCategoryId = useMemo(() => {
    if (!selectionActive || selectedMovements.length === 0) return undefined
    const first = selectedMovements[0].categoria_id ?? null
    const allSame = selectedMovements.every((movement) => (movement.categoria_id ?? null) === first)
    if (!allSame) {
      return undefined
    }
    return first ?? undefined
  }, [selectionActive, selectedMovements])
  const sharedConcept = useMemo(() => {
    if (!selectionActive || selectedMovements.length === 0) return ""
    const first = selectedMovements[0].concepto ?? ""
    const allSame = selectedMovements.every((movement) => (movement.concepto ?? "") === first)
    return allSame ? first : ""
  }, [selectionActive, selectedMovements])

  useEffect(() => {
    if (!selectionActive) return

    setSelectedMovementIds((prev) => {
      if (prev.length === 0) return prev
      const visibleSet = new Set(visibleMovementIds)
      const filtered = prev.filter((id) => visibleSet.has(id))
      return filtered.length === prev.length ? prev : filtered
    })
  }, [visibleMovementIds, selectionActive])

  useEffect(() => {
    if (conceptDialogOpen) {
      setBulkConceptValue(sharedConcept)
    }
  }, [conceptDialogOpen, sharedConcept])

  const selectionSummaryText =
    selectionCount > 0
      ? `${selectionCount} transacción${selectionCount !== 1 ? "es" : ""} seleccionada${selectionCount !== 1 ? "s" : ""}`
      : ""
  const selectionHelperText = allVisibleSelected
    ? "Todas las transacciones visibles están seleccionadas"
    : partiallySelected
      ? "Selecciona todas las visibles con un clic"
      : "Selecciona varias para aplicar acciones en lote"
  const actionsDisabled = isBulkUpdating || isDeleteLoading

  const { categorias: categories } = useCategorias(selectedDelegation)
  const { cuentas: accounts } = useCuentas(selectedDelegation)

  const toggleMovementSelection = useCallback((movementId: string, nextSelected: boolean) => {
    setSelectedMovementIds((prev) => {
      if (nextSelected) {
        if (prev.includes(movementId)) return prev
        return [...prev, movementId]
      }
      return prev.filter((id) => id !== movementId)
    })
  }, [])

  const clearSelection = useCallback(() => {
    setSelectedMovementIds([])
  }, [])

  const handleToggleSelectAllVisible = useCallback(() => {
    if (allVisibleSelected) {
      setSelectedMovementIds([])
    } else {
      setSelectedMovementIds([...visibleMovementIds])
    }
  }, [allVisibleSelected, visibleMovementIds])

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

  const handleBulkCategorySelect = async (categoryId: string) => {
    const ids = [...selectedMovementIds]
    if (ids.length === 0) return

    setIsBulkUpdating(true)
    try {
      await bulkUpdateMovimientos(ids, { categoria_id: categoryId })
      if (selectedMovementId && ids.includes(selectedMovementId)) {
        setSelectedMovementSnapshot((prev) =>
          prev ? { ...prev, categoria_id: categoryId } : prev,
        )
      }
      toast.success(
        `Categoría actualizada en ${ids.length} transacción${ids.length !== 1 ? "es" : ""}`,
      )
      clearSelection()
      setCategorySelectorOpen(false)
    } catch (error) {
      console.error("Error updating categories:", error)
      toast.error("No se pudieron actualizar las categorías")
    } finally {
      setIsBulkUpdating(false)
    }
  }

  const handleBulkConceptSubmit = async () => {
    const trimmed = bulkConceptValue.trim()
    const ids = [...selectedMovementIds]
    if (!trimmed || ids.length === 0) return

    setIsBulkUpdating(true)
    try {
      await bulkUpdateMovimientos(ids, { concepto: trimmed })
      if (selectedMovementId && ids.includes(selectedMovementId)) {
        setSelectedMovementSnapshot((prev) =>
          prev ? { ...prev, concepto: trimmed } : prev,
        )
      }
      toast.success(
        `Concepto actualizado en ${ids.length} transacción${ids.length !== 1 ? "es" : ""}`,
      )
      setConceptDialogOpen(false)
      setBulkConceptValue("")
      clearSelection()
    } catch (error) {
      console.error("Error updating concept:", error)
      toast.error("No se pudo actualizar el concepto")
    } finally {
      setIsBulkUpdating(false)
    }
  }

  const handleBulkDescriptionSubmit = async () => {
    const trimmed = bulkDescriptionValue.trim()
    const ids = [...selectedMovementIds]
    if (!trimmed || ids.length === 0) return

    setIsBulkUpdating(true)
    try {
      await appendDescripcion(ids, trimmed)
      if (selectedMovementId && ids.includes(selectedMovementId)) {
        setSelectedMovementSnapshot((prev) => {
          if (!prev) return prev
          const base = prev.descripcion ? prev.descripcion.trimEnd() : ""
          const descripcion = base ? `${base}\n${trimmed}` : trimmed
          return { ...prev, descripcion }
        })
      }
      toast.success(
        `Descripción actualizada en ${ids.length} transacción${ids.length !== 1 ? "es" : ""}`,
      )
      setDescriptionDialogOpen(false)
      setBulkDescriptionValue("")
      clearSelection()
    } catch (error) {
      console.error("Error updating description:", error)
      toast.error("No se pudo actualizar la descripción")
    } finally {
      setIsBulkUpdating(false)
    }
  }

  const handleBulkDelete = async () => {
    const ids = [...selectedMovementIds]
    if (ids.length === 0) return

    setIsDeleteLoading(true)
    try {
      await deleteMovimientos(ids)
      if (selectedMovementId && ids.includes(selectedMovementId)) {
        setSelectedMovementId(null)
        setSelectedMovementSnapshot(null)
      }
      toast.success(
        `${ids.length} transacción${ids.length !== 1 ? "es" : ""} eliminada${ids.length !== 1 ? "s" : ""}`,
      )
      clearSelection()
      setDeleteDialogOpen(false)
    } catch (error) {
      console.error("Error deleting movements:", error)
      toast.error("No se pudieron eliminar las transacciones seleccionadas")
    } finally {
      setIsDeleteLoading(false)
    }
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

          {selectionActive && (
            <div className="rounded-2xl border border-primary/30 bg-primary/5 px-3 py-3 sm:px-4 sm:py-3 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-center gap-3 min-w-0">
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={allVisibleSelected ? true : partiallySelected ? "mixed" : false}
                    onClick={handleToggleSelectAllVisible}
                    disabled={actionsDisabled}
                    className={`flex h-10 w-10 items-center justify-center rounded-full border text-sm shadow-sm transition hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 ${
                      allVisibleSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : partiallySelected
                          ? "bg-primary/10 border-primary/60 text-primary"
                          : "bg-background/80 border-primary/40 text-primary"
                    }`}
                    aria-label={
                      allVisibleSelected
                        ? "Deseleccionar transacciones visibles"
                        : "Seleccionar todas las transacciones visibles"
                    }
                  >
                    {allVisibleSelected ? (
                      <Check className="h-4 w-4" />
                    ) : partiallySelected ? (
                      <Minus className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>

                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold text-primary">{selectionSummaryText}</p>
                    {isBulkUpdating ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <LoadingSpinner size="sm" />
                        <span className="truncate">Aplicando cambios...</span>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground truncate">{selectionHelperText}</p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCategorySelectorOpen(true)}
                    className="flex items-center gap-2"
                    disabled={actionsDisabled}
                  >
                    <Tags className="h-4 w-4" />
                    <span className="text-xs font-medium">Editar categoría</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConceptDialogOpen(true)}
                    className="flex items-center gap-2"
                    disabled={actionsDisabled}
                  >
                    <TextCursorInput className="h-4 w-4" />
                    <span className="text-xs font-medium">Cambiar concepto</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDescriptionDialogOpen(true)}
                    className="flex items-center gap-2"
                    disabled={actionsDisabled}
                  >
                    <NotebookPen className="h-4 w-4" />
                    <span className="text-xs font-medium">Añadir nota</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setDeleteDialogOpen(true)}
                    className="flex items-center gap-2"
                    disabled={isDeleteLoading || isBulkUpdating}
                  >
                    {isDeleteLoading ? <LoadingSpinner size="sm" /> : <Trash2 className="h-4 w-4" />}
                    <span className="text-xs font-medium">Eliminar</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearSelection}
                    className="h-8 px-3"
                    disabled={actionsDisabled}
                  >
                    <X className="h-4 w-4 mr-1.5" />
                    <span className="text-xs font-medium">Limpiar</span>
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
            onMovementClick={(movement) => handleMovementClick(movement as unknown as MovimientoConRelaciones)}
            onMovementUpdate={async (movementId, patch) => {
              const fullPatch: Partial<MovimientoConRelaciones> = patch
              await handleMovementUpdate(movementId, fullPatch)
            }}
            onLoadMore={loadMore}
            hasMore={hasMore}
            onOpenFiles={(movement) => handleOpenFiles(movement as unknown as MovimientoConRelaciones)}
            selectedMovementIds={selectedMovementIds}
            selectionActive={selectionActive}
            onToggleMovementSelection={toggleMovementSelection}
          />
        </div>
      </div>

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

      {categorySelectorOpen && (
        <div
          className="fixed inset-0 z-[95] flex items-end justify-center bg-black/60 backdrop-blur-sm p-3 sm:items-center sm:p-6"
          onClick={() => {
            if (isBulkUpdating) return
            setCategorySelectorOpen(false)
          }}
        >
          <div
            className="w-full max-w-3xl"
            onClick={(event) => event.stopPropagation()}
          >
            <CategoryMegaSelector
              categories={categories as unknown as Categoria[]}
              selectedCategoryId={typeof sharedCategoryId === "string" ? sharedCategoryId : undefined}
              onSelect={handleBulkCategorySelect}
              onClose={() => {
                if (isBulkUpdating) return
                setCategorySelectorOpen(false)
              }}
              selectionSummary={selectionSummaryText}
            />
          </div>
        </div>
      )}

      <Dialog
        open={conceptDialogOpen}
        onOpenChange={(open) => {
          if (isBulkUpdating) return
          setConceptDialogOpen(open)
          if (!open) {
            setBulkConceptValue("")
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cambiar concepto</DialogTitle>
            <DialogDescription>
              {selectionSummaryText || "Selecciona transacciones para aplicar cambios."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={bulkConceptValue}
              onChange={(event) => setBulkConceptValue(event.target.value)}
              placeholder="Nuevo concepto"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              El concepto reemplazará al actual en todas las transacciones seleccionadas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConceptDialogOpen(false)} disabled={isBulkUpdating}>
              Cancelar
            </Button>
            <Button
              onClick={handleBulkConceptSubmit}
              disabled={isBulkUpdating || !bulkConceptValue.trim()}
            >
              {isBulkUpdating ? <LoadingSpinner size="sm" /> : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={descriptionDialogOpen}
        onOpenChange={(open) => {
          if (isBulkUpdating) return
          setDescriptionDialogOpen(open)
          if (!open) {
            setBulkDescriptionValue("")
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Añadir nota a la descripción</DialogTitle>
            <DialogDescription>
              {selectionSummaryText || "Selecciona transacciones para añadir notas."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={bulkDescriptionValue}
              onChange={(event) => setBulkDescriptionValue(event.target.value)}
              placeholder="Texto a añadir al final de la descripción"
              rows={4}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              El texto se añadirá al final de la descripción existente, sin eliminar lo anterior.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDescriptionDialogOpen(false)} disabled={isBulkUpdating}>
              Cancelar
            </Button>
            <Button
              onClick={handleBulkDescriptionSubmit}
              disabled={isBulkUpdating || !bulkDescriptionValue.trim()}
            >
              {isBulkUpdating ? <LoadingSpinner size="sm" /> : "Aplicar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (isDeleteLoading) return
          setDeleteDialogOpen(open)
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-red-600">Eliminar transacciones</DialogTitle>
            <DialogDescription>
              Esta acción no se puede deshacer. Se eliminarán permanentemente las transacciones seleccionadas.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl border border-red-500/40 bg-red-500/10 p-5 text-center space-y-3">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-500/20 text-red-600 dramatic-wiggle">
              <AlertTriangle className="h-8 w-8" />
            </div>
            <p className="text-sm font-semibold text-red-600 uppercase tracking-wide">
              ¿Estás absolutamente seguro de que quieres eliminar las {selectionCount} transacciones seleccionadas?
            </p>
            <p className="text-xs text-muted-foreground">
              Esta acción no se puede deshacer. Respira hondo y confirma solo si estás totalmente seguro.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={isDeleteLoading}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isDeleteLoading || selectionCount === 0}
            >
              {isDeleteLoading ? <LoadingSpinner size="sm" /> : "Eliminar definitivamente"}
            </Button>
          </DialogFooter>
          <style>{`
            @keyframes dramatic-wiggle {
              0%, 100% { transform: rotate(-8deg); }
              50% { transform: rotate(8deg); }
            }
            .dramatic-wiggle {
              animation: dramatic-wiggle 1.2s ease-in-out infinite;
            }
          `}</style>
        </DialogContent>
      </Dialog>
    </div>
  )
}
