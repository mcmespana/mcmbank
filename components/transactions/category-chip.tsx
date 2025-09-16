"use client"

import { useState, type CSSProperties } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"
import { CategorySelector } from "./category-selector"
import { getCategoryColorTokens } from "@/lib/utils/category-colors"
import type { Categoria } from "@/lib/types/database"

interface CategoryChipProps {
  category?: Categoria
  categories: Categoria[]
  onCategoryChange: (categoryId: string | null) => void
}

export function CategoryChip({ category, categories, onCategoryChange }: CategoryChipProps) {
  const [open, setOpen] = useState(false)

  const handleCategoryRemove = () => {
    onCategoryChange(null)
  }

  if (category) {
    const { color, textColor, rgbValue } = getCategoryColorTokens(category)
    const badgeStyles: CSSProperties = {
      ["--category-color" as string]: color,
      ["--category-text-color" as string]: textColor,
      ["--category-color-rgb" as string]: rgbValue,
    }

    return (
      <div className="flex items-center gap-2">
        <Badge
          variant="outline"
          className="group cursor-pointer rounded-full px-3 py-1.5 text-xs font-medium inline-flex items-center gap-2 transition-all duration-200 border border-transparent shadow-sm hover:shadow-md hover:scale-105 bg-[var(--category-color)] text-[var(--category-text-color)] dark:bg-transparent dark:text-foreground dark:border-[var(--category-color)] dark:shadow-none dark:hover:bg-[rgba(var(--category-color-rgb),0.18)]"
          style={badgeStyles}
          onClick={() => setOpen(true)}
        >
          <span
            aria-hidden
            className="hidden h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--category-color)] dark:inline-flex"
          />
          {category.emoji && <span className="text-xs">{category.emoji}</span>}
          <span className="text-xs font-medium leading-none">{category.nombre}</span>
        </Badge>

        <Button
          variant="ghost"
          size="sm"
          onClick={(e) => {
            e.stopPropagation()
            handleCategoryRemove()
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
