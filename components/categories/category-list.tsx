"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect, useMemo } from "react"
import { useSearchParams } from "next/navigation"
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
  type DragUpdate,
} from "@hello-pangea/dnd"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CategoryEditForm } from "./category-edit-form"
import { DateRangeFilter } from "@/components/transactions/date-range-filter"
import { useCategorias } from "@/hooks/use-categorias"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useDelegationContext } from "@/contexts/delegation-context"
import useIsAdmin from "@/hooks/use-is-admin"
import { DatabaseService } from "@/lib/services/database"
import { GripVertical, Search, Edit, Trash2, Plus, X, Globe2, PlusCircle } from "lucide-react"
import { AmountDisplay } from "@/components/amount-display"
import { DeleteCategoryDialog } from "./delete-category-dialog"
import { RelatedMovementsSheet } from "@/components/transactions/related-movements-sheet"
import type { Categoria } from "@/lib/types/database"

interface CategoryCardProps {
  category: Categoria
  index: number
  depth: number
  balance: number
  onEdit: (category: Categoria) => void
  onSearch: (category: Categoria) => void
  onDelete: (category: Categoria) => void
  onAddSubcategory?: (category: Categoria) => void
  canEdit: boolean
  canDelete: boolean
  canAddSubcategory: boolean
  isDragDisabled: boolean
  dragHint: string
  isGlobal: boolean
  isDropTarget?: boolean
}

function CategoryCard({
  category,
  index,
  depth,
  balance,
  onEdit,
  onSearch,
  onDelete,
  onAddSubcategory,
  canEdit,
  canDelete,
  canAddSubcategory,
  isDragDisabled,
  dragHint,
  isGlobal,
  isDropTarget = false,
}: CategoryCardProps) {
  const indentation = depth * 24
  const addSubcategoryTitle = canAddSubcategory
    ? "Añadir subcategoría"
    : category.categoria_padre_id !== null
      ? "Solo las categorías principales pueden tener subcategorías"
      : category.es_global
        ? "Solo el gestor central puede añadir subcategorías globales"
        : "No puedes añadir subcategorías en este momento"

  return (
    <Draggable draggableId={category.id} index={index} isDragDisabled={isDragDisabled}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          style={{
            ...provided.draggableProps.style,
          }}
          className={cn("relative", snapshot.isDragging && "z-40")}
        >
          <div style={{ marginLeft: indentation }}>
            <Card
              className={cn(
                "transition-shadow hover:shadow-md bg-background",
                snapshot.isDragging && "shadow-lg ring-2 ring-primary/40",
                isDropTarget && !snapshot.isDragging && "ring-2 ring-primary/50",
                depth > 0 && "border-muted-foreground/20",
              )}
            >
              <CardContent className="p-3 sm:p-4 lg:p-5">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div
                    {...(provided.dragHandleProps ?? {})}
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-md border border-dashed flex-shrink-0 text-muted-foreground",
                      isDragDisabled
                        ? "cursor-not-allowed border-transparent opacity-40"
                        : "cursor-grab border-transparent bg-muted/40 hover:bg-muted/70 active:cursor-grabbing",
                    )}
                    title={dragHint}
                  >
                    <GripVertical className="h-4 w-4" />
                  </div>

                  <div
                    className={cn(
                      "flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-xl text-xl sm:text-2xl shadow-sm flex-shrink-0",
                      depth > 0 && "h-10 w-10 sm:h-12 sm:w-12 text-lg sm:text-xl",
                    )}
                    style={{ backgroundColor: category.color || "#e5e7eb" }}
                  >
                    {category.emoji || "📁"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3
                        className={cn(
                          "font-semibold text-base sm:text-lg truncate",
                          depth > 0 && "font-medium",
                        )}
                      >
                        {category.nombre}
                      </h3>
                      {isGlobal && (
                        <span
                          className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-blue-500 dark:text-blue-200"
                          title="Categoría global"
                        >
                          <Globe2 className="h-3 w-3" />
                        </span>
                      )}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      <AmountDisplay amount={balance} size="sm" />
                    </div>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                      onClick={() => onSearch(category)}
                      title="Buscar transacciones"
                    >
                      <Search className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                      onClick={() => onAddSubcategory?.(category)}
                      title={addSubcategoryTitle}
                      disabled={!canAddSubcategory}
                    >
                      <PlusCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/30"
                      onClick={() => onEdit(category)}
                      title={canEdit ? "Editar categoría" : "Solo el gestor central puede editar categorías globales"}
                      disabled={!canEdit}
                    >
                      <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 sm:h-9 sm:w-9 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
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
          </div>
        </div>
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
  const [creatingParent, setCreatingParent] = useState<Categoria | null>(null)
  const [viewingCategory, setViewingCategory] = useState<Categoria | null>(null)
  const [activeDropParentId, setActiveDropParentId] = useState<string | null>(null)
  const [dateFrom, setDateFrom] = useState<string | undefined>()
  const [dateTo, setDateTo] = useState<string | undefined>()

  const currentDelegation = getCurrentDelegation()
  const organizacionId = currentDelegation?.organizacion_id

  const {
    categorias: categories,
    loading,
    error,
    updateCategoria,
    fetchCategorias,
    saveCategoriaOrdenes,
  } = useCategorias(selectedDelegation)
  const { movimientos } = useMovimientos(selectedDelegation || null)
  const searchParams = useSearchParams()

  useEffect(() => {
    if (searchParams.get("panel") === "create") {
      setEditingCategory(null)
      setCreatingParent(null)
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
  const canReorderCategory = () => true
  const canCreateSubcategory = (category: Categoria) =>
    category.categoria_padre_id === null && (category.es_global ? isCentralManager : true)

  const handleEdit = (category: Categoria) => {
    if (!canEditCategory(category)) return
    setEditingCategory(category)
    setEditSheetOpen(true)
  }

  const handleCreate = () => {
    setEditingCategory(null)
    setCreatingParent(null)
    setCreateSheetOpen(true)
  }

  const handleAddSubcategory = (category: Categoria) => {
    if (!canCreateSubcategory(category)) return
    setCreatingParent(category)
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
    } catch (err) {
      console.error("Error deleting category:", err)
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

        if (patch.categoria_padre_id !== undefined) {
          updates.categoria_padre_id = patch.categoria_padre_id
        }

        if (!editingCategory.categoria_padre_id && patch.color) {
          updates.color = patch.color
        }

        if (isCentralManager && patch.es_global !== undefined) {
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

        const parentCategory = creatingParent
        const parentId = parentCategory?.id ?? patch.categoria_padre_id ?? null
        const targetIsGlobal = parentCategory ? parentCategory.es_global : !!patch.es_global

        if (targetIsGlobal && !isCentralManager) {
          alert("Solo el gestor central puede crear categorías globales")
          return
        }

        if (!targetIsGlobal && !selectedDelegation) {
          alert("Selecciona una delegación para crear categorías locales")
          return
        }

        const siblings = categories.filter(
          (category) =>
            (category.categoria_padre_id ?? null) === parentId &&
            (targetIsGlobal ? category.es_global : !category.es_global),
        )
        const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((c) => c.orden)) : 0

        await DatabaseService.createCategoria({
          organizacion_id: organizacionId,
          delegacion_id: targetIsGlobal ? null : parentCategory?.delegacion_id ?? selectedDelegation!,
          nombre: patch.nombre!,
          tipo: patch.tipo!,
          emoji: patch.emoji || parentCategory?.emoji || "📁",
          color: parentCategory?.color || patch.color || "#4ECDC4",
          orden: maxOrder + 1,
          categoria_padre_id: parentId,
          es_global: targetIsGlobal,
        })
      }

      await fetchCategorias()
      setEditSheetOpen(false)
      setCreateSheetOpen(false)
      setEditingCategory(null)
      setCreatingParent(null)
    } catch (err) {
      console.error("Error saving category:", err)
      alert("Error al guardar la categoría")
    }
  }

  const categoryMap = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories])

  const childrenMap = useMemo(() => {
    const map = new Map<string | null, Categoria[]>()
    for (const category of categories) {
      const key = category.categoria_padre_id ?? null
      const collection = map.get(key)
      if (collection) {
        collection.push(category)
      } else {
        map.set(key, [category])
      }
    }

    map.forEach((list) => {
      list.sort((a, b) => {
        const ordenA = "orden_efectivo" in a ? a.orden_efectivo ?? a.orden : a.orden
        const ordenB = "orden_efectivo" in b ? b.orden_efectivo ?? b.orden : b.orden
        if (ordenA !== ordenB) return ordenA - ordenB
        return a.nombre.localeCompare(b.nombre)
      })
    })

    return map
  }, [categories])

  const isFiltering = searchTerm.trim().length > 0

  const visibleCategoryIds = useMemo(() => {
    if (!isFiltering) {
      return new Set(categories.map((cat) => cat.id))
    }

    const lowerTerm = searchTerm.toLowerCase()
    const matches = new Set<string>()

    const addAncestors = (categoryId: string) => {
      let current = categoryMap.get(categoryId)
      while (current?.categoria_padre_id) {
        const parentId = current.categoria_padre_id
        matches.add(parentId)
        current = categoryMap.get(parentId)
      }
    }

    const addDescendants = (categoryId: string) => {
      const children = childrenMap.get(categoryId) ?? []
      for (const child of children) {
        if (!matches.has(child.id)) {
          matches.add(child.id)
          addDescendants(child.id)
        }
      }
    }

    for (const category of categories) {
      if (category.nombre.toLowerCase().includes(lowerTerm)) {
        matches.add(category.id)
        addAncestors(category.id)
        addDescendants(category.id)
      }
    }

    return matches
  }, [isFiltering, searchTerm, categories, categoryMap, childrenMap])

  const hasAnyCategory = categories.length > 0
  const hasVisibleCategories = categories.some((cat) => visibleCategoryIds.has(cat.id))

  const totalCount = categories.length
  const globalCount = categories.filter((category) => category.es_global).length

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

  const parseDroppableId = (droppableId: string): string | null | undefined => {
    if (droppableId === "root") return null
    if (droppableId.startsWith("children-")) {
      return droppableId.replace("children-", "")
    }
    return undefined
  }

  const getItemsForParent = (parentId: string | null) => Array.from(childrenMap.get(parentId) ?? [])

  const handleDragUpdate = (update: DragUpdate) => {
    const destination = update.destination
    if (!destination) {
      setActiveDropParentId(null)
      return
    }

    const parentId = parseDroppableId(destination.droppableId)
    if (parentId === undefined) return
    setActiveDropParentId(parentId)
  }

  const handleDragEnd = async (result: DropResult) => {
    setActiveDropParentId(null)

    const { destination, source, draggableId } = result
    if (!destination) return
    if (isFiltering) return

    const sourceParentId = parseDroppableId(source.droppableId)
    const destinationParentId = parseDroppableId(destination.droppableId)

    if (sourceParentId === undefined || destinationParentId === undefined) return
    if (sourceParentId === destinationParentId && destination.index === source.index) return

    const moved = categoryMap.get(draggableId)
    if (!moved) return

    const destinationParent = destinationParentId ? categoryMap.get(destinationParentId) ?? null : null

    if (destinationParent && moved.es_global && !destinationParent.es_global) {
      alert("No puedes anidar una categoría global dentro de una categoría local.")
      return
    }

    if (destinationParent && destinationParent.es_global && !moved.es_global) {
      alert("Solo el gestor central puede crear subcategorías globales.")
      return
    }

    if (
      destinationParent &&
      destinationParent.delegacion_id &&
      destinationParent.delegacion_id !== (moved.delegacion_id || selectedDelegation)
    ) {
      alert("No puedes mover la categoría a otra delegación.")
      return
    }

    if (!isCentralManager && moved.es_global && sourceParentId !== destinationParentId) {
      alert("Solo el gestor central puede cambiar la jerarquía de una categoría global.")
      return
    }

    const sourceItems = getItemsForParent(sourceParentId)
    const destinationItems =
      sourceParentId === destinationParentId ? sourceItems : getItemsForParent(destinationParentId)

    const [removed] = sourceItems.splice(source.index, 1)
    if (!removed || removed.id !== moved.id) {
      return
    }

    if (sourceParentId === destinationParentId) {
      sourceItems.splice(destination.index, 0, removed)
    } else {
      destinationItems.splice(destination.index, 0, removed)
    }

    const affectedLists = new Map<string | null, Categoria[]>([[sourceParentId, sourceItems]])
    if (sourceParentId !== destinationParentId) {
      affectedLists.set(destinationParentId, destinationItems)
    }

    const localUpdates: Promise<void>[] = []
    const globalOrderChanges: { categoriaId: string; orden: number }[] = []

    affectedLists.forEach((list, parentKey) => {
      let localPosition = 0
      let globalPosition = 0

      list.forEach((item) => {
        if (item.es_global) {
          globalPosition += 1
          const newOrder = globalPosition
          const currentOrder =
            "orden_override" in item && item.orden_override !== null ? item.orden_override : item.orden
          const currentParentId = item.categoria_padre_id ?? null

          if (currentOrder !== newOrder || currentParentId !== parentKey) {
            globalOrderChanges.push({ categoriaId: item.id, orden: newOrder })
          }
          return
        }

        localPosition += 1
        const newOrder = localPosition
        const currentParentId = item.categoria_padre_id ?? null
        const payload: Partial<Categoria> = {}

        if (currentParentId !== parentKey) {
          payload.categoria_padre_id = parentKey
          if (item.id === moved.id) {
            if (parentKey) {
              const parent = categoryMap.get(parentKey)
              payload.color = parent?.color ?? item.color
              payload.delegacion_id =
                parent?.delegacion_id ?? selectedDelegation ?? item.delegacion_id ?? null
            } else {
              payload.delegacion_id = selectedDelegation ?? item.delegacion_id ?? null
            }
          }
        }

        if (item.orden !== newOrder) {
          payload.orden = newOrder
        }

        if (Object.keys(payload).length > 0) {
          localUpdates.push(updateCategoria(item.id, payload))
        }
      })
    })

    const updates: Promise<void>[] = [...localUpdates]

    if (sourceParentId !== destinationParentId && moved.es_global) {
      updates.push(
        updateCategoria(moved.id, {
          categoria_padre_id: destinationParentId,
          delegacion_id: destinationParent ? destinationParent.delegacion_id ?? null : null,
          es_global: true,
          color: destinationParent?.color ?? moved.color,
        }),
      )
    }

    if (globalOrderChanges.length > 0) {
      if (!selectedDelegation) {
        console.warn("No hay delegación seleccionada para guardar el orden de categorías globales.")
      } else {
        updates.push(saveCategoriaOrdenes(globalOrderChanges))
      }
    }

    if (updates.length === 0) return

    try {
      await Promise.all(updates)
      await fetchCategorias()
    } catch (err) {
      console.error("Error reordenando categorías:", err)
      alert("No se pudo reordenar la categoría.")
    }
  }

  const renderCategoryTree = (parentId: string | null, depth: number) => {
    const droppableId = parentId ? `children-${parentId}` : "root"
    const fullItems = childrenMap.get(parentId) ?? []
    const items = !isFiltering ? fullItems : fullItems.filter((cat) => visibleCategoryIds.has(cat.id))
    const dropDisabled = isFiltering || depth > 1
    const noVisibleButExisting = isFiltering && fullItems.length > 0 && items.length === 0

    return (
      <Droppable droppableId={droppableId} type="CATEGORY" isDropDisabled={dropDisabled}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            className={cn(
              parentId ? "space-y-2" : "space-y-4",
              parentId && "ml-6 border-l border-dashed border-muted-foreground/30 pl-4",
              items.length === 0 && "py-2",
              snapshot.isDraggingOver && !dropDisabled && depth < 1 && "rounded-lg bg-muted/40",
            )}
          >
            {items.map((category, index) => {
              const dragDisabled = isFiltering || !canReorderCategory()
              const dragHint = dragDisabled
                ? "Desactiva los filtros para reorganizar"
                : category.es_global && !isCentralManager
                  ? "Arrastra para ordenar globales dentro de esta delegación. Solo el gestor central puede cambiar su jerarquía."
                  : "Arrastra para reordenar o anidar subcategorías"

              return (
                <div key={category.id} className="space-y-2">
                  <CategoryCard
                    category={category}
                    index={index}
                    depth={depth}
                    balance={getCategoryBalance(category.id)}
                    onEdit={handleEdit}
                    onSearch={handleSearch}
                    onDelete={handleDeleteRequest}
                    onAddSubcategory={handleAddSubcategory}
                    canEdit={canEditCategory(category)}
                    canDelete={canDeleteCategory(category)}
                    canAddSubcategory={canCreateSubcategory(category)}
                    isDragDisabled={dragDisabled}
                    dragHint={dragHint}
                    isGlobal={category.es_global}
                    isDropTarget={activeDropParentId === category.id}
                  />
                  {depth < 1 && renderCategoryTree(category.id, depth + 1)}
                </div>
              )
            })}
            {noVisibleButExisting && (
              <div className="rounded-md bg-muted/30 py-3 text-center text-xs text-muted-foreground">
                No hay resultados dentro de esta categoría.
              </div>
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    )
  }

  const showEmptyState = !hasAnyCategory && !isFiltering
  const showNoResults = hasAnyCategory && !hasVisibleCategories

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">Categorías</h2>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {totalCount} categorías en total ({globalCount} globales). Arrastra para reordenar y anidar; las globales solo
            cambian de jerarquía con permisos centrales.
          </p>
        </div>
        <Button onClick={handleCreate} size="default" className="w-full sm:w-auto" disabled={!organizacionId}>
          <Plus className="h-4 w-4 mr-2" />
          Añadir categoría
        </Button>
      </div>

      <div className="flex gap-4 flex-col sm:flex-row">
        <div className="flex-1 sm:flex-1">
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateRangeChange={handleDateRangeChange} />
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
              <Button variant="outline" size="icon" className="h-12 w-12" onClick={() => setSearchOpen(true)}>
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

      {isFiltering && (
        <p className="text-xs text-muted-foreground">
          El reordenamiento se desactiva mientras hay filtros activos.
        </p>
      )}

      {showEmptyState ? (
        <div className="flex items-center justify-center py-8 sm:py-12">
          <div className="text-center px-4">
            <p className="text-muted-foreground mb-4 text-sm sm:text-base">No hay categorías creadas</p>
            <Button onClick={handleCreate} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Crear primera categoría
            </Button>
          </div>
        </div>
      ) : (
        <>
          {showNoResults && (
            <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/20 p-4 text-center text-sm text-muted-foreground">
              No se encontraron categorías que coincidan con tu búsqueda.
            </div>
          )}

          <div className="space-y-3 text-xs text-muted-foreground">
            <p>
              Arrastra una tarjeta sobre otra para crear subcategorías (máximo un nivel). El icono de globo identifica las
              globales.
            </p>
          </div>
          <DragDropContext onDragEnd={handleDragEnd} onDragUpdate={handleDragUpdate}>
            <div className="mt-4">{renderCategoryTree(null, 0)}</div>
          </DragDropContext>
        </>
      )}

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

      <Sheet
        open={createSheetOpen}
        onOpenChange={(open) => {
          setCreateSheetOpen(open)
          if (!open) setCreatingParent(null)
        }}
      >
        <SheetContent className="w-full sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {creatingParent ? `Añadir subcategoría a ${creatingParent.nombre}` : "Crear categoría"}
            </SheetTitle>
          </SheetHeader>
          <CategoryEditForm
            category={{
              id: "",
              organizacion_id: organizacionId || "",
              delegacion_id: creatingParent
                ? creatingParent.delegacion_id
                : selectedDelegation || null,
              nombre: "",
              tipo: creatingParent?.tipo || "gasto",
              emoji: creatingParent?.emoji || "📁",
              color: creatingParent?.color || "#4ECDC4",
              orden: 0,
              categoria_padre_id: creatingParent?.id ?? null,
              creado_en: "",
              es_global: creatingParent ? creatingParent.es_global : false,
            }}
            parentCategory={creatingParent ?? undefined}
            onSave={handleSaveCategory}
            onCancel={() => {
              setCreateSheetOpen(false)
              setCreatingParent(null)
            }}
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
