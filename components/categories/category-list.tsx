"use client"

import { cn } from "@/lib/utils"
import { useState, useEffect, useMemo, useCallback, useRef } from "react"
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { CategoryEditForm } from "./category-edit-form"
import { DateRangeFilter } from "@/components/transactions/date-range-filter"
import { useCategorias } from "@/hooks/use-categorias"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useDelegationContext } from "@/contexts/delegation-context"
import useIsAdmin from "@/hooks/use-is-admin"
import useDelegationRole from "@/hooks/use-delegation-role"
import { DatabaseService } from "@/lib/services/database"
import {
  GripVertical,
  Search,
  Edit,
  Trash2,
  Plus,
  X,
  Globe2,
  PlusCircle,
  EyeOff,
  Eye,
  ChevronUp,
  ChevronDown,
  HelpCircle,
} from "lucide-react"
import { AmountDisplay } from "@/components/amount-display"
import autoAnimate from "@formkit/auto-animate"
import { DeleteCategoryDialog } from "./delete-category-dialog"
import { RelatedMovementsSheet } from "@/components/transactions/related-movements-sheet"
import type { Categoria, CategoriaConOrdenEfectivo } from "@/lib/types/database"

interface CategoryCardProps {
  category: CategoriaConOrdenEfectivo
  index: number
  depth: number
  balance: number
  onEdit: (category: CategoriaConOrdenEfectivo) => void
  onSearch: (category: CategoriaConOrdenEfectivo) => void
  onDelete: (category: CategoriaConOrdenEfectivo) => void
  onAddSubcategory?: (category: CategoriaConOrdenEfectivo) => void
  canEdit: boolean
  canDelete: boolean
  canAddSubcategory: boolean
  isDragDisabled: boolean
  dragHint: string
  isGlobal: boolean
  isDropTarget?: boolean
  dropPreviewMessage?: string | null
  dropPreviewStatus?: "valid" | "invalid"
  onMoveUp?: (category: CategoriaConOrdenEfectivo) => void
  onMoveDown?: (category: CategoriaConOrdenEfectivo) => void
  canMoveUp: boolean
  canMoveDown: boolean
  onToggleActive?: (category: CategoriaConOrdenEfectivo) => void
  canToggleActive: boolean
  canHideGlobal: boolean
  isInactive: boolean
  isRecentlyMoved?: boolean
}

function buildChildrenMap(items: CategoriaConOrdenEfectivo[]) {
  const map = new Map<string | null, CategoriaConOrdenEfectivo[]>()

  for (const category of items) {
    const key = category.categoria_padre_id ?? null
    const existing = map.get(key)
    if (existing) {
      existing.push(category)
    } else {
      map.set(key, [category])
    }
  }

  map.forEach((list) => {
    list.sort((a, b) => {
      const ordenA = a.orden_efectivo
      const ordenB = b.orden_efectivo
      if (ordenA !== ordenB) return ordenA - ordenB
      return a.nombre.localeCompare(b.nombre)
    })
  })

  return map
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
  dropPreviewMessage,
  dropPreviewStatus = "valid",
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  onToggleActive,
  canToggleActive,
  canHideGlobal,
  isInactive,
  isRecentlyMoved = false,
}: CategoryCardProps) {
  const indentation = depth * 24
  const addSubcategoryTitle = canAddSubcategory
    ? "Añadir subcategoría"
    : category.categoria_padre_id !== null
      ? "Solo las categorías principales pueden tener subcategorías"
      : category.es_global
        ? "Solo el gestor central o la tesorería pueden añadir subcategorías globales"
        : "No puedes añadir subcategorías en este momento"

  // Título del botón de toggle más descriptivo
  const toggleTitle = canHideGlobal
    ? (isInactive ? "Mostrar esta categoría global en tu delegación" : "Ocultar esta categoría global en tu delegación")
    : (isInactive ? "Activar categoría" : "Desactivar categoría")

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
          {isDropTarget && dropPreviewMessage && (
            <div className="absolute -top-3 left-14 sm:left-16 z-50">
              <div
                className={cn(
                  "rounded-md px-2 py-1 text-xs font-medium shadow-md",
                  dropPreviewStatus === "valid"
                    ? "bg-primary text-primary-foreground"
                    : "bg-destructive text-destructive-foreground",
                )}
              >
                {dropPreviewMessage}
              </div>
            </div>
          )}
          <div style={{ marginLeft: indentation }}>
            <Card
              className={cn(
                "transition-shadow hover:shadow-md bg-background",
                snapshot.isDragging && "shadow-lg ring-2 ring-primary/40",
                isDropTarget &&
                  !snapshot.isDragging &&
                  (dropPreviewStatus === "valid"
                    ? "ring-2 ring-primary/50"
                    : "ring-2 ring-destructive/40"),
                depth > 0 && "border-muted-foreground/20",
                isInactive && "opacity-70",
                isRecentlyMoved && "ring-2 ring-primary/40 shadow-lg shadow-primary/10",
              )}
            >
              <CardContent className="px-2.5 py-2 sm:px-3 sm:py-2.5">
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <div className="flex flex-col items-center gap-0.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground p-0"
                      onClick={() => onMoveUp?.(category)}
                      disabled={!canMoveUp}
                      title={canMoveUp ? "Mover hacia arriba" : "No se puede mover más arriba"}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </Button>
                    <div
                      {...(provided.dragHandleProps ?? {})}
                      className={cn(
                        "flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-md border border-dashed text-muted-foreground",
                        isDragDisabled
                          ? "cursor-not-allowed border-transparent opacity-40"
                          : "cursor-grab border-transparent bg-muted/40 hover:bg-muted/70 active:cursor-grabbing",
                      )}
                      title={dragHint}
                    >
                      <GripVertical className="h-3 w-3" />
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 sm:h-6 sm:w-6 text-muted-foreground p-0"
                      onClick={() => onMoveDown?.(category)}
                      disabled={!canMoveDown}
                      title={canMoveDown ? "Mover hacia abajo" : "No se puede mover más abajo"}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </div>

                  <div
                    className={cn(
                      "flex h-9 w-9 sm:h-10 sm:w-10 items-center justify-center rounded-lg text-lg sm:text-xl shadow flex-shrink-0",
                      depth > 0 && "h-7 w-7 sm:h-8 sm:w-8 text-sm sm:text-base",
                    )}
                    style={{ backgroundColor: category.color || "#e5e7eb" }}
                  >
                    {category.emoji || "📁"}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <h3
                        className={cn(
                          "font-semibold text-sm sm:text-base truncate",
                          depth > 0 && "font-medium",
                        )}
                      >
                        {category.nombre}
                      </h3>
                      {isInactive && (
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Oculta</span>
                      )}
                      {isGlobal && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-blue-500 dark:text-blue-200 cursor-help">
                              <Globe2 className="h-3 w-3" />
                            </span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <div className="text-center">
                              <div className="font-medium">Categoría global</div>
                              <div className="text-xs text-muted-foreground mt-0.5">No puedes modificar algunos aspectos</div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>
                    <div className="mt-0.5 text-[11px] text-muted-foreground">
                      <AmountDisplay amount={balance} size="sm" />
                    </div>
                  </div>

                  <div className="flex items-center gap-0.5 flex-shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 sm:h-7 sm:w-7 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 p-0"
                      onClick={() => onSearch(category)}
                      title="Buscar transacciones"
                    >
                      <Search className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 p-0"
                      onClick={() => onAddSubcategory?.(category)}
                      title={addSubcategoryTitle}
                      disabled={!canAddSubcategory}
                    >
                      <PlusCircle className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 sm:h-7 sm:w-7 text-gray-600 hover:bg-gray-50 dark:hover:bg-gray-900/30 p-0"
                      onClick={() => onEdit(category)}
                      title={canEdit ? "Editar categoría" : "Solo el gestor central puede editar categorías globales"}
                      disabled={!canEdit}
                    >
                      <Edit className="h-3 w-3" />
                    </Button>
                    {(canToggleActive || canHideGlobal) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 sm:h-7 sm:w-7 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/30 p-0"
                        onClick={() => onToggleActive?.(category)}
                        title={toggleTitle}
                      >
                        {isInactive ? (
                          <Eye className="h-3 w-3" />
                        ) : (
                          <EyeOff className="h-3 w-3" />
                        )}
                      </Button>
                    )}
                    {canDelete && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 sm:h-7 sm:w-7 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 p-0"
                        onClick={() => onDelete(category)}
                        title="Eliminar categoría"
                      >
                        <Trash2 className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
                      </Button>
                    )}
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
  const [editingCategory, setEditingCategory] = useState<CategoriaConOrdenEfectivo | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<CategoriaConOrdenEfectivo | null>(null)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [createSheetOpen, setCreateSheetOpen] = useState(false)
  const [creatingParent, setCreatingParent] = useState<CategoriaConOrdenEfectivo | null>(null)
  const [newCategoryDraft, setNewCategoryDraft] = useState<Categoria | null>(null)
  const [viewingCategory, setViewingCategory] = useState<CategoriaConOrdenEfectivo | null>(null)
  const [activeDropParentId, setActiveDropParentId] = useState<string | null>(null)
  const [dropPreview, setDropPreview] = useState<
    | {
        parentId: string | null
        message: string
        status: "valid" | "invalid"
      }
    | null
  >(null)
  const [dateFrom, setDateFrom] = useState<string | undefined>()
  const [dateTo, setDateTo] = useState<string | undefined>()
  const [showInactive, setShowInactive] = useState(false)
  const [optimisticOrders, setOptimisticOrders] = useState<Record<string, string[]>>({})
  const [recentlyMovedId, setRecentlyMovedId] = useState<string | null>(null)
  const animatedRefs = useRef(new WeakSet<Element>())

  const registerAutoAnimate = useCallback((node: HTMLElement | null) => {
    if (node && !animatedRefs.current.has(node)) {
      autoAnimate(node, { duration: 220, easing: "ease-in-out" })
      animatedRefs.current.add(node)
    }
  }, [])

  useEffect(() => {
    if (!recentlyMovedId) return

    const timeout = setTimeout(() => setRecentlyMovedId(null), 800)
    return () => clearTimeout(timeout)
  }, [recentlyMovedId])

  const currentDelegation = getCurrentDelegation()
  const organizacionId = currentDelegation?.organizacion_id
  const { role: delegationRole } = useDelegationRole(selectedDelegation)
  const isDelegationTreasurer = delegationRole === "tesorero"

  const {
    categorias: categories,
    loading,
    error,
    updateCategoria,
    fetchCategorias,
    saveCategoriaOrdenes,
  } = useCategorias(selectedDelegation, { includeInactive: showInactive })
  const { movimientos } = useMovimientos(
    selectedDelegation || null,
    { fechaDesde: dateFrom, fechaHasta: dateTo },
    { pageSize: 0 },
  )
  const searchParams = useSearchParams()

  useEffect(() => {
    setOptimisticOrders({})
  }, [categories])

  useEffect(() => {
    if (searchParams.get("panel") === "create") {
      setEditingCategory(null)
      setCreatingParent(null)
      setNewCategoryDraft({
        id: "",
        organizacion_id: organizacionId || "",
        delegacion_id: selectedDelegation || null,
        nombre: "",
        tipo: "mixto",
        emoji: "📁",
        color: "#4ECDC4",
        orden: 0,
        categoria_padre_id: null,
        creado_en: "",
        es_global: false,
        esta_activa: true,
      })
      setCreateSheetOpen(true)
    }
  }, [searchParams, organizacionId, selectedDelegation])

  const getCategoryBalance = (categoryId: string) => {
    const relatedCategoryIds = new Set([categoryId])

    for (const category of categories) {
      if (category.categoria_padre_id === categoryId) {
        relatedCategoryIds.add(category.id)
      }
    }

    const filteredMovements = movimientos.filter(
      (mov) => mov.categoria_id && relatedCategoryIds.has(mov.categoria_id),
    )

    return filteredMovements.reduce((sum, mov) => sum + mov.importe, 0)
  }

  const handleDateRangeChange = (newDateFrom?: string, newDateTo?: string) => {
    setDateFrom(newDateFrom)
    setDateTo(newDateTo)
  }

  // ============================================================================
  // LÓGICA DE PERMISOS MEJORADA
  // ============================================================================

  /**
   * Puede EDITAR (nombre, emoji, color) una categoría
   * - Gestor MCM: puede editar cualquier categoría (global o local)
   * - Tesorero: solo puede editar categorías locales de su delegación
   */
  const canEditCategory = (category: CategoriaConOrdenEfectivo) => {
    if (isCentralManager) return true
    if (!selectedDelegation) return false
    // Tesoreros solo pueden editar categorías locales de su delegación
    return !category.es_global && category.delegacion_id === selectedDelegation
  }

  /**
   * Puede ELIMINAR una categoría (borrado físico)
   * - Gestor MCM: puede eliminar cualquier categoría
   * - Tesorero: solo puede eliminar categorías locales de su delegación
   */
  const canDeleteCategory = (category: CategoriaConOrdenEfectivo) => {
    if (isCentralManager) return true
    if (!selectedDelegation) return false
    // Tesoreros solo pueden eliminar categorías locales de su delegación
    return !category.es_global && category.delegacion_id === selectedDelegation
  }

  /**
   * Puede ACTIVAR/DESACTIVAR una categoría (cambiar esta_activa)
   * - Gestor MCM: puede activar/desactivar categorías globales
   * - Tesorero: puede activar/desactivar categorías locales de su delegación
   */
  const canToggleCategoryActive = (category: CategoriaConOrdenEfectivo) => {
    if (isCentralManager) {
      // Gestor MCM solo activa/desactiva globales (las locales las elimina directamente)
      return category.es_global
    }
    if (!selectedDelegation) return false
    // Tesoreros pueden activar/desactivar sus categorías locales
    return !category.es_global && category.delegacion_id === selectedDelegation
  }

  /**
   * Puede OCULTAR/MOSTRAR una categoría global en su delegación (override local)
   * - Solo tesoreros pueden ocultar categorías globales en su delegación
   * - Gestor MCM no necesita ocultar, puede desactivar directamente
   */
  const canHideGlobalCategory = (category: CategoriaConOrdenEfectivo) => {
    if (isCentralManager) return false
    if (!selectedDelegation) return false
    // Solo para categorías globales
    return category.es_global
  }

  const canReorderCategory = () => true

  const canCreateSubcategory = (category: CategoriaConOrdenEfectivo) => {
    if (category.categoria_padre_id !== null) return false
    if (!category.es_global) return true
    return isCentralManager || (isDelegationTreasurer && !!selectedDelegation)
  }

  const handleEdit = (category: CategoriaConOrdenEfectivo) => {
    if (!canEditCategory(category)) return
    setEditingCategory(category)
    setEditSheetOpen(true)
  }

  const handleCreate = () => {
    setEditingCategory(null)
    setCreatingParent(null)
    setNewCategoryDraft({
      id: "",
      organizacion_id: organizacionId || "",
      delegacion_id: selectedDelegation || null,
      nombre: "",
      tipo: "mixto",
      emoji: "📁",
      color: "#4ECDC4",
      orden: 0,
      categoria_padre_id: null,
      creado_en: "",
      es_global: false,
      esta_activa: true,
    })
    setCreateSheetOpen(true)
  }

  const handleAddSubcategory = (category: CategoriaConOrdenEfectivo) => {
    if (!canCreateSubcategory(category)) return
    setCreatingParent(category)
    setEditingCategory(null)
    setNewCategoryDraft({
      id: "",
      organizacion_id: organizacionId || "",
      delegacion_id: category.delegacion_id,
      nombre: "",
      tipo: "mixto",
      emoji: "📁",
      color: category.color || "#4ECDC4",
      orden: 0,
      categoria_padre_id: category.id,
      creado_en: "",
      es_global: category.es_global,
      esta_activa: true,
    })
    setCreateSheetOpen(true)
  }

  const handleSearch = (category: CategoriaConOrdenEfectivo) => {
    setViewingCategory(category)
  }

  const handleDeleteRequest = (category: CategoriaConOrdenEfectivo) => {
    if (!canDeleteCategory(category)) return
    setDeletingCategory(category)
  }

  const handleToggleActive = async (category: CategoriaConOrdenEfectivo) => {
    try {
      // Caso 1: Ocultar/Mostrar categoría global (tesoreros)
      if (canHideGlobalCategory(category)) {
        if (!selectedDelegation) {
          alert("Selecciona una delegación para gestionar la visibilidad")
          return
        }

        const nextActive = !category.esta_activa_efectiva

        if (!nextActive) {
          // Ocultar categoría global en esta delegación
          await DatabaseService.setDelegacionCategoryVisibility(
            selectedDelegation,
            category.id,
            false,
            category.orden_override ?? category.orden,
          )
        } else if (category.orden_override === null && category.has_override) {
          // Si solo tiene override de visibilidad, eliminar el override
          await DatabaseService.clearDelegacionCategoryOrder(selectedDelegation, category.id)
        } else {
          // Mostrar categoría global en esta delegación
          await DatabaseService.setDelegacionCategoryVisibility(
            selectedDelegation,
            category.id,
            true,
            category.orden_override ?? category.orden,
          )
        }
      }
      // Caso 2: Activar/Desactivar categoría (gestor MCM para globales, tesoreros para locales)
      else if (canToggleCategoryActive(category)) {
        await updateCategoria(category.id, { esta_activa: !category.esta_activa })
      }

      await fetchCategorias()
    } catch (err) {
      console.error("Error toggling category visibility:", err)
      alert("No se pudo actualizar la visibilidad de la categoría")
    }
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
        const isCreatingSubcategoryOfGlobal = Boolean(parentCategory?.es_global)

        // Determinar si la nueva categoría será global
        // - Si hay parent y es global: solo gestor MCM puede crear subcategorías globales
        // - Tesoreros siempre crean categorías locales (incluso si el padre es global)
        let targetIsGlobal = false
        if (!parentCategory) {
          // Creando categoría principal: usar el valor del form
          targetIsGlobal = !!patch.es_global
        } else if (parentCategory.es_global) {
          // Creando subcategoría de global: solo global si es gestor MCM
          targetIsGlobal = isCentralManager && !!patch.es_global
        } else {
          // Creando subcategoría de local: siempre local
          targetIsGlobal = false
        }

        // Validación de permisos
        if (targetIsGlobal && !isCentralManager) {
          alert("Solo el gestor central puede crear categorías globales")
          return
        }

        if (isCreatingSubcategoryOfGlobal && !isCentralManager && !isDelegationTreasurer) {
          alert("Solo el gestor central o tesoreros pueden crear subcategorías de categorías globales")
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
          tipo: "mixto",
          emoji: patch.emoji || "📁",
          color: parentCategory?.color || patch.color || "#4ECDC4",
          orden: maxOrder + 1,
          categoria_padre_id: parentId,
          es_global: targetIsGlobal,
          esta_activa: true,
        })
      }

      await fetchCategorias()
      setEditSheetOpen(false)
      setCreateSheetOpen(false)
      setEditingCategory(null)
      setCreatingParent(null)
      setNewCategoryDraft(null)
    } catch (err) {
      console.error("Error saving category:", err)
      alert("Error al guardar la categoría")
    }
  }

  const displayedCategories = useMemo(
    () =>
      showInactive
        ? categories
        : categories.filter((cat) => cat.esta_activa_efectiva !== false),
    [categories, showInactive],
  )

  const categoryMap = useMemo(() => new Map(categories.map((cat) => [cat.id, cat])), [categories])
  const allChildrenMap = useMemo(() => buildChildrenMap(categories), [categories])
  const childrenMap = useMemo(() => buildChildrenMap(displayedCategories), [displayedCategories])

  const editingParentCategory = useMemo(() => {
    if (!editingCategory?.categoria_padre_id) return undefined
    return categories.find((c) => c.id === editingCategory.categoria_padre_id)
  }, [editingCategory?.categoria_padre_id, categories])

  const isFiltering = searchTerm.trim().length > 0

  const visibleCategoryIds = useMemo(() => {
    if (!isFiltering) {
      return new Set(displayedCategories.map((cat) => cat.id))
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

    for (const category of displayedCategories) {
      if (category.nombre.toLowerCase().includes(lowerTerm)) {
        matches.add(category.id)
        addAncestors(category.id)
        addDescendants(category.id)
      }
    }

    return matches
  }, [isFiltering, searchTerm, displayedCategories, categoryMap, childrenMap])

  const parseDroppableId = (droppableId: string): string | null | undefined => {
    if (droppableId === "root") return null
    if (droppableId.startsWith("children-")) {
      return droppableId.replace("children-", "")
    }
    return undefined
  }

  const orderKey = (parentId: string | null) => parentId ?? "__root__"

  const applyOptimisticOrder = useCallback(
    (items: CategoriaConOrdenEfectivo[], parentId: string | null) => {
      const key = orderKey(parentId)
      const order = optimisticOrders[key]
      if (!order) return items

      const itemMap = new Map(items.map((item) => [item.id, item]))
      const orderedItems: CategoriaConOrdenEfectivo[] = []

      for (const id of order) {
        const found = itemMap.get(id)
        if (found) {
          orderedItems.push(found)
          itemMap.delete(id)
        }
      }

      if (itemMap.size > 0) {
        orderedItems.push(...items.filter((item) => itemMap.has(item.id)))
      }

      return orderedItems
    },
    [optimisticOrders],
  )

  const getItemsForParent = (parentId: string | null) =>
    applyOptimisticOrder(Array.from(allChildrenMap.get(parentId) ?? []), parentId)

  const evaluateDropTarget = useCallback(
    ({
      draggableId,
      sourceParentId,
      destinationParentId,
    }: {
      draggableId: string
      sourceParentId: string | null
      destinationParentId: string | null
    }) => {
      const moved = categoryMap.get(draggableId)
      if (!moved) return null

      const destinationParent =
        destinationParentId !== null ? categoryMap.get(destinationParentId) ?? null : null
      const sourceParent =
        sourceParentId !== null ? categoryMap.get(sourceParentId) ?? null : null

      if (destinationParentId === draggableId) {
        return {
          allowed: false,
          message: "No permitido: no puedes convertir una categoría en subcategoría de sí misma.",
          status: "invalid" as const,
          reason: "Una categoría no puede ser subcategoría de sí misma.",
        }
      }

      if (destinationParent) {
        let current: CategoriaConOrdenEfectivo | null = destinationParent
        while (current) {
          if (current.id === moved.id) {
            return {
              allowed: false,
              message:
                "No permitido: no puedes mover la categoría dentro de su propia jerarquía.",
              status: "invalid" as const,
              reason: "No puedes mover una categoría dentro de su propia jerarquía.",
            }
          }

          current = current.categoria_padre_id
            ? categoryMap.get(current.categoria_padre_id) ?? null
            : null
        }
      }

      if (destinationParentId === sourceParentId) {
        return {
          allowed: false,
          message: destinationParent
            ? `Ya es subcategoría de ${destinationParent.nombre}`
            : "Ya es una categoría principal",
          status: "invalid" as const,
          reason: null,
        }
      }

      if (destinationParent && moved.es_global && !destinationParent.es_global) {
        return {
          allowed: false,
          message: "No permitido: una categoría global no puede depender de una delegación.",
          status: "invalid" as const,
          reason: "No puedes anidar una categoría global dentro de una categoría de delegación.",
        }
      }

      if (!isCentralManager && moved.es_global) {
        return {
          allowed: false,
          message:
            "No permitido: solo el gestor central puede cambiar la jerarquía de una categoría global.",
          status: "invalid" as const,
          reason: "Solo el gestor central puede cambiar la jerarquía de una categoría global.",
        }
      }

      if (!isCentralManager && sourceParent?.es_global) {
        return {
          allowed: false,
          message:
            "No permitido: solo el gestor central puede sacar subcategorías de una categoría global.",
          status: "invalid" as const,
          reason: "Solo el gestor central puede modificar las subcategorías de esta categoría global.",
        }
      }

      const canDelegationManageGlobal =
        isDelegationTreasurer &&
        !!selectedDelegation &&
        !moved.es_global &&
        moved.delegacion_id === selectedDelegation

      if (!isCentralManager && destinationParent?.es_global && !canDelegationManageGlobal) {
        return {
          allowed: false,
          message:
            "No permitido: solo el gestor central o la tesorería de esta delegación pueden añadir subcategorías a esta categoría global.",
          status: "invalid" as const,
          reason:
            "Solo el gestor central o la tesorería de esta delegación pueden añadir subcategorías a esta categoría global.",
        }
      }

      if (
        destinationParent &&
        destinationParent.delegacion_id &&
        destinationParent.delegacion_id !== (moved.delegacion_id || selectedDelegation)
      ) {
        return {
          allowed: false,
          message: "No permitido: no puedes mover la categoría a otra delegación.",
          status: "invalid" as const,
          reason: "No puedes mover la categoría a otra delegación.",
        }
      }

      return {
        allowed: true,
        message: destinationParent
          ? `Soltar para convertirla en subcategoría de ${destinationParent.nombre}`
          : "Soltar para convertirla en categoría principal",
        status: "valid" as const,
        reason: null,
      }
    },
    [categoryMap, isCentralManager, isDelegationTreasurer, selectedDelegation],
  )

  const handleDragUpdate = (update: DragUpdate) => {
    const destination = update.destination
    if (!destination) {
      setActiveDropParentId(null)
      setDropPreview(null)
      return
    }

    const parentId = parseDroppableId(destination.droppableId)
    if (parentId === undefined) return

    const sourceParentId = parseDroppableId(update.source.droppableId)
    if (sourceParentId === undefined) return

    const evaluation = evaluateDropTarget({
      draggableId: update.draggableId,
      sourceParentId,
      destinationParentId: parentId,
    })

    setActiveDropParentId(parentId)
    if (evaluation) {
      setDropPreview({ parentId, message: evaluation.message, status: evaluation.status })
    } else {
      setDropPreview(null)
    }
  }

  const persistListOrdering = async (
    lists: Map<string | null, CategoriaConOrdenEfectivo[]>,
    options: {
      movedCategory?: CategoriaConOrdenEfectivo
      sourceParentId?: string | null
      destinationParentId?: string | null
      destinationParent?: CategoriaConOrdenEfectivo | null
    } = {},
  ) => {
    const localUpdates: Promise<void>[] = []
    const globalOrderChanges: { categoriaId: string; orden: number }[] = []

    lists.forEach((list, parentKey) => {
      let localPosition = 0
      let globalPosition = 0

      list.forEach((item) => {
        if (item.es_global) {
          globalPosition += 1
          const newOrder = globalPosition
          const currentOrder = item.orden_override ?? item.orden
          const currentParentId = item.categoria_padre_id ?? null

          if (currentOrder !== newOrder || currentParentId !== parentKey) {
            globalOrderChanges.push({ categoriaId: item.id, orden: newOrder })
          }
          return
        }

        localPosition += 1
        const newOrder = localPosition
        const currentParentId = item.categoria_padre_id ?? null
        const payload: Partial<CategoriaConOrdenEfectivo> = {}

        if (currentParentId !== parentKey) {
          payload.categoria_padre_id = parentKey
          if (item.id === options.movedCategory?.id) {
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

    if (
      options.movedCategory?.es_global &&
      options.sourceParentId !== options.destinationParentId
    ) {
      updates.push(
        updateCategoria(options.movedCategory.id, {
          categoria_padre_id: options.destinationParentId ?? null,
          delegacion_id: options.destinationParent
            ? options.destinationParent.delegacion_id ?? null
            : null,
          es_global: true,
          color: options.destinationParent?.color ?? options.movedCategory.color,
        }),
      )
    }

    if (globalOrderChanges.length > 0) {
      if (!selectedDelegation) {
        console.warn(
          "No hay delegación seleccionada para guardar el orden de categorías globales.",
        )
      } else {
        updates.push(saveCategoriaOrdenes(globalOrderChanges))
      }
    }

    if (updates.length === 0) return

    try {
      await Promise.all(updates)
    } catch (err) {
      console.error("Error reordenando categorías:", err)
      alert("No se pudo reordenar la categoría.")
    }
  }

  const handleMoveCategory = async (
    category: CategoriaConOrdenEfectivo,
    direction: "up" | "down",
  ) => {
    if (isFiltering) return

    const parentId = category.categoria_padre_id ?? null
    const siblings = getItemsForParent(parentId)
    const currentIndex = siblings.findIndex((item) => item.id === category.id)
    if (currentIndex === -1) return

    const targetIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1
    if (targetIndex < 0 || targetIndex >= siblings.length) return

    const reordered = [...siblings]
    const [removed] = reordered.splice(currentIndex, 1)
    reordered.splice(targetIndex, 0, removed)

    const lists = new Map<string | null, CategoriaConOrdenEfectivo[]>([[parentId, reordered]])

    const key = orderKey(parentId)
    setOptimisticOrders((prev) => ({ ...prev, [key]: reordered.map((item) => item.id) }))
    setRecentlyMovedId(category.id)

    try {
      await persistListOrdering(lists, {
        movedCategory: category,
        sourceParentId: parentId,
        destinationParentId: parentId,
        destinationParent: parentId ? categoryMap.get(parentId) ?? null : null,
      })
    } finally {
      setOptimisticOrders((prev) => {
        const next = { ...prev }
        delete next[key]
        return next
      })
    }
  }

  const handleDragEnd = async (result: DropResult) => {
    setActiveDropParentId(null)
    setDropPreview(null)

    const { destination, source, draggableId } = result
    if (!destination) return
    if (isFiltering) return

    const sourceParentId = parseDroppableId(source.droppableId)
    const destinationParentId = parseDroppableId(destination.droppableId)

    if (sourceParentId === undefined || destinationParentId === undefined) return

    const evaluation = evaluateDropTarget({
      draggableId,
      sourceParentId,
      destinationParentId,
    })

    if (!evaluation) return
    if (!evaluation.allowed) {
      if (evaluation.reason) {
        alert(evaluation.reason)
      }
      return
    }

    const moved = categoryMap.get(draggableId)
    if (!moved) return

    const sourceItems = getItemsForParent(sourceParentId)
    const destinationItems = getItemsForParent(destinationParentId)

    const [removed] = sourceItems.splice(source.index, 1)
    if (!removed || removed.id !== moved.id) {
      return
    }

    const insertionIndex = Math.min(destination.index, destinationItems.length)
    destinationItems.splice(insertionIndex, 0, removed)

    const affectedLists = new Map<string | null, CategoriaConOrdenEfectivo[]>([
      [sourceParentId, sourceItems],
    ])
    affectedLists.set(destinationParentId, destinationItems)

    await persistListOrdering(affectedLists, {
      movedCategory: moved,
      sourceParentId,
      destinationParentId,
      destinationParent:
        destinationParentId !== null ? categoryMap.get(destinationParentId) ?? null : null,
    })
  }

  const hasAnyCategory = displayedCategories.length > 0
  const hasVisibleCategories = displayedCategories.some((cat) => visibleCategoryIds.has(cat.id))

  const totalCount = categories.length
  const globalCount = categories.filter((category) => category.es_global).length
  const inactiveCount = showInactive
    ? categories.filter((category) => category.esta_activa_efectiva === false).length
    : undefined

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

  const renderCategoryTree = (parentId: string | null, depth: number) => {
    const droppableId = parentId ? `children-${parentId}` : "root"
    const baseItems = childrenMap.get(parentId) ?? []
    const fullItems = applyOptimisticOrder([...baseItems], parentId)
    const items = !isFiltering ? fullItems : fullItems.filter((cat) => visibleCategoryIds.has(cat.id))
    const dropDisabled = isFiltering || depth > 1
    const noVisibleButExisting = isFiltering && fullItems.length > 0 && items.length === 0

    return (
      <Droppable droppableId={droppableId} type="CATEGORY" isDropDisabled={dropDisabled}>
        {(provided, snapshot) => (
          <div
            ref={(node) => {
              provided.innerRef(node)
              registerAutoAnimate(node)
            }}
            className={cn(
              parentId ? "space-y-1" : "space-y-3",
              parentId && "ml-4 border-l border-dashed border-muted-foreground/30 pl-3",
              items.length === 0 && "py-1.5",
              snapshot.isDraggingOver && !dropDisabled && depth < 1 && "rounded-lg bg-muted/40",
            )}
          >
            {items.map((category, index) => {
              const dragDisabled = isFiltering || !canReorderCategory()
              const dragHint = dragDisabled
                ? "Desactiva los filtros para mover subcategorías"
                : "Arrastra esta tarjeta sobre otra categoría principal para anidarla o hacia el encabezado para dejarla como categoría principal"
              const canMoveUp = !isFiltering && index > 0
              const canMoveDown = !isFiltering && index < items.length - 1
              const isInactive = category.esta_activa_efectiva === false

              return (
                <div key={category.id} className="space-y-1">
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
                    dropPreviewMessage={
                      dropPreview && dropPreview.parentId === category.id
                        ? dropPreview.message
                        : null
                    }
                    dropPreviewStatus={
                      dropPreview && dropPreview.parentId === category.id
                        ? dropPreview.status
                        : undefined
                    }
                    onMoveUp={(cat) => handleMoveCategory(cat, "up")}
                    onMoveDown={(cat) => handleMoveCategory(cat, "down")}
                    canMoveUp={canMoveUp}
                    canMoveDown={canMoveDown}
                    onToggleActive={handleToggleActive}
                    canToggleActive={canToggleCategoryActive(category)}
                    canHideGlobal={canHideGlobalCategory(category)}
                    isInactive={isInactive}
                    isRecentlyMoved={recentlyMovedId === category.id}
                  />
                  {depth < 1 && renderCategoryTree(category.id, depth + 1)}
                </div>
              )
            })}
            {parentId === null && dropPreview && dropPreview.parentId === null && (
              <div className="mb-2 flex justify-center">
                <div
                  className={cn(
                    "rounded-md px-3 py-1 text-xs font-medium shadow-md",
                    dropPreview.status === "valid"
                      ? "bg-primary text-primary-foreground"
                      : "bg-destructive text-destructive-foreground",
                  )}
                >
                  {dropPreview.message}
                </div>
              </div>
            )}
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
    <TooltipProvider>
      <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="h-10 w-2 bg-gradient-to-b from-primary via-primary/70 to-primary/40 rounded-full shadow-lg shadow-primary/30" />
            <h2 className="text-4xl font-extrabold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
              Categorías
            </h2>
          </div>
          <p className="text-muted-foreground ml-6 pl-4 text-base">
            {totalCount} categorías en total ({globalCount} globales).
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <Button onClick={handleCreate} className="flex-1 sm:flex-none" disabled={!organizacionId}>
            <Plus className="h-4 w-4 mr-2" />
            Añadir categoría
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="flex-1 sm:flex-none sm:w-auto"
            asChild
            title="¿Qué añado en cada categoría?"
          >
            <a
              href="https://docs.movimientoconsolacion.com/mcmespana/tesoreria/mcm-bank-guia/3.-categorias#que-pongo-en-cada-categoria"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2"
            >
              <HelpCircle className="h-4 w-4" />
              <span className="hidden sm:inline">¿Qué añado en cada categoría?</span>
            </a>
          </Button>
        </div>
      </div>

      <div className="flex gap-2 sm:gap-3 flex-wrap sm:flex-row items-center">
        <div className="flex-1 min-w-[200px]">
          <DateRangeFilter dateFrom={dateFrom} dateTo={dateTo} onDateRangeChange={handleDateRangeChange} />
        </div>

        <div className="flex-shrink-0 sm:flex-1">
          <div className="sm:hidden">
            {searchOpen ? (
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar categorías..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-9"
                    autoFocus
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 flex-shrink-0"
                  onClick={() => {
                    setSearchOpen(false)
                    setSearchTerm("")
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSearchOpen(true)}>
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
              className="pl-10 h-9 sm:h-10"
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

          <DragDropContext onDragEnd={handleDragEnd} onDragUpdate={handleDragUpdate}>
            <div className="mt-3.5">{renderCategoryTree(null, 0)}</div>
          </DragDropContext>

          <div className="pt-3.5 border-t border-dashed border-muted-foreground/30 mt-5">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2.5">
              <p className="text-xs text-muted-foreground">
                {showInactive
                  ? "Las categorías desactivadas aparecen atenuadas. Puedes volver a mostrarlas cuando quieras."
                  : "Puedes ocultar categorías globales que no uses habitualmente y mostrarlas aquí cuando las necesites."}
              </p>
              <Button
                variant="ghost"
                size="sm"
                className="self-start sm:self-auto"
                onClick={() => setShowInactive((prev) => !prev)}
              >
                {showInactive ? "Ocultar categorías desactivadas" : "Mostrar categorías desactivadas"}
                {inactiveCount !== undefined ? ` (${inactiveCount})` : ""}
              </Button>
            </div>
            {showInactive && inactiveCount === 0 && (
              <p className="text-xs text-muted-foreground mt-2">No hay categorías desactivadas en este momento.</p>
            )}
          </div>
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
              parentCategory={editingParentCategory}
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
          if (!open) {
            setCreatingParent(null)
            setNewCategoryDraft(null)
          }
        }}
      >
        <SheetContent className="w-full sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>
              {creatingParent ? `Añadir subcategoría a ${creatingParent.nombre}` : "Crear categoría"}
            </SheetTitle>
          </SheetHeader>
          {newCategoryDraft && (
            <CategoryEditForm
              category={newCategoryDraft}
              parentCategory={creatingParent ?? undefined}
              onSave={handleSaveCategory}
              onCancel={() => {
                setCreateSheetOpen(false)
                setCreatingParent(null)
                setNewCategoryDraft(null)
              }}
              canManageGlobal={isCentralManager}
            />
          )}
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
    </TooltipProvider>
  )
}
