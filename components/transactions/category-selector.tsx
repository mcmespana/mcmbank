"use client"

import type React from "react"

import { useState, useMemo } from "react"
import { Check, ChevronsUpDown, X, Search, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
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

  const groupedCategories = useMemo(() => {
    const match = (category: Categoria) =>
      category.nombre.toLowerCase().includes(searchValue.toLowerCase()) ||
      (category.emoji && category.emoji.includes(searchValue))

    const roots = categories
      .filter((c) => !c.categoria_padre_id)
      .sort((a, b) => a.orden - b.orden)

    return roots
      .map((root) => {
        const children = categories
          .filter((c) => c.categoria_padre_id === root.id)
          .sort((a, b) => a.orden - b.orden)
        return { root, children }
      })
      .filter(({ root, children }) =>
        searchValue ? match(root) || children.some(match) : true,
      )
      .map(({ root, children }) => ({
        root,
        children: searchValue ? children.filter(match) : children,
      }))
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
              {groupedCategories.length === 0 ? (
                <div className="text-center py-6 text-muted-foreground">
                  <p className="text-sm">No se encontraron categorías</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {groupedCategories.map(({ root, children }) => (
                    <div key={root.id} className="space-y-1">
                      <div
                        className="flex items-center gap-2 p-2 hover:bg-muted/50 rounded cursor-pointer"
                        onClick={() => handleSelect(root.id)}
                      >
                        <Badge
                          className="text-white font-medium rounded-full px-2 py-1 text-xs flex items-center gap-1"
                          style={{ backgroundColor: getCategoryColor(root) }}
                        >
                          {root.emoji && <span>{root.emoji}</span>}
                          <span>{root.nombre}</span>
                        </Badge>
                        <div className="ml-auto">
                          {selectedCategories.includes(root.id) && <Check className="h-4 w-4 text-primary" />}
                        </div>
                      </div>
                      {children.map((child) => (
                        <div
                          key={child.id}
                          className="flex items-center gap-2 p-2 pl-6 hover:bg-muted/50 rounded cursor-pointer"
                          onClick={() => handleSelect(child.id)}
                        >
                          <Badge
                            className="text-white font-medium rounded-full px-2 py-1 text-xs flex items-center gap-1"
                            style={{ backgroundColor: getCategoryColor(child) }}
                          >
                            {child.emoji && <span>{child.emoji}</span>}
                            <span>{child.nombre}</span>
                          </Badge>
                          <div className="ml-auto">
                            {selectedCategories.includes(child.id) && <Check className="h-4 w-4 text-primary" />}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
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
            {selectedCategoryObjects.map((category) => (
              <Badge
                key={category.id}
                className="flex items-center gap-2 pr-1 text-white font-medium rounded-full"
                style={{ backgroundColor: getCategoryColor(category) }}
              >
                {category.emoji && <span>{category.emoji}</span>}
                <span>{category.nombre}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => removeCategory(category.id, e)}
                  className="h-auto p-0 ml-1 hover:bg-white/20 text-white/80 hover:text-white"
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
