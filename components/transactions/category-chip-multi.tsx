"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CategorySearch } from "@/components/categories/category-search"
import { Plus } from "lucide-react"
import type { Categoria } from "@/lib/types/database"

interface CategoryChipMultiProps {
  category?: Categoria
  categories: Categoria[]
  onCategoryChange: (categoryId: string | null) => void
  onCreateNew?: () => void
}

export function CategoryChipMulti({ 
  category, 
  categories, 
  onCategoryChange, 
  onCreateNew 
}: CategoryChipMultiProps) {
  const [open, setOpen] = useState(false)

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

  const handleSelectionChange = (categoryIds: string[]) => {
    // For now, only support single category
    const categoryId = categoryIds.length > 0 ? categoryIds[0] : null
    onCategoryChange(categoryId)
    setOpen(false)
  }

  if (category) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Badge
            variant="secondary"
            className="cursor-pointer hover:opacity-80 transition-opacity rounded-full px-3 py-1"
            style={getCategoryColor(category)}
          >
            {category.emoji && <span className="mr-1">{category.emoji}</span>}
            <span className="text-xs font-medium">{category.nombre}</span>
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-3">
            <div className="text-sm font-medium">Cambiar categoría</div>
            <CategorySearch
              categories={categories}
              selectedCategories={category ? [category.id] : []}
              onSelectionChange={handleSelectionChange}
              allowMultiple={false}
              showCreateNew={!!onCreateNew}
              onCreateNew={onCreateNew}
              placeholder="Buscar categoría..."
            />
          </div>
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-6 px-2 text-xs rounded-full border-dashed hover:bg-muted bg-transparent"
        >
          <Plus className="h-3 w-3 mr-1" />
          Etiquetar
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-3">
          <div className="text-sm font-medium">Seleccionar categoría</div>
          <CategorySearch
            categories={categories}
            selectedCategories={[]}
            onSelectionChange={handleSelectionChange}
            allowMultiple={false}
            showCreateNew={!!onCreateNew}
            onCreateNew={onCreateNew}
            placeholder="Buscar categoría..."
          />
        </div>
      </PopoverContent>
    </Popover>
  )
}