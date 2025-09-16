"use client"

import { useState, type CSSProperties } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Plus, X } from "lucide-react"
import { getCategoryColorTokens } from "@/lib/utils/category-colors"
import type { Categoria, Movimiento, Cuenta } from "@/lib/types/database"
import { CategoryMegaSelector } from "./category-mega-selector"

interface CategoryChipProps {
  category?: Categoria
  categories: Categoria[]
  onCategoryChange: (categoryId: string | null) => void
  movement?: Movimiento | null
  account?: Cuenta | null
  onCreateCategory?: () => void
}

export function CategoryChip({
  category,
  categories,
  onCategoryChange,
  movement,
  account,
  onCreateCategory,
}: CategoryChipProps) {
  const [open, setOpen] = useState(false)

  const handleCategoryRemove = () => {
    onCategoryChange(null)
  }

  const closeDialog = () => {
    setOpen(false)
  }

  const openDialog = () => {
    setOpen(true)
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
          onClick={openDialog}
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
          <div
            className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6"
            onClick={closeDialog}
          >
            <div onClick={(event) => event.stopPropagation()}>
              <CategoryMegaSelector
                categories={categories}
                selectedCategoryId={category.id}
                onSelect={(categoryId) => {
                  onCategoryChange(categoryId)
                }}
                onClose={closeDialog}
                movement={movement}
                account={account}
                onCreateCategory={onCreateCategory}
              />
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
        onClick={openDialog}
      >
        <Plus className="h-3 w-3 mr-1.5" />
        Etiquetar
      </Button>

      {open && (
        <div
          className="fixed inset-0 z-[90] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-6"
          onClick={closeDialog}
        >
          <div onClick={(event) => event.stopPropagation()}>
            <CategoryMegaSelector
              categories={categories}
              selectedCategoryId={null}
              onSelect={(categoryId) => {
                onCategoryChange(categoryId)
              }}
              onClose={closeDialog}
              movement={movement}
              account={account}
              onCreateCategory={onCreateCategory}
            />
          </div>
        </div>
      )}
    </div>
  )
}
