"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"
import { CategorySelector } from "./category-selector"
import type { Categoria } from "@/lib/types/database"

interface CategoryChipProps {
  category?: Categoria
  categories: Categoria[]
  onCategoryChange: (categoryId: string | null) => void
}

export function CategoryChip({ category, categories, onCategoryChange }: CategoryChipProps) {
  const [open, setOpen] = useState(false)

  const getCategoryColor = (category: Categoria) => {
    if (category.color) {
      return category.color
    }
    // Colores por defecto basados en el tipo
    switch (category.tipo) {
      case "ingreso":
        return "#10b981" // green-500
      case "gasto":
        return "#ef4444" // red-500
      default:
        return "#6366f1" // indigo-500
    }
  }

  const getCategoryDisplayName = (category: Categoria) => {
    if (category.categoria_padre_id) {
      const parent = categories.find((c) => c.id === category.categoria_padre_id)
      return `${parent?.nombre || ""} > ${category.nombre}`
    }
    return category.nombre
  }

  const handleCategoryRemove = (categoryId: string) => {
    onCategoryChange(null)
  }

  if (category) {
    return (
      <div className="flex items-center gap-2">
        <Badge
          className="cursor-pointer hover:opacity-80 transition-all duration-200 rounded-full px-3 py-1.5 text-white font-medium flex items-center gap-1.5 text-xs shadow-sm hover:shadow-md transform hover:scale-105"
          style={{ backgroundColor: getCategoryColor(category) }}
          onClick={() => setOpen(true)}
        >
          {category.emoji && <span className="text-xs">{category.emoji}</span>}
          <span className="text-xs font-medium">{getCategoryDisplayName(category)}</span>
        </Badge>

        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            handleCategoryRemove(category.id)
          }}
          className="h-5 w-5 p-0 text-muted-foreground hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20"
          title="Quitar categoría"
        >
          <X className="h-3 w-3" />
        </Button>

        {open && (
          <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
            <div className="bg-background rounded-lg border shadow-lg w-full max-w-md">
              <div className="p-4">
                <div className="text-sm font-medium mb-3">Cambiar categoría</div>
                <CategorySelector
                  categories={categories}
                  selectedCategories={[category.id]}
                  onSelectionChange={(categoryIds) => {
                    onCategoryChange(categoryIds.length > 0 ? categoryIds[0] : null)
                    setOpen(false)
                  }}
                  allowMultiple={false}
                  placeholder="Seleccionar nueva categoría..."
                />
                <div className="flex justify-end mt-3">
                  <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-3 text-xs rounded-full border-dashed hover:bg-primary/5 hover:border-primary/30 bg-transparent transition-all duration-200 text-muted-foreground hover:text-primary"
        onClick={() => setOpen(true)}
      >
        <Plus className="h-3 w-3 mr-1.5" />
        Etiquetar
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg border shadow-lg w-full max-w-md">
            <div className="p-4">
              <div className="text-sm font-medium mb-3">Seleccionar categoría</div>
              <CategorySelector
                categories={categories}
                selectedCategories={[]}
                onSelectionChange={(categoryIds) => {
                  onCategoryChange(categoryIds.length > 0 ? categoryIds[0] : null)
                  setOpen(false)
                }}
                allowMultiple={false}
                placeholder="Elegir categoría..."
              />
              <div className="flex justify-end mt-3">
                <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
                  Cancelar
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
