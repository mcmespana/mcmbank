"use client"

import { useState, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, Search, Check, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Categoria } from "@/lib/types/database"

interface CategorySearchProps {
  categories: Categoria[]
  selectedCategories: string[]
  onSelectionChange: (categoryIds: string[]) => void
  placeholder?: string
  maxHeight?: string
  allowMultiple?: boolean
  showCreateNew?: boolean
  onCreateNew?: () => void
  className?: string
}

export function CategorySearch({
  categories,
  selectedCategories,
  onSelectionChange,
  placeholder = "Buscar categorías...",
  maxHeight = "300px",
  allowMultiple = true,
  showCreateNew = false,
  onCreateNew,
  className
}: CategorySearchProps) {
  const [search, setSearch] = useState("")
  const [isOpen, setIsOpen] = useState(false)

  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories
    return categories.filter(category => 
      category.nombre.toLowerCase().includes(search.toLowerCase())
    )
  }, [categories, search])

  const selectedCategoryObjects = useMemo(() => {
    return categories.filter(cat => selectedCategories.includes(cat.id))
  }, [categories, selectedCategories])

  const handleCategoryToggle = (categoryId: string) => {
    if (allowMultiple) {
      const newSelection = selectedCategories.includes(categoryId)
        ? selectedCategories.filter(id => id !== categoryId)
        : [...selectedCategories, categoryId]
      onSelectionChange(newSelection)
    } else {
      onSelectionChange(selectedCategories.includes(categoryId) ? [] : [categoryId])
      setIsOpen(false)
    }
  }

  const handleRemoveCategory = (categoryId: string) => {
    onSelectionChange(selectedCategories.filter(id => id !== categoryId))
  }

  const getCategoryColor = (category: Categoria) => {
    if (category.color) {
      return {
        backgroundColor: category.color,
        color: 'white',
        borderColor: 'transparent'
      }
    }
    return undefined
  }

  return (
    <div className={cn("space-y-2", className)}>
      {/* Selected Categories */}
      {selectedCategoryObjects.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCategoryObjects.map((category) => (
            <Badge
              key={category.id}
              variant="secondary"
              className="rounded-full px-3 py-1 text-xs font-medium"
              style={getCategoryColor(category)}
            >
              {category.emoji && <span className="mr-1">{category.emoji}</span>}
              <span>{category.nombre}</span>
              <button
                onClick={() => handleRemoveCategory(category.id)}
                className="ml-1 hover:bg-black/20 rounded-full p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Category Selector */}
      <Popover open={isOpen} onOpenChange={setIsOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "w-full justify-start text-left font-normal",
              !selectedCategories.length && "text-muted-foreground"
            )}
          >
            <Search className="mr-2 h-4 w-4" />
            {selectedCategories.length > 0
              ? `${selectedCategories.length} categoría${selectedCategories.length > 1 ? 's' : ''} seleccionada${selectedCategories.length > 1 ? 's' : ''}`
              : placeholder
            }
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0" align="start">
          <div className="border-b p-3">
            <Input
              placeholder="Buscar categorías..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9"
              autoFocus
            />
          </div>
          
          <ScrollArea className="max-h-[300px] overflow-auto">
            <div className="p-2">
              {filteredCategories.length > 0 ? (
                <div className="space-y-1">
                  {filteredCategories.map((category) => {
                    const isSelected = selectedCategories.includes(category.id)
                    return (
                      <button
                        key={category.id}
                        onClick={() => handleCategoryToggle(category.id)}
                        className={cn(
                          "w-full flex items-center justify-between p-2 text-sm rounded-md hover:bg-muted transition-colors",
                          isSelected && "bg-muted"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="rounded-full px-2 py-0.5 text-xs"
                            style={getCategoryColor(category)}
                          >
                            {category.emoji && <span className="mr-1">{category.emoji}</span>}
                            <span>{category.nombre}</span>
                          </Badge>
                        </div>
                        {isSelected && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  No se encontraron categorías
                </div>
              )}
            </div>
          </ScrollArea>

          {showCreateNew && onCreateNew && (
            <div className="border-t p-2">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start"
                onClick={() => {
                  onCreateNew()
                  setIsOpen(false)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                Crear nueva categoría
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}