"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { CategoryEditForm } from "./category-edit-form"
import { DateRangeFilter } from "@/components/transactions/date-range-filter"
import { useCategorias } from "@/hooks/use-categorias"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useDelegationContext } from "@/contexts/delegation-context"
import useIsAdmin from "@/hooks/use-is-admin"
import { DatabaseService } from "@/lib/services/database"
import { GripVertical, Search, Edit, Trash2, Plus, X, Globe2 } from "lucide-react"
import { AmountDisplay } from "@/components/amount-display"
import { DeleteCategoryDialog } from "./delete-category-dialog"
import { RelatedMovementsSheet } from "@/components/transactions/related-movements-sheet"
import type { Categoria } from "@/lib/types/database"


interface CategoryCardProps {
  category: Categoria
  index: number
  balance: number
  onEdit: (category: Categoria) => void
  onSearch: (category: Categoria) => void
  onDelete: (category: Categoria) => void
  canEdit: boolean
  canDelete: boolean
  isDragDisabled: boolean
  isGlobal: boolean
}

function CategoryCard({
  category,
  index,
  balance,
  onEdit,
  onSearch,
  onDelete,
  canEdit,
  canDelete,
  isDragDisabled,
  isGlobal,
}: CategoryCardProps) {
  const isSub = !!category.categoria_padre_id
  return (
    <Draggable draggableId={category.id} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "transition-shadow hover:shadow-md",
            snapshot.isDragging && "shadow-lg rotate-2",
            isSub && "ml-6",
            isDragDisabled && "opacity-95",
          )}
        >
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Drag Handle */}
              <div
                {...(provided.dragHandleProps ?? {})}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted flex-shrink-0",
                  isDragDisabled ? "cursor-default opacity-40" : "cursor-grab active:cursor-grabbing",
                )}
                title={
                  isDragDisabled
                    ? "Solo el gestor central puede reorganizar categorías globales"
                    : undefined
                }
              >
                <GripVertical className="h-4 w-4" />
              </div>

              {/* Category Icon */}
              <div
                className={cn(
                  "flex h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 items-center justify-center rounded-xl text-xl sm:text-2xl shadow-sm flex-shrink-0",
                  isSub && "h-10 w-10 sm:h-12 sm:w-12 lg:h-14 lg:w-14 text-lg sm:text-xl",
                )}
                style={{ backgroundColor: category.color || "#e5e7eb" }}
              >
                {category.emoji || "📁"}
              </div>

              {/* Category Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className={cn("font-semibold text-base sm:text-lg truncate", isSub && "font-medium")}>{category.nombre}</h3>
                      {isGlobal && (
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 border-blue-200 bg-blue-50 text-blue-700 dark:bg-blue-950/30 dark:text-blue-200"
                        >
                          <Globe2 className="h-3 w-3" />
                          <span className="text-[10px] uppercase tracking-wide">Global</span>
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <AmountDisplay amount={balance} size="sm" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 text-blue-600 hover:bg-blue-50"
                  onClick={() => onSearch(category)}
                  title="Buscar transacciones"
                >
                  <Search className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 text-gray-600 hover:bg-gray-50"
                  onClick={() => onEdit(category)}
                  title={canEdit ? "Editar categoría" : "Solo el gestor central puede editar categorías globales"}
                  disabled={!canEdit}
                >
                  <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 text-red-600 hover:bg-red-50"
                  onClick={() => onDelete(category)}
                  title={canDelete ? "Eliminar categoría" : "Solo el gestor central puede eliminar categorías globales"}
                  disabled={!canDelete}
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </Draggable>
  )
}

export function CategoryList() {
  const { selectedDelegation, getCurrentDelegation } = useDelegationContext()
  const isCentralManager = useIsAdmin()
  const [searchTerm, setSearchTerm] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Categoria | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<Categoria | null>(null)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [createSheetOpen, setCreateSheetOpen] = useState(false)
  const [viewingCategory, setViewingCategory] = useState<Categoria | null>(null)
  const [dateFrom, setDateFrom] = useState<string | undefined>()
  const [dateTo, setDateTo] = useState<string | undefined>()

  const currentDelegation = getCurrentDelegation()
  const organizacionId = currentDelegation?.organizacion_id

  const { categorias: categories, loading, error, updateCategoria, fetchCategorias } = useCategorias(selectedDelegation)
  const { movimientos } = useMovimientos(selectedDelegation || null)
  const searchParams = useSearchParams()

  // Todos los useEffect y useCallback van aquí
  useEffect(() => {
    if (searchParams.get("panel") === "create") {
      setEditingCategory(null)
      setCreateSheetOpen(true)
    }
  }, [searchParams])

  const getCategoryBalance = (categoryId: string) => {
    let filteredMovements = movimientos.filter((mov) => mov.categoria_id === categoryId)
    
    if (dateFrom) {
      filteredMovements = filteredMovements.filter((mov) => mov.fecha >= dateFrom)
    }
    if (dateTo) {
      filteredMovements = filteredMovements.filter((mov) => mov.fecha <= dateTo)
    }
    
    return filteredMovements.reduce((sum, mov) => sum + mov.importe, 0)
  }

  const handleDateRangeChange = (newDateFrom?: string, newDateTo?: string) => {
    setDateFrom(newDateFrom)
    setDateTo(newDateTo)
  }

  const canEditCategory = (category: Categoria) => !category.es_global || isCentralManager
  const canDeleteCategory = (category: Categoria) => !category.es_global || isCentralManager
  const canReorderCategory = (category: Categoria) => !category.es_global || isCentralManager

  const handleEdit = (category: Categoria) => {
    if (!canEditCategory(category)) return
    setEditingCategory(category)
    setEditSheetOpen(true)
  }

  const handleCreate = () => {
    setEditingCategory(null)
    setCreateSheetOpen(true)
  }

  const handleSearch = (category: Categoria) => {
    setViewingCategory(category)
  }

  const handleDeleteRequest = (category: Categoria) => {
    if (!canDeleteCategory(category)) return
    setDeletingCategory(category)
  }

  const handleConfirmDelete = async () => {
    if (!deletingCategory) return

    try {
      await DatabaseService.deleteCategoria(deletingCategory.id)
      await fetchCategorias()
    } catch (error) {
      console.error("Error deleting category:", error)
      alert("Error al eliminar la categoría")
    } finally {
      setDeletingCategory(null)
    }
  }

  const handleSaveCategory = async (patch: Partial<Categoria>) => {
    try {
      if (editingCategory) {
        const updates: Partial<Categoria> = {
          nombre: patch.nombre,
          emoji: patch.emoji,
          tipo: patch.tipo,
        }

        if (patch.color && editingCategory.categoria_padre_id === null) {
          updates.color = patch.color
        }

        if (patch.es_global !== undefined) {
          updates.es_global = patch.es_global
          updates.delegacion_id = patch.es_global ? null : selectedDelegation || editingCategory.delegacion_id

          if (
            patch.es_global &&
            editingCategory.categoria_padre_id &&
            !categories.find((c) => c.id === editingCategory.categoria_padre_id)?.es_global
          ) {
            updates.categoria_padre_id = null
          }
        }

        await updateCategoria(editingCategory.id, updates)

        if (updates.color && editingCategory.categoria_padre_id === null) {
          const children = categories.filter((c) => c.categoria_padre_id === editingCategory.id)
          for (const child of children) {
            await updateCategoria(child.id, { color: updates.color })
          }
        }
      } else {
        if (!organizacionId) {
          throw new Error("No se ha podido determinar la organización")
        }

        const isGlobal = !!patch.es_global

        if (!isGlobal && !selectedDelegation) {
          alert("Selecciona una delegación para crear categorías locales")
          return
        }

        const relevantCategories = categories.filter((category) =>
          isGlobal ? category.es_global : !category.es_global && category.delegacion_id === selectedDelegation,
        )
        const maxOrder =
          relevantCategories.length > 0 ? Math.max(...relevantCategories.map((c) => c.orden)) : 0

        await DatabaseService.createCategoria({
          organizacion_id: organizacionId,
          delegacion_id: isGlobal ? null : selectedDelegation!,
          nombre: patch.nombre!,
          tipo: patch.tipo!,
          emoji: patch.emoji || "📁",
          color: patch.color || "#4ECDC4",
          orden: maxOrder + 1,
          categoria_padre_id: patch.categoria_padre_id ?? null,
          es_global: isGlobal,
        })
      }

      await fetchCategorias()
      setEditSheetOpen(false)
      setCreateSheetOpen(false)
      setEditingCategory(null)
    } catch (error) {
      console.error("Error saving category:", error)
      alert("Error al guardar la categoría")
    }
  }

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return

    const items = Array.from(sortedCategories)
    const [moved] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, moved)

    if (!canReorderCategory(moved)) return

    const prev = items[result.destination.index - 1] ?? null
    let newParentId: string | null = null

    if (prev) {
      newParentId = prev.categoria_padre_id === null ? prev.id : prev.categoria_padre_id
    }

    if (newParentId) {
      const parent = items.find((c) => c.id === newParentId)
      if (parent) {
        if (moved.es_global && !parent.es_global) {
          newParentId = null
        } else if (!moved.es_global && parent.delegacion_id && parent.delegacion_id !== (moved.delegacion_id || selectedDelegation)) {
          newParentId = parent.es_global ? parent.id : null
        }
      }
    }

    const parentColor = newParentId ? items.find((c) => c.id === newParentId)?.color || moved.color : moved.color

    try {
      const updates = items
        .map((item, index) => {
          const original = sortedCategories.find((c) => c.id === item.id)
          const newOrden = index + 1
          const isMoved = item.id === moved.id
          const ordenChanged = original ? original.orden !== newOrden : true

          if (isMoved) {
            const payload: Partial<Categoria> = {
              orden: newOrden,
              categoria_padre_id: newParentId,
              color: parentColor,
            }

            return updateCategoria(item.id, payload)
          } else if (ordenChanged) {
            return updateCategoria(item.id, { orden: newOrden })
          }

          return null
        })
        .filter(Boolean) as Promise<void>[]

      await Promise.all(updates)
      await fetchCategorias()
    } catch (error) {
      console.error("Error reordering categories:", error)
    }
  }

  // Logica de filtrado y ordenación (después de todos los hooks)
  const filteredCategories = categories.filter((category) =>
    category.nombre.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const sortedCategories = [...filteredCategories].sort((a, b) => {
    if (a.es_global !== b.es_global) {
      return a.es_global ? -1 : 1
    }
    return a.orden - b.orden
  })

  const globalCount = categories.filter((category) => category.es_global).length
  const localCount = categories.length - globalCount

  // Renders condicionales al final
  if (!selectedDelegation) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Selecciona una delegación para ver las categorías</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando categorías...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-destructive">Error: {error}</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h2 className="text-2xl sm:text-3xl font-bold">Categorías</h2>
        <p className="text-muted-foreground mt-1 text-sm sm:text-base">
          {localCount} locales • {globalCount} globales • Arrastra para reordenar
        </p>
      </div>
      <Button
        onClick={handleCreate}
        size="default"
        className="w-full sm:w-auto"
        disabled={!organizacionId}
      >
        <Plus className="h-4 w-4 mr-2" />
        Añadir categoría
      </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 sm:flex-1">
          <DateRangeFilter
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateRangeChange={handleDateRangeChange}
          />
        </div>
        
        <div className="w-auto sm:flex-1">
          <div className="sm:hidden">
            {searchOpen ? (
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar categorías..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-12"
                    autoFocus
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 flex-shrink-0"
                  onClick={() => {
                    setSearchOpen(false)
                    setSearchTerm("")
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="hidden sm:block relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filtrar por nombre de la categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
        </div>
      </div>

      {sortedCategories.length === 0 ? (
        <div className="flex items-center justify-center py-8 sm:py-12">
          <div className="text-center px-4">
            <p className="text-muted-foreground mb-4 text-sm sm:text-base">
              {searchTerm ? "No se encontraron categorías que coincidan con tu búsqueda" : "No hay categorías creadas"}
            </p>
            {!searchTerm && (
              <Button onClick={handleCreate} className="w-full sm:w-auto">
                <Plus className="h-4 w-4 mr-2" />
                Crear primera categoría
              </Button>
            )}
          </div>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="categories">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3 sm:space-y-4">
                {sortedCategories.map((category, index) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    index={index}
                    balance={getCategoryBalance(category.id)}
                    onEdit={handleEdit}
                    onSearch={handleSearch}
                    onDelete={handleDeleteRequest}
                    canEdit={canEditCategory(category)}
                    canDelete={canDeleteCategory(category)}
                    isDragDisabled={!canReorderCategory(category)}
                    isGlobal={category.es_global}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Sheets and Dialogs */}
      {deletingCategory && (
        <DeleteCategoryDialog
          categoria={deletingCategory}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingCategory(null)}
        />
      )}

      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent className="w-full sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {editingCategory?.categoria_padre_id ? "Editar subcategoría" : "Editar categoría"}
            </SheetTitle>
          </SheetHeader>
          {editingCategory && (
            <CategoryEditForm
              category={editingCategory}
              parentCategory={categories.find((c) => c.id === editingCategory.categoria_padre_id)}
              onSave={handleSaveCategory}
              onCancel={() => setEditSheetOpen(false)}
              canManageGlobal={isCentralManager}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <SheetContent className="w-full sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Crear categoría</SheetTitle>
          </SheetHeader>
          <CategoryEditForm
            category={{
              id: "",
              organizacion_id: organizacionId || "",
              delegacion_id: selectedDelegation || null,
              nombre: "",
              tipo: "gasto",
              emoji: "📁",
              color: "#4ECDC4",
              orden: 0,
              categoria_padre_id: null,
              creado_en: "",
              es_global: false,
            }}
            onSave={handleSaveCategory}
            onCancel={() => setCreateSheetOpen(false)}
            canManageGlobal={isCentralManager}
          />
        </SheetContent>
      </Sheet>

      <RelatedMovementsSheet
        category={viewingCategory}
        open={!!viewingCategory}
        onOpenChange={(open) => {
          if (!open) setViewingCategory(null)
        }}
      />
    </div>
  )
}