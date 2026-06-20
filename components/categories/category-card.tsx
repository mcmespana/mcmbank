"use client"

import { cn } from "@/lib/utils"
import { Draggable } from "@hello-pangea/dnd"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import {
  GripVertical,
  Search,
  Edit,
  Trash2,
  PlusCircle,
  EyeOff,
  Eye,
  ChevronUp,
  ChevronDown,
  Globe2,
} from "lucide-react"
import { AmountDisplay } from "@/components/amount-display"
import type { CategoriaConOrdenEfectivo } from "@/lib/types/database"

export interface CategoryCardProps {
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

export function CategoryCard({
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
                      aria-label="Mover categoría hacia arriba"
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
                      aria-label="Mover categoría hacia abajo"
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
                      aria-label="Buscar transacciones de la categoría"
                      title="Buscar transacciones"
                    >
                      <Search className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 sm:h-7 sm:w-7 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 p-0"
                      onClick={() => onAddSubcategory?.(category)}
                      aria-label="Añadir subcategoría"
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
                      aria-label="Editar categoría"
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
                        aria-label={isInactive ? "Mostrar categoría" : "Ocultar categoría"}
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
                        aria-label="Eliminar categoría"
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
