"use client"

import { useState, useMemo } from "react"
import { Check, ChevronsUpDown, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"
import type { Categoria } from "@/lib/types/database"

interface CategorySearchProps {
  categories: Categoria[]
  selectedCategories: string[]
  onSelectionChange: (categoryIds: string[]) => void
  allowMultiple?: boolean
  placeholder?: string
}

export function CategorySearch({
  categories,
  selectedCategories,
  onSelectionChange,
  allowMultiple = false,
  placeholder = "Seleccionar categoría..."
}: CategorySearchProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState("")

  const filteredCategories = useMemo(() => {
    if (!searchValue) return categories
    return categories.filter(category =>
      category.nombre.toLowerCase().includes(searchValue.toLowerCase()) ||
      (category.emoji && category.emoji.includes(searchValue))
    )
  }, [categories, searchValue])

  const selectedCategoryObjects = useMemo(() => {
    return categories.filter(cat => selectedCategories.includes(cat.id))
  }, [categories, selectedCategories])

  const handleSelect = (categoryId: string) => {
    if (allowMultiple) {
      const newSelection = selectedCategories.includes(categoryId)
        ? selectedCategories.filter(id => id !== categoryId)
        : [...selectedCategories, categoryId]
      onSelectionChange(newSelection)
    } else {
      onSelectionChange([categoryId])
      setOpen(false)
    }
  }

  const removeCategory = (categoryId: string) => {
    const newSelection = selectedCategories.filter(id => id !== categoryId)
    onSelectionChange(newSelection)
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
            className="w-full justify-between"
          >
            <span className="truncate">
              {selectedCategories.length === 0
                ? placeholder
                : allowMultiple
                ? `${selectedCategories.length} categoría${selectedCategories.length !== 1 ? 's' : ''} seleccionada${selectedCategories.length !== 1 ? 's' : ''}`
                : selectedCategoryObjects[0]?.nombre || 'Categoría seleccionada'}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput
              placeholder="Buscar categorías..."
              value={searchValue}
              onValueChange={setSearchValue}
            />
            <CommandList>
              <CommandEmpty>No se encontraron categorías.</CommandEmpty>
              <CommandGroup>
                {filteredCategories.map((category) => (
                  <CommandItem
                    key={category.id}
                    value={category.id}
                    onSelect={() => handleSelect(category.id)}
                  >
                    <Check
                      className={`mr-2 h-4 w-4 ${
                        selectedCategories.includes(category.id) ? "opacity-100" : "opacity-0"
                      }`}
                    />
                    <div className="flex items-center gap-2">
                      {category.emoji && <span>{category.emoji}</span>}
                      <span>{category.nombre}</span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Selected Categories Display */}
      {allowMultiple && selectedCategories.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Categorías seleccionadas:</span>
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
                variant="secondary"
                className="flex items-center gap-1 pr-1"
              >
                {category.emoji && <span>{category.emoji}</span>}
                <span>{category.nombre}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCategory(category.id)}
                  className="h-auto p-0 ml-1 hover:bg-transparent"
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
