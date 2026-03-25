"use client"

import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import { TransactionFiltersComponent } from "./transaction-filters"
import { TransactionList } from "./transaction-list"
import { TransactionDetail } from "./transaction-detail"
import { TransactionCreatePanel } from "./transaction-create-panel"
import { DateRangeFilter } from "./date-range-filter"
import { CategoryMegaSelector } from "./category-mega-selector"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useCategorias } from "@/hooks/use-categorias"
import { useCuentas } from "@/hooks/use-cuentas"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  ChevronRight,
  ChevronLeft,
  Plus,
  Download,
  Upload,
  Filter,
  ChevronUp,
  Check,
  Tag,
  Trash2,
  Type,
  FilePlus,
  AlertTriangle,
} from "lucide-react"
import { toast } from "sonner"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { exportMovementsToExcel } from "@/lib/utils/export-to-excel"
import type { MovimientoConRelaciones, Categoria, Cuenta } from "@/lib/types/database"
import { TransactionImportPanel } from "./transaction-import-panel"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

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
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [bulkConceptOpen, setBulkConceptOpen] = useState(false)
  const [bulkDescriptionOpen, setBulkDescriptionOpen] = useState(false)
  const [bulkConceptValue, setBulkConceptValue] = useState("")
  const [bulkDescriptionValue, setBulkDescriptionValue] = useState("")
  const [bulkCategoryLoading, setBulkCategoryLoading] = useState(false)
  const [bulkDeleting, setBulkDeleting] = useState(false)
  const [bulkConceptLoading, setBulkConceptLoading] = useState(false)
  const [bulkDescriptionLoading, setBulkDescriptionLoading] = useState(false)
  const searchParams = useSearchParams()

  const currentDelegation = getCurrentDelegation()

  const {
    movimientos: movements,
    loading,
    error,
    updateCategoria,
    updateMovimiento,
    createMovimiento,
    deleteMovimientos,
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

  // Notify on fetch error
  useEffect(() => {
    if (error) {
      toast.error(error)
    }
  }, [error])

  const { categorias: categories } = useCategorias(selectedDelegation)
  const { cuentas: accounts } = useCuentas(selectedDelegation)

  useEffect(() => {
    if (movements.length === 0) {
      setSelectedMovementIds((prev) => (prev.length === 0 ? prev : []))
      return
    }

    const availableIds = new Set(movements.map((movement) => movement.id))
    setSelectedMovementIds((prev) => {
      const filtered = prev.filter((id) => availableIds.has(id))
      return filtered.length === prev.length ? prev : filtered
    })
  }, [movements])

  const selectedMovements = useMemo(
    () => movements.filter((movement) => selectedMovementIds.includes(movement.id)),
    [movements, selectedMovementIds],
  )

  const allVisibleMovementIds = useMemo(
    () => movements.map((movement) => movement.id),
    [movements],
  )

  const selectionCount = selectedMovementIds.length
  const allVisibleSelected =
    selectionCount > 0 && selectionCount === allVisibleMovementIds.length && allVisibleMovementIds.length > 0

  const masterSelectionState: boolean | "indeterminate" = selectionCount
    ? allVisibleSelected
      ? true
      : "indeterminate"
    : false

  const selectionActive = selectionCount > 0

  const clearSelection = () => setSelectedMovementIds([])

  const handleMovementSelectionChange = (movementId: string, selected: boolean) => {
    setSelectedMovementIds((prev) => {
      if (selected) {
        if (prev.includes(movementId)) {
          return prev
        }
        return [...prev, movementId]
      }
      return prev.filter((id) => id !== movementId)
    })
  }

  const handleToggleSelectAllVisible = () => {
    if (allVisibleSelected) {
      clearSelection()
    } else {
      setSelectedMovementIds(allVisibleMovementIds)
    }
  }

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

  const handleBulkCategorySelect = async (categoryId: string) => {
    if (!selectionCount) {
      return
    }

    setBulkCategoryLoading(true)
    try {
      await Promise.all(
        selectedMovementIds.map((movementId) =>
          handleMovementUpdate(movementId, { categoria_id: categoryId } as Partial<MovimientoConRelaciones>),
        ),
      )
      toast.success(`Categoría actualizada en ${selectionCount} transacciones. Selección mantenida para más acciones.`)
      setBulkCategoryOpen(false)
      // Mantener selección para permitir acciones adicionales
    } catch (error) {
      console.error("Error updating categories in bulk", error)
      toast.error("No se pudieron actualizar las categorías seleccionadas")
    } finally {
      setBulkCategoryLoading(false)
    }
  }

  const handleBulkConceptSubmit = async () => {
    const nextConcept = bulkConceptValue.trim()
    if (!nextConcept) {
      toast.error("Escribe un concepto para actualizar")
      return
    }

    setBulkConceptLoading(true)
    try {
      await Promise.all(
        selectedMovementIds.map((movementId) =>
          handleMovementUpdate(movementId, { concepto: nextConcept }),
        ),
      )
      toast.success(`Concepto actualizado en ${selectionCount} transacciones. Selección mantenida para más acciones.`)
      setBulkConceptOpen(false)
      setBulkConceptValue("")
      // Mantener selección para permitir acciones adicionales
    } catch (error) {
      console.error("Error updating concept in bulk", error)
      toast.error("No se pudieron actualizar los conceptos seleccionados")
    } finally {
      setBulkConceptLoading(false)
    }
  }

  const handleBulkDescriptionSubmit = async () => {
    const appendText = bulkDescriptionValue.trim()
    if (!appendText) {
      toast.error("Escribe un texto para añadir a la descripción")
      return
    }

    setBulkDescriptionLoading(true)
    try {
      await Promise.all(
        selectedMovements.map((movement) => {
          const currentDescription = (movement.descripcion || "").trimEnd()
          const newDescription = currentDescription
            ? `${currentDescription}\n${appendText}`
            : appendText
          return handleMovementUpdate(movement.id, { descripcion: newDescription })
        }),
      )
      toast.success(`Descripción ampliada en ${selectionCount} transacciones. Selección mantenida para más acciones.`)
      setBulkDescriptionOpen(false)
      setBulkDescriptionValue("")
      // Mantener selección para permitir acciones adicionales
    } catch (error) {
      console.error("Error appending description in bulk", error)
      toast.error("No se pudieron actualizar las descripciones seleccionadas")
    } finally {
      setBulkDescriptionLoading(false)
    }
  }

  const handleBulkDelete = async () => {
    if (!selectionCount) {
      return
    }

    setBulkDeleting(true)
    try {
      await deleteMovimientos(selectedMovementIds)
      if (selectedMovementId && selectedMovementIds.includes(selectedMovementId)) {
        setSelectedMovementId(null)
        setSelectedMovementSnapshot(null)
      }
      toast.success(`Has eliminado ${selectionCount} transacciones. ¡Adiós!`)
      clearSelection()
      setBulkDeleteOpen(false)
    } catch (error) {
      console.error("Error deleting movements in bulk", error)
      toast.error("No se pudieron eliminar las transacciones seleccionadas")
    } finally {
      setBulkDeleting(false)
    }
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
    <div className="flex h-[calc(100vh-5rem)] sm:h-[calc(100vh-8rem)] overflow-hidden">
      {/* Desktop Sidebar Filters */}
      <div
        className={`hidden lg:block border-r bg-card transition-all duration-300 ${sidebarCollapsed ? "w-0 overflow-hidden" : "w-80"
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

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        {/* Header with Date Filter and Actions */}
        <div className="sticky top-0 z-10 bg-background border-b p-4 space-y-4">
          <div className="flex items-center justify-between gap-2 min-h-[40px]">
            {/* Date Filter with show filters button - Responsive width */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Desktop Show Filters Button */}
              {sidebarCollapsed && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSidebarCollapsed(false)}
                  className="hidden lg:flex flex-shrink-0"
                  title="Mostrar filtros"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              )}
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
                className={`lg:hidden flex-shrink-0 relative ${hasActiveFilters ? "bg-blue-600 hover:bg-blue-700 text-white" : ""
                  }`}
                title="Filtros"
              >
                <Filter className="h-4 w-4" />
                <span className="sr-only">Filtros</span>
                {hasActiveFilters && (
                  <div className="absolute -top-1 -right-1 h-2 w-2 bg-orange-500 rounded-full animate-pulse" />
                )}
              </Button>

              {/* Add Button - Show text on md+ screens */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCreateFormOpen(true)}
                className="flex-shrink-0"
                title="Añadir transacción"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden md:ml-2 md:inline">Añadir</span>
              </Button>

              {/* Import Button - Show text on md+ screens */}
              <Button
                variant="outline"
                size="sm"
                className="flex-shrink-0 bg-transparent"
                title="Importar transacciones"
                onClick={() => setImportOpen(true)}
              >
                <Upload className="h-4 w-4" />
                <span className="hidden md:ml-2 md:inline">Importar</span>
              </Button>

              {/* Download Button - Show text on md+ screens */}
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownload}
                disabled={downloadState === "downloading"}
                className={`flex-shrink-0 bg-transparent ${downloadState === "success" ? "bg-green-500 hover:bg-green-600 text-white" : ""
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
                <span className="hidden md:ml-2 md:inline">
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
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3 sm:p-4 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-1 items-start gap-3">
                  <Checkbox
                    checked={masterSelectionState}
                    onCheckedChange={handleToggleSelectAllVisible}
                    className="mt-1 h-5 w-5 border-2"
                    aria-label="Seleccionar todo lo visible"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold tracking-tight">
                      {selectionCount} transacciones seleccionadas
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setBulkCategoryOpen(true)}
                    className="flex items-center gap-1"
                  >
                    <Tag className="h-4 w-4" />
                    <span className="hidden sm:inline">Editar categoría</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkConceptOpen(true)}
                    className="flex items-center gap-1"
                  >
                    <Type className="h-4 w-4" />
                    <span className="hidden sm:inline">Unificar concepto</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setBulkDescriptionOpen(true)}
                    className="flex items-center gap-1"
                  >
                    <FilePlus className="h-4 w-4" />
                    <span className="hidden sm:inline">Añadir nota</span>
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setBulkDeleteOpen(true)}
                    className="flex items-center gap-1"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="hidden sm:inline">Eliminar</span>
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
            onMovementSelectionChange={handleMovementSelectionChange}
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

      <Dialog
        open={bulkCategoryOpen}
        onOpenChange={(open) => {
          if (!bulkCategoryLoading) {
            setBulkCategoryOpen(open)
          }
        }}
      >
        <DialogContent className="max-w-4xl w-[calc(100%-1rem)] sm:w-full p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Seleccionar categoría en bloque</DialogTitle>
            <DialogDescription>
              Selecciona la categoría que se aplicará a las {selectionCount} transacciones seleccionadas.
            </DialogDescription>
          </DialogHeader>
          <CategoryMegaSelector
            categories={categories as unknown as Categoria[]}
            selectedCategoryId={undefined}
            onSelect={handleBulkCategorySelect}
            onClose={() => setBulkCategoryOpen(false)}
            bulkSelectionLabel={`${selectionCount} transacciones seleccionadas`}
          />
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkConceptOpen}
        onOpenChange={(open) => {
          if (!bulkConceptLoading) {
            setBulkConceptOpen(open)
            if (!open) {
              setBulkConceptValue("")
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Unificar concepto</DialogTitle>
            <DialogDescription>
              El nuevo concepto se aplicará a las {selectionCount} transacciones seleccionadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              value={bulkConceptValue}
              onChange={(event) => setBulkConceptValue(event.target.value)}
              placeholder="Introduce el concepto que compartirán todas"
              autoFocus
            />
            <p className="text-xs text-muted-foreground">
              Usa un nombre claro y con cariño. Si te arrepientes siempre puedes volver a editarlo individualmente.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (!bulkConceptLoading) {
                  setBulkConceptOpen(false)
                  setBulkConceptValue("")
                }
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleBulkConceptSubmit} disabled={bulkConceptLoading}>
              {bulkConceptLoading ? <LoadingSpinner size="sm" /> : "Aplicar concepto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkDescriptionOpen}
        onOpenChange={(open) => {
          if (!bulkDescriptionLoading) {
            setBulkDescriptionOpen(open)
            if (!open) {
              setBulkDescriptionValue("")
            }
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Añadir nota a la descripción</DialogTitle>
            <DialogDescription>
              El texto que escribas se colocará al final de la descripción existente de cada transacción seleccionada.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={bulkDescriptionValue}
              onChange={(event) => setBulkDescriptionValue(event.target.value)}
              rows={4}
              placeholder="Escribe la nota extra que quieres añadir"
            />
            <p className="text-xs text-muted-foreground">
              Añadiremos la nota con un salto de línea. Perfecto para matices, chistes internos o recordatorios del futuro.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (!bulkDescriptionLoading) {
                  setBulkDescriptionOpen(false)
                  setBulkDescriptionValue("")
                }
              }}
            >
              Cancelar
            </Button>
            <Button type="button" onClick={handleBulkDescriptionSubmit} disabled={bulkDescriptionLoading}>
              {bulkDescriptionLoading ? <LoadingSpinner size="sm" /> : "Añadir a todas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={bulkDeleteOpen}
        onOpenChange={(open) => {
          if (!bulkDeleting) {
            setBulkDeleteOpen(open)
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5 animate-bounce" />
              ¡Alerta roja!
            </DialogTitle>
            <DialogDescription>
              Esta operación eliminará para siempre las {selectionCount} transacciones seleccionadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm font-semibold uppercase tracking-wide text-destructive animate-pulse">
              ¿ESTÁS ABSOLUTAMENTE SEGURO DE QUE QUIERES ELIMINARLAS?
            </p>
            <div className="flex items-center gap-3 rounded-lg border border-destructive/40 bg-destructive/10 p-3">
              <span className="text-3xl animate-bounce">🤯</span>
              <div className="text-sm text-destructive">
                Respira hondo, revisa la selección y confirma solo si no hay vuelta atrás.
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Esta acción no se puede deshacer. Si mañana te arrepientes prometemos enviarte un gif de ánimo, pero los datos no
              volverán.
            </p>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                if (!bulkDeleting) {
                  setBulkDeleteOpen(false)
                }
              }}
            >
              Mejor no
            </Button>
            <Button type="button" variant="destructive" onClick={handleBulkDelete} disabled={bulkDeleting}>
              {bulkDeleting ? <LoadingSpinner size="sm" /> : "Eliminar para siempre"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
