"use client"

import type React from "react"

import { useState, useMemo, type CSSProperties } from "react"
import { Check, ChevronsUpDown, X, Search, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getCategoryColorTokens } from "@/lib/utils/category-colors"
import type { Categoria } from "@/lib/types/database"

interface CategorySelectorProps {
  categories: Categoria[]
  selectedCategories: string[]
  onSelectionChange: (categoryIds: string[]) => void
  allowMultiple?: boolean
  placeholder?: string
  onCategoryRemove?: (categoryId: string) => void
  showRemoveButton?: boolean
}

export function CategorySelector({
  categories,
  selectedCategories,
  onSelectionChange,
  allowMultiple = false,
  placeholder = "Seleccionar categoría...",
  onCategoryRemove,
  showRemoveButton = false,
}: CategorySelectorProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const filteredCategories = useMemo(() => {
    if (!searchValue) return categories
    return categories.filter(
      (category) =>
        category.nombre.toLowerCase().includes(searchValue.toLowerCase()) ||
        (category.emoji && category.emoji.includes(searchValue)),
    )
  }, [categories, searchValue])

  const selectedCategoryObjects = useMemo(() => {
    return categories.filter((cat) => selectedCategories.includes(cat.id))
  }, [categories, selectedCategories])

  const handleSelect = (categoryId: string) => {
    if (allowMultiple) {
      const newSelection = selectedCategories.includes(categoryId)
        ? selectedCategories.filter((id) => id !== categoryId)
        : [...selectedCategories, categoryId]
      onSelectionChange(newSelection)
    } else {
      onSelectionChange([categoryId])
      setOpen(false)
    }
  }

  const removeCategory = (categoryId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (onCategoryRemove) {
      onCategoryRemove(categoryId)
    } else {
      const newSelection = selectedCategories.filter((id) => id !== categoryId)
      onSelectionChange(newSelection)
    }
  }

  const clearAll = () => {
    onSelectionChange([])
  }

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between bg-background border-border hover:bg-muted/50 h-9"
          >
            <span className="truncate text-sm">
              {selectedCategories.length === 0
                ? placeholder
                : allowMultiple
                  ? `${selectedCategories.length} categoría${selectedCategories.length !== 1 ? "s" : ""} seleccionada${selectedCategories.length !== 1 ? "s" : ""}`
                  : selectedCategoryObjects[0]?.nombre || "Categoría seleccionada"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[320px] p-0" align="start">
          <div className="p-3 border-b">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar categorías..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                className="pl-9 bg-background h-8"
              />
            </div>
          </div>
          <ScrollArea className="h-[280px]">
            <div className="p-2">
              {filteredCategories.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">No se encontraron categorías</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {filteredCategories.map((category) => {
                    const { color, textColor, rgbValue } = getCategoryColorTokens(category)
                    const badgeStyles: CSSProperties = {
                      ["--category-color" as string]: color,
                      ["--category-text-color" as string]: textColor,
                      ["--category-color-rgb" as string]: rgbValue,
                    }

                    return (
                      <div
                        key={category.id}
                        className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                        onClick={() => handleSelect(category.id)}
                      >
                        <Badge
                          variant="outline"
                          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border border-transparent shadow-sm bg-[var(--category-color)] text-[var(--category-text-color)] transition-all duration-200 dark:bg-transparent dark:text-foreground dark:border-[var(--category-color)] dark:shadow-none"
                          style={badgeStyles}
                        >
                          <span
                            aria-hidden
                            className="hidden h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--category-color)] dark:inline-flex"
                          />
                          {category.emoji && <span className="text-xs">{category.emoji}</span>}
                          <span className="text-xs font-medium leading-none">{category.nombre}</span>
                        </Badge>
                        <div className="ml-auto">
                          {selectedCategories.includes(category.id) && <Check className="h-4 w-4 text-primary" />}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="p-3 border-t">
            <Button variant="outline" size="sm" className="w-full bg-transparent h-8">
              <Plus className="h-4 w-4 mr-2" />
              Crear nueva categoría
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected Categories Display */}
      {allowMultiple && selectedCategories.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Categorías seleccionadas ({selectedCategories.length})
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Limpiar todas
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedCategoryObjects.map((category) => {
              const { color, textColor, rgbValue } = getCategoryColorTokens(category)
              const badgeStyles: CSSProperties = {
                ["--category-color" as string]: color,
                ["--category-text-color" as string]: textColor,
                ["--category-color-rgb" as string]: rgbValue,
              }

              return (
                <Badge
                  key={category.id}
                  variant="outline"
                  className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium border border-transparent shadow-sm bg-[var(--category-color)] text-[var(--category-text-color)] dark:bg-transparent dark:text-foreground dark:border-[var(--category-color)] dark:shadow-none"
                  style={badgeStyles}
                >
                  <span
                    aria-hidden
                    className="hidden h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--category-color)] dark:inline-flex"
                  />
                  {category.emoji && <span className="text-xs">{category.emoji}</span>}
                  <span className="text-xs font-medium leading-none">{category.nombre}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => removeCategory(category.id, e)}
                    className="h-auto p-0 ml-1 rounded-full text-muted-foreground hover:text-red-500 hover:bg-red-100/60 dark:hover:bg-red-950/20"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
