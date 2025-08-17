"use client"

import { useState, useRef, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { X, Plus, Search, Check } from "lucide-react"
import type { Categoria } from "@/lib/types/database"

interface CategoryChipProps {
  categories?: Categoria[]
  allCategories: Categoria[]
  onCategoriesChange: (categoryIds: string[]) => void
  maxCategories?: number
}

export function CategoryChip({ 
  categories = [], 
  allCategories, 
  onCategoriesChange,
  maxCategories = 5 
}: CategoryChipProps) {
  const [open, setOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Focus search input when popover opens
  useEffect(() => {
    if (open && searchInputRef.current) {
      setTimeout(() => searchInputRef.current?.focus(), 100)
    }
  }, [open])

  const filteredCategories = allCategories.filter(cat =>
    cat.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cat.emoji && cat.emoji.includes(searchTerm))
  )

  const handleCategoryToggle = (categoryId: string) => {
    const isSelected = categories.some(cat => cat.id === categoryId)
    
    if (isSelected) {
      // Remove category
      onCategoriesChange(categories.filter(cat => cat.id !== categoryId).map(cat => cat.id))
    } else {
      // Add category (if under max limit)
      if (categories.length < maxCategories) {
        onCategoriesChange([...categories.map(cat => cat.id), categoryId])
      }
    }
  }

  const removeCategory = (categoryId: string) => {
    onCategoriesChange(categories.filter(cat => cat.id !== categoryId).map(cat => cat.id))
  }

  const getCategoryColor = (category: Categoria) => {
    if (category.color) {
      return `bg-[${category.color}] text-white border-[${category.color}]`
    }
    // Fallback to predefined colors if no custom color
    const index = category.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    const fallbackColors = [
      "bg-red-100 text-red-800 border-red-200",
      "bg-blue-100 text-blue-800 border-blue-200",
      "bg-green-100 text-green-800 border-green-200",
      "bg-yellow-100 text-yellow-800 border-yellow-200",
      "bg-purple-100 text-purple-800 border-purple-200",
      "bg-pink-100 text-pink-800 border-pink-200",
      "bg-indigo-100 text-indigo-800 border-indigo-200",
      "bg-orange-100 text-orange-800 border-orange-200",
      "bg-teal-100 text-teal-800 border-teal-200",
      "bg-cyan-100 text-cyan-800 border-cyan-200",
    ]
    return fallbackColors[index % fallbackColors.length]
  }

  const isCategorySelected = (categoryId: string) => {
    return categories.some(cat => cat.id === categoryId)
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {/* Selected Categories */}
      {categories.map((category) => (
        <Badge
          key={category.id}
          variant="secondary"
          className={`cursor-pointer hover:opacity-80 transition-all rounded-full px-3 py-1 ${getCategoryColor(category)} group relative`}
        >
          {category.emoji && <span className="mr-1">{category.emoji}</span>}
          <span className="text-xs font-medium">{category.nombre}</span>
          
          {/* Remove button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              removeCategory(category.id)
            }}
            className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/20 rounded-full p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </Badge>
      ))}

      {/* Add Category Button */}
      {categories.length < maxCategories && (
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="h-6 px-2 text-xs rounded-full border-dashed hover:bg-muted bg-transparent"
            >
              <Plus className="h-3 w-3 mr-1" />
              {categories.length === 0 ? "Etiquetar" : "Añadir"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="start">
            <div className="p-4">
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-sm">Seleccionar categorías</h3>
                <span className="text-xs text-muted-foreground">
                  {categories.length}/{maxCategories}
                </span>
              </div>

              {/* Search */}
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  placeholder="Buscar categorías..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Categories List */}
              <ScrollArea className="h-64">
                <div className="space-y-1">
                  {filteredCategories.map((category) => {
                    const selected = isCategorySelected(category.id)
                    return (
                      <button
                        key={category.id}
                        onClick={() => handleCategoryToggle(category.id)}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors ${
                          selected ? 'bg-muted' : ''
                        }`}
                      >
                        {/* Selection indicator */}
                        <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                          selected 
                            ? 'bg-primary border-primary' 
                            : 'border-muted-foreground'
                        }`}>
                          {selected && <Check className="w-3 h-3 text-primary-foreground" />}
                        </div>

                        {/* Category chip preview */}
                        <div className={`flex-1 flex items-center gap-2 px-2 py-1 rounded-full text-xs ${getCategoryColor(category)}`}>
                          {category.emoji && <span>{category.emoji}</span>}
                          <span className="font-medium">{category.nombre}</span>
                        </div>
                      </button>
                    )
                  })}
                  
                  {filteredCategories.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      No se encontraron categorías
                    </div>
                  )}
                </div>
              </ScrollArea>

              {/* Footer */}
              <div className="pt-4 border-t border-border">
                <Button variant="outline" size="sm" className="w-full bg-transparent">
                  <Plus className="h-3 w-3 mr-1" />
                  Crear nueva categoría
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}
