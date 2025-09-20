"use client"

import type React from "react"

import { useState, useMemo, useEffect, useRef } from "react"
import { Check, ChevronsUpDown, X, Search, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Categoria } from "@/lib/types/database"
import { CategoryPill } from "./category-pill"

interface CategorySelectorProps {
  categories: Categoria[]
  selectedCategories: string[]
  onSelectionChange: (categoryIds: string[]) => void
  allowMultiple?: boolean
  placeholder?: string
  onCategoryRemove?: (categoryId: string) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  focusSearchOnOpen?: boolean
}

export function CategorySelector({
  categories,
  selectedCategories,
  onSelectionChange,
  allowMultiple = false,
  placeholder = "Seleccionar categoría...",
  onCategoryRemove,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  focusSearchOnOpen = false,
}: CategorySelectorProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const [searchValue, setSearchValue] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)

  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen
  const setOpenState = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  useEffect(() => {
    if (!open) {
      return
    }

    setSearchValue("")

    if (!focusSearchOnOpen) {
      return
    }

    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })

    return () => cancelAnimationFrame(frame)
  }, [open, focusSearchOnOpen])

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
      setOpenState(false)
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
      <Popover open={open} onOpenChange={setOpenState}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            type="button"
            onClick={() => setOpenState(!open)}
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
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    const firstCategory = filteredCategories[0]
                    if (firstCategory) {
                      handleSelect(firstCategory.id)
                    }
                  }
                }}
                className="pl-9 bg-background h-8"
                ref={searchInputRef}
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
                    const isSelected = selectedCategories.includes(category.id)
                    return (
                      <div key={category.id} className="p-2">
                        <CategoryPill
                          category={category}
                          size={category.categoria_padre_id ? "sm" : "md"}
                          isSelected={isSelected}
                          onClick={() => handleSelect(category.id)}
                          className="flex w-full justify-between"
                          suffix={
                            isSelected ? (
                              <Check className="h-4 w-4 text-[rgba(var(--category-color-rgb),0.95)]" />
                            ) : undefined
                          }
                        />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </ScrollArea>
          <div className="p-3 border-t">
            <Button variant="outline" size="sm" className="w-full bg-transparent h-8" type="button">
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
              type="button"
              onClick={clearAll}
              className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Limpiar todas
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedCategoryObjects.map((category) => (
              <CategoryPill
                key={category.id}
                category={category}
                size="sm"
                className="gap-1"
                suffix={
                  <button
                    type="button"
                    className="ml-1 rounded-full p-0.5 text-[rgba(var(--category-color-rgb),0.85)] hover:bg-[rgba(var(--category-color-rgb),0.15)]"
                    onClick={(event) => removeCategory(category.id, event)}
                    aria-label={`Quitar ${category.nombre}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                }
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
