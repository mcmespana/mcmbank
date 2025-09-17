"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
  type DraggableProvidedDragHandleProps,
} from "@hello-pangea/dnd"
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
import { cn } from "@/lib/utils"

interface CategoryCardProps {
  category: Categoria
  balance: number
  onEdit: (category: Categoria) => void
  onSearch: (category: Categoria) => void
  onDelete: (category: Categoria) => void
  canEdit: boolean
  canDelete: boolean
  isGlobal: boolean
  isDragDisabled: boolean
  dragHandleProps?: DraggableProvidedDragHandleProps | null
  isDragging: boolean
  childCount: number
  isFiltering: boolean
}

function CategoryCard({
  category,
  balance,
  onEdit,
  onSearch,
  onDelete,
  canEdit,
  canDelete,
  isGlobal,
  isDragDisabled,
  dragHandleProps,
  isDragging,
  childCount,
  isFiltering,
}: CategoryCardProps) {
  const isSub = !!category.categoria_padre_id
  const dragTitle = isDragDisabled
    ? isFiltering
      ? "Desactiva el filtro de búsqueda para reordenar"
      : category.es_global
        ? "Solo el gestor central puede reorganizar categorías globales"
        : undefined
    : "Arrastra para reordenar"

  return (
    <Card
      className={cn(
        "transition-shadow", 
        isDragging && "shadow-lg ring-1 ring-primary/40",
      )}
    >
      <CardContent className="p-3 sm:p-4 lg:p-5">
        <div className="flex items-center gap-3 sm:gap-4">
          <div
            {...(dragHandleProps ?? {})}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted flex-shrink-0",
              isDragDisabled ? "cursor-not-allowed opacity-40" : "cursor-grab active:cursor-grabbing",
            )}
            title={dragTitle}
          >
            <GripVertical className="h-4 w-4" />
          </div>

          <div
            className={cn(
              "flex h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 items-center justify-center rounded-xl text-xl sm:text-2xl shadow-sm flex-shrink-0",
              isSub && "h-10 w-10 sm:h-11 sm:w-11 text-lg",
            )}
            style={{ backgroundColor: category.color || "#e5e7eb" }}
          >
            {category.emoji || "📁"}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className={cn("font-semibold text-base sm:text-lg truncate", isSub && "font-medium")}>{category.nombre}</h3>
              {isGlobal && (
                <span className="inline-flex items-center gap-1 rounded-full border border-blue-200/60 bg-blue-100/40 px-2 py-0.5 text-[11px] font-medium text-blue-600 dark:border-blue-400/50 dark:bg-blue-950/20 dark:text-blue-200">
                  <Globe2 className="h-3 w-3" />
                  Global
                </span>
              )}
              {childCount > 0 && (
                <Badge
                  variant="outline"
                  className="border-muted-foreground/30 bg-transparent text-[10px] font-medium text-muted-foreground"
                >
                  {childCount} {childCount === 1 ? "subcategoría" : "subcategorías"}
                </Badge>
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
  )
}

interface CategoryTreeNodeProps {
  category: Categoria
  index: number
  getChildren: (parentId: string) => Categoria[]
  getFullChildCount: (parentId: string) => number
  onEdit: (category: Categoria) => void
  onSearch: (category: Categoria) => void
  onDelete: (category: Categoria) => void
  canEdit: (category: Categoria) => boolean
  canDelete: (category: Categoria) => boolean
  canReceiveChildren: (category: Categoria) => boolean
  canReorder: (category: Categoria) => boolean
  getBalance: (categoryId: string) => number
  isFiltering: boolean
}

function CategoryTreeNode({
  category,
  index,
  getChildren,
  getFullChildCount,
  onEdit,
  onSearch,
  onDelete,
  canEdit,
  canDelete,
  canReceiveChildren,
  canReorder,
  getBalance,
  isFiltering,
}: CategoryTreeNodeProps) {
  const visibleChildren = getChildren(category.id)
  const totalChildCount = getFullChildCount(category.id)
  const hiddenChildCount = totalChildCount - visibleChildren.length
  const reorderEnabled = canReorder(category)
  const allowDrop = canReceiveChildren(category)
  const shouldRenderChildArea = visibleChildren.length > 0 || allowDrop || hiddenChildCount > 0

  return (
    <Draggable draggableId={category.id} index={index} isDragDisabled={!reorderEnabled}>
      {(provided, snapshot) => (
        <div ref={provided.innerRef} {...provided.draggableProps} className="space-y-2">
          <CategoryCard
            category={category}
            balance={getBalance(category.id)}
            onEdit={onEdit}
            onSearch={onSearch}
            onDelete={onDelete}
            canEdit={canEdit(category)}
            canDelete={canDelete(category)}
            isGlobal={category.es_global}
            isDragDisabled={!reorderEnabled}
            dragHandleProps={provided.dragHandleProps}
            isDragging={snapshot.isDragging}
            childCount={totalChildCount}
            isFiltering={isFiltering}
          />

          {shouldRenderChildArea && (
            <div className="ml-6">
              <Droppable
                droppableId={`children-${category.id}`}
                isDropDisabled={!allowDrop}
              >
                {(dropProvided, dropSnapshot) => (
                  <div
                    ref={dropProvided.innerRef}
                    {...dropProvided.droppableProps}
                    className={cn(
                      "space-y-3 rounded-md border border-dashed border-transparent px-4 py-3 transition-colors",
                      (visibleChildren.length > 0 || allowDrop) && "border-muted-foreground/40",
                      dropSnapshot.isDraggingOver && allowDrop && "border-primary/50 bg-primary/5",
                    )}
                  >
                    {visibleChildren.map((child, childIndex) => (
                      <CategoryTreeNode
                        key={child.id}
                        category={child}
                        index={childIndex}
                        getChildren={getChildren}
                        getFullChildCount={getFullChildCount}
                        onEdit={onEdit}
                        onSearch={onSearch}
                        onDelete={onDelete}
                        canEdit={canEdit}
                        canDelete={canDelete}
                        canReceiveChildren={canReceiveChildren}
                        canReorder={canReorder}
                        getBalance={getBalance}
                        isFiltering={isFiltering}
                      />
                    ))}
                    {dropProvided.placeholder}
                    {visibleChildren.length === 0 && allowDrop && (
                      <p className="text-xs text-muted-foreground italic">
                        Arrastra aquí una categoría para convertirla en subcategoría
                      </p>
                    )}
                    {hiddenChildCount > 0 && (
                      <p className="text-xs text-muted-foreground italic">
                        {hiddenChildCount} subcategorías ocultas por el filtro
                      </p>
                    )}
                    {!allowDrop && visibleChildren.length === 0 && hiddenChildCount === 0 && (
                      <p className="text-xs text-muted-foreground italic">
                        Solo el gestor central puede modificar las subcategorías globales
                      </p>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          )}
        </div>
      )}
    </Draggable>
  )
}

interface CategorySectionProps {
  droppableId: string
  title: string
  description?: string
  categories: Categoria[]
  getChildren: (parentId: string) => Categoria[]
  getFullChildCount: (parentId: string) => number
  onEdit: (category: Categoria) => void
  onSearch: (category: Categoria) => void
  onDelete: (category: Categoria) => void
  canEdit: (category: Categoria) => boolean
  canDelete: (category: Categoria) => boolean
  canReceiveChildren: (category: Categoria) => boolean
  canReorder: (category: Categoria) => boolean
  getBalance: (categoryId: string) => number
  isDropDisabled: boolean
  isFiltering: boolean
  emptyMessage?: string
}

function CategorySection({
  droppableId,
  title,
  description,
  categories,
  getChildren,
  getFullChildCount,
  onEdit,
  onSearch,
  onDelete,
  canEdit,
  canDelete,
  canReceiveChildren,
  canReorder,
  getBalance,
  isDropDisabled,
  isFiltering,
  emptyMessage,
}: CategorySectionProps) {
  const dropDisabled = isDropDisabled || isFiltering
  const showEmptyState = categories.length === 0

  return (
    <div className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3">
        <h3 className="text-lg font-semibold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <Droppable droppableId={droppableId} isDropDisabled={dropDisabled}>
        {(provided, snapshot) => (
          <div
            ref={provided.innerRef}
            {...provided.droppableProps}
            className={cn(
              "space-y-4 p-4 transition-colors duration-200",
              snapshot.isDraggingOver && !dropDisabled && "rounded-b-lg bg-muted/40",
            )}
          >
            {showEmptyState ? (
              <div
                className={cn(
                  "flex min-h-[96px] items-center justify-center rounded-lg border border-dashed text-center text-sm text-muted-foreground",
                  dropDisabled ? "border-muted-foreground/20" : "border-muted-foreground/40 bg-muted/10",
                )}
              >
                {emptyMessage
                  ? emptyMessage
                  : dropDisabled
                    ? "No hay categorías en este nivel"
                    : "Arrastra aquí una categoría para añadirla a este nivel"}
              </div>
            ) : (
              categories.map((category, index) => (
                <CategoryTreeNode
                  key={category.id}
                  category={category}
                  index={index}
                  getChildren={getChildren}
                  getFullChildCount={getFullChildCount}
                  onEdit={onEdit}
                  onSearch={onSearch}
                  onDelete={onDelete}
                  canEdit={canEdit}
                  canDelete={canDelete}
                  canReceiveChildren={canReceiveChildren}
                  canReorder={canReorder}
                  getBalance={getBalance}
                  isFiltering={isFiltering}
                />
              ))
            )}
            {provided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
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

  useEffect(() => {
    if (searchParams.get("panel") === "create") {
      setEditingCategory(null)
      setCreateSheetOpen(true)
    }
  }, [searchParams])

  const getCategoryBalance = useCallback(
    (categoryId: string) => {
      let filteredMovements = movimientos.filter((mov) => mov.categoria_id === categoryId)

      if (dateFrom) {
        filteredMovements = filteredMovements.filter((mov) => mov.fecha >= dateFrom)
      }
      if (dateTo) {
        filteredMovements = filteredMovements.filter((mov) => mov.fecha <= dateTo)
      }

      return filteredMovements.reduce((sum, mov) => sum + mov.importe, 0)
    },
    [movimientos, dateFrom, dateTo],
  )

  const handleDateRangeChange = (newDateFrom?: string, newDateTo?: string) => {
    setDateFrom(newDateFrom)
    setDateTo(newDateTo)
  }

  const isFiltering = searchTerm.trim().length > 0

  const categoryById = useMemo(() => {
    const map = new Map<string, Categoria>()
    for (const category of categories) {
      map.set(category.id, category)
    }
    return map
  }, [categories])

  const fullChildMap = useMemo(() => {
    const map = new Map<string | null, Categoria[]>()
    for (const category of categories) {
      const parentId = category.categoria_padre_id
      const list = map.get(parentId ?? null) ?? []
      list.push(category)
      map.set(parentId ?? null, list)
    }

    for (const [, list] of map) {
      list.sort((a, b) => {
        if (a.orden !== b.orden) {
          return a.orden - b.orden
        }
        return a.nombre.localeCompare(b.nombre)
      })
    }

    return map
  }, [categories])

  const visibleCategoryIds = useMemo(() => {
    if (!isFiltering) {
      return new Set(categories.map((category) => category.id))
    }

    const normalized = searchTerm.trim().toLowerCase()
    const ids = new Set<string>()

    for (const category of categories) {
      if (category.nombre.toLowerCase().includes(normalized)) {
        let currentId: string | null = category.id
        while (currentId) {
          if (ids.has(currentId)) break
          ids.add(currentId)
          const parentId = categoryById.get(currentId)?.categoria_padre_id ?? null
          currentId = parentId
        }
      }
    }

    return ids
  }, [categories, categoryById, searchTerm, isFiltering])

  const visibleChildMap = useMemo(() => {
    const map = new Map<string | null, Categoria[]>()

    for (const [parentId, children] of fullChildMap.entries()) {
      const filtered = children.filter((child) => visibleCategoryIds.has(child.id))
      map.set(parentId, filtered)
    }

    return map
  }, [fullChildMap, visibleCategoryIds])

  const getVisibleChildren = useCallback(
    (parentId: string) => visibleChildMap.get(parentId) ?? [],
    [visibleChildMap],
  )

  const getFullChildCount = useCallback(
    (parentId: string) => fullChildMap.get(parentId)?.length ?? 0,
    [fullChildMap],
  )

  const visibleRoots = visibleChildMap.get(null) ?? []
  const visibleGlobalRoots = visibleRoots.filter((category) => category.es_global)
  const visibleLocalRoots = visibleRoots.filter(
    (category) => !category.es_global && (!selectedDelegation || category.delegacion_id === selectedDelegation),
  )

  const globalCount = categories.filter((category) => category.es_global).length
  const localCount = categories.length - globalCount

  const canEditCategory = useCallback(
    (category: Categoria) => (!category.es_global || isCentralManager),
    [isCentralManager],
  )

  const canDeleteCategory = canEditCategory

  const canReorderCategory = useCallback(
    (category: Categoria) => !isFiltering && (!category.es_global || isCentralManager),
    [isFiltering, isCentralManager],
  )

  const canReceiveChildren = useCallback(
    (category: Categoria) => {
      if (isFiltering) return false
      if (category.es_global) {
        return isCentralManager
      }
      if (selectedDelegation && category.delegacion_id && category.delegacion_id !== selectedDelegation) {
        return false
      }
      return true
    },
    [isFiltering, isCentralManager, selectedDelegation],
  )

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
    } catch (err) {
      console.error("Error deleting category:", err)
      alert("Error al eliminar la categoría")
    } finally {
      setDeletingCategory(null)
    }
  }

  const handleSaveCategory = async (patch: Partial<Categoria>) => {
    const patchWithPermissions: Partial<Categoria> = { ...patch }
    if (!isCentralManager) {
      patchWithPermissions.es_global = editingCategory?.es_global ?? false
    }

    try {
      if (editingCategory) {
        const updates: Partial<Categoria> = {
          nombre: patchWithPermissions.nombre,
          emoji: patchWithPermissions.emoji,
          tipo: patchWithPermissions.tipo,
        }

        if (patchWithPermissions.color && editingCategory.categoria_padre_id === null) {
          updates.color = patchWithPermissions.color
        }

        if (patchWithPermissions.es_global !== undefined) {
          updates.es_global = patchWithPermissions.es_global
          updates.delegacion_id = patchWithPermissions.es_global
            ? null
            : selectedDelegation || editingCategory.delegacion_id

          if (
            patchWithPermissions.es_global &&
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

        const isGlobal = !!patchWithPermissions.es_global

        if (!isGlobal && !selectedDelegation) {
          alert("Selecciona una delegación para crear categorías locales")
          return
        }

        const relevantCategories = categories.filter((category) =>
          isGlobal
            ? category.es_global
            : !category.es_global && category.delegacion_id === selectedDelegation,
        )
        const maxOrder =
          relevantCategories.length > 0 ? Math.max(...relevantCategories.map((c) => c.orden)) : 0

        await DatabaseService.createCategoria({
          organizacion_id: organizacionId,
          delegacion_id: isGlobal ? null : selectedDelegation!,
          nombre: patchWithPermissions.nombre!,
          tipo: patchWithPermissions.tipo!,
          emoji: patchWithPermissions.emoji || "📁",
          color: patchWithPermissions.color || "#4ECDC4",
          orden: maxOrder + 1,
          categoria_padre_id: patchWithPermissions.categoria_padre_id ?? null,
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

  const handleDragEnd = useCallback(
    async (result: DropResult) => {
      const { destination, source, draggableId } = result

      if (!destination || isFiltering) return
      if (destination.droppableId === source.droppableId && destination.index === source.index) return

      const moved = categoryById.get(draggableId)
      if (!moved) return
      if (!canReorderCategory(moved)) return

      const parseDroppable = (droppableId: string) => {
        if (droppableId === "root-global") {
          return { type: "root" as const, scope: "global" as const, parentId: null, droppableId }
        }
        if (droppableId === "root-local") {
          return { type: "root" as const, scope: "local" as const, parentId: null, droppableId }
        }
        if (droppableId.startsWith("children-")) {
          return {
            type: "children" as const,
            scope: "children" as const,
            parentId: droppableId.replace("children-", ""),
            droppableId,
          }
        }
        return { type: "unknown" as const, scope: "unknown" as const, parentId: null, droppableId }
      }

      const sourceInfo = parseDroppable(source.droppableId)
      const destinationInfo = parseDroppable(destination.droppableId)

      const rootCategories = fullChildMap.get(null) ?? []

      const getRootList = (scope: "global" | "local") =>
        rootCategories.filter((category) =>
          scope === "global"
            ? category.es_global
            : !category.es_global && (!selectedDelegation || category.delegacion_id === selectedDelegation),
        )

      const getSiblings = (info: ReturnType<typeof parseDroppable>) => {
        if (info.type === "root") {
          if (info.scope === "global") return getRootList("global")
          if (info.scope === "local") return getRootList("local")
        }
        if (info.type === "children" && info.parentId) {
          return fullChildMap.get(info.parentId) ?? []
        }
        return []
      }

      const sourceList = [...getSiblings(sourceInfo)]
      const destinationList =
        source.droppableId === destination.droppableId
          ? sourceList
          : [...getSiblings(destinationInfo)]

      const [removed] = sourceList.splice(source.index, 1)
      if (!removed) return

      if (source.droppableId === destination.droppableId) {
        sourceList.splice(destination.index, 0, removed)
      } else {
        destinationList.splice(destination.index, 0, removed)
      }

      let newParentId: string | null = null

      if (destinationInfo.type === "root") {
        if (destinationInfo.scope === "global") {
          if (!moved.es_global || !isCentralManager) return
        } else if (destinationInfo.scope === "local") {
          if (moved.es_global) return
          if (!selectedDelegation) return
          if (moved.delegacion_id && moved.delegacion_id !== selectedDelegation) return
        }
      } else if (destinationInfo.type === "children") {
        const parent = destinationInfo.parentId ? categoryById.get(destinationInfo.parentId) : null
        if (!parent) return
        if (parent.id === moved.id) return

        let ancestorId = parent.categoria_padre_id
        while (ancestorId) {
          if (ancestorId === moved.id) return
          ancestorId = categoryById.get(ancestorId)?.categoria_padre_id ?? null
        }

        if (moved.es_global && !parent.es_global) return
        if (!moved.es_global) {
          if (parent.delegacion_id && parent.delegacion_id !== (moved.delegacion_id || selectedDelegation)) {
            return
          }
          if (parent.es_global && !isCentralManager) {
            return
          }
        } else if (!isCentralManager) {
          return
        }

        newParentId = parent.id
      } else {
        return
      }

      const originalParentId = moved.categoria_padre_id
      const parentCategory = newParentId ? categoryById.get(newParentId) : null
      const updatesMap = new Map<string, Partial<Categoria>>()

      const applyOrderUpdates = (list: Categoria[]) => {
        list.forEach((item, idx) => {
          const payload = updatesMap.get(item.id) ?? {}
          const newOrden = idx + 1
          if (item.orden !== newOrden) {
            payload.orden = newOrden
          }
          updatesMap.set(item.id, payload)
        })
      }

      applyOrderUpdates(sourceList)
      if (source.droppableId !== destination.droppableId) {
        applyOrderUpdates(destinationList)
      }

      const movedPayload = updatesMap.get(moved.id) ?? {}

      if (originalParentId !== newParentId) {
        movedPayload.categoria_padre_id = newParentId
        if (parentCategory?.color) {
          movedPayload.color = parentCategory.color
        }
      }

      updatesMap.set(moved.id, movedPayload)

      const updates = Array.from(updatesMap.entries())
        .filter(([, payload]) => Object.keys(payload).length > 0)
        .map(([id, payload]) => updateCategoria(id, payload))

      if (updates.length === 0) return

      try {
        await Promise.all(updates)
        await fetchCategorias()
      } catch (error) {
        console.error("Error reordering categories:", error)
        alert("No se pudo actualizar el orden de las categorías")
      }
    },
    [
      isFiltering,
      categoryById,
      canReorderCategory,
      fullChildMap,
      selectedDelegation,
      isCentralManager,
      updateCategoria,
      fetchCategorias,
    ],
  )

  const noVisibleCategories = visibleCategoryIds.size === 0

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
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-b-2 border-primary"></div>
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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">Categorías</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {localCount} locales • {globalCount} globales • Arrastra para reordenar o crear jerarquías
          </p>
        </div>
        <Button onClick={handleCreate} size="default" className="w-full sm:w-auto" disabled={!organizacionId}>
          <Plus className="mr-2 h-4 w-4" />
          Añadir categoría
        </Button>
      </div>

      <div className="flex gap-4">
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
                    className="h-12 pl-10"
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

          <div className="relative hidden sm:block">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filtrar por nombre de la categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-12 pl-10"
            />
          </div>
        </div>
      </div>

      {isFiltering && (
        <p className="text-xs text-muted-foreground">
          Para reordenar o cambiar la jerarquía borra el filtro de búsqueda.
        </p>
      )}

      {noVisibleCategories ? (
        <div className="flex items-center justify-center py-8 sm:py-12">
          <div className="px-4 text-center">
            <p className="mb-4 text-sm text-muted-foreground sm:text-base">
              {searchTerm
                ? "No se encontraron categorías que coincidan con tu búsqueda"
                : "No hay categorías creadas"}
            </p>
            {!searchTerm && (
              <Button onClick={handleCreate} className="w-full sm:w-auto">
                <Plus className="mr-2 h-4 w-4" />
                Crear primera categoría
              </Button>
            )}
          </div>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="space-y-6">
            <CategorySection
              droppableId="root-global"
              title="Categorías globales"
              description="Visibles para todas las delegaciones"
              categories={visibleGlobalRoots}
              getChildren={getVisibleChildren}
              getFullChildCount={getFullChildCount}
              onEdit={handleEdit}
              onSearch={handleSearch}
              onDelete={handleDeleteRequest}
              canEdit={canEditCategory}
              canDelete={canDeleteCategory}
              canReceiveChildren={canReceiveChildren}
              canReorder={canReorderCategory}
              getBalance={getCategoryBalance}
              isDropDisabled={!isCentralManager}
              isFiltering={isFiltering}
              emptyMessage={
                isCentralManager
                  ? "No hay categorías globales. Marca una categoría como global para que aparezca aquí."
                  : "No hay categorías globales disponibles."
              }
            />

            <CategorySection
              droppableId="root-local"
              title="Categorías locales"
              description="Organización propia de la delegación seleccionada"
              categories={visibleLocalRoots}
              getChildren={getVisibleChildren}
              getFullChildCount={getFullChildCount}
              onEdit={handleEdit}
              onSearch={handleSearch}
              onDelete={handleDeleteRequest}
              canEdit={canEditCategory}
              canDelete={canDeleteCategory}
              canReceiveChildren={canReceiveChildren}
              canReorder={canReorderCategory}
              getBalance={getCategoryBalance}
              isDropDisabled={false}
              isFiltering={isFiltering}
              emptyMessage="Crea o arrastra aquí una categoría para empezar"
            />
          </div>
        </DragDropContext>
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
