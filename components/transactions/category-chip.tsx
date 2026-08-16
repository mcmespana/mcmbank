"use client"

import { useState, type CSSProperties } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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
    const { color, textColor, rgbValue } = getCategoryColorTokens(category, categories)
    const badgeStyles: CSSProperties = {
      ["--category-color" as string]: color,
      ["--category-text-color" as string]: textColor,
      ["--category-color-rgb" as string]: rgbValue,
    }

    // La X va dentro de la píldora, no suelta al lado: con un nombre largo la
    // píldora pasaba a dos líneas y la X se quedaba flotando en medio de la
    // nada, que era lo que hacía que la fila pareciera descuadrada.
    return (
      <div className="flex min-w-0 items-center">
        <Badge
          variant="outline"
          className="group cursor-pointer rounded-full rounded-r-none py-1 pl-2.5 pr-1.5 sm:py-1.5 sm:pl-3 text-xs font-medium inline-flex min-w-0 items-center gap-1.5 transition-[color,background-color,box-shadow] duration-200 border border-transparent shadow-sm hover:shadow-md bg-[var(--category-color)] text-[var(--category-text-color)] hover:bg-[var(--category-color)] dark:bg-transparent dark:border-[var(--category-color)] dark:text-[var(--category-color)] dark:hover:bg-[var(--category-color)]/15"
          style={badgeStyles}
          onClick={openDialog}
        >
          {category.emoji && <span className="text-xs">{category.emoji}</span>}
          <span className="text-xs font-medium leading-none truncate max-w-[9rem] sm:max-w-none">
            {category.nombre}
          </span>
        </Badge>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            handleCategoryRemove()
          }}
          className="inline-flex h-[26px] w-6 shrink-0 items-center justify-center rounded-full rounded-l-none border border-l-0 border-transparent bg-[var(--category-color)] text-[var(--category-text-color)] opacity-70 shadow-sm transition-opacity hover:opacity-100 dark:bg-transparent dark:border-[var(--category-color)] dark:text-[var(--category-color)] sm:h-7"
          style={badgeStyles}
          title="Quitar categoría"
          aria-label={`Quitar la categoría ${category.nombre}`}
        >
          <X className="h-3 w-3" />
        </button>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-3xl w-full p-0 overflow-hidden z-[80]" overlayClassName="z-[70]">
            <DialogHeader className="sr-only">
              <DialogTitle>Cambiar categoría</DialogTitle>
              <DialogDescription>
                Selecciona una nueva categoría para esta transacción.
              </DialogDescription>
            </DialogHeader>
            <CategoryMegaSelector
              categories={categories}
              selectedCategoryId={category.id}
              onSelect={(categoryId) => {
                onCategoryChange(categoryId)
              }}
              onClose={closeDialog}
              movement={movement}
              account={account}
              onCreateCategory={
                onCreateCategory
                  ? () => {
                      closeDialog()
                      onCreateCategory()
                    }
                  : undefined
              }
            />
          </DialogContent>
        </Dialog>
      </div>
    )
  }

  return (
    <div>
      <Button
        variant="outline"
        size="sm"
        className="h-7 px-3 text-xs rounded-full border-dashed hover:bg-primary/5 hover:border-primary/30 bg-transparent transition-colors duration-200 text-muted-foreground hover:text-primary"
        onClick={openDialog}
      >
        <Plus className="h-3 w-3 mr-1.5" />
        Etiquetar
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl w-full p-0 overflow-hidden z-[80]" overlayClassName="z-[70]">
          <DialogHeader className="sr-only">
            <DialogTitle>Asignar categoría</DialogTitle>
            <DialogDescription>
              Busca y selecciona la mejor categoría para esta transacción.
            </DialogDescription>
          </DialogHeader>
          <CategoryMegaSelector
            categories={categories}
            selectedCategoryId={null}
            onSelect={(categoryId) => {
              onCategoryChange(categoryId)
            }}
            onClose={closeDialog}
            movement={movement}
            account={account}
            onCreateCategory={
              onCreateCategory
                ? () => {
                    closeDialog()
                    onCreateCategory()
                  }
                : undefined
            }
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
