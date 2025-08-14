"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Plus } from "lucide-react"
import type { Categoria } from "@/lib/types"

interface CategoryChipProps {
  category?: Categoria
  categories: Categoria[]
  onCategoryChange: (categoryId: string | null) => void
}

const CATEGORY_COLORS = [
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

export function CategoryChip({ category, categories, onCategoryChange }: CategoryChipProps) {
  const [open, setOpen] = useState(false)

  const getCategoryColor = (categoryId: string) => {
    const index = categoryId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)
    return CATEGORY_COLORS[index % CATEGORY_COLORS.length]
  }

  if (category) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Badge
            variant="secondary"
            className={`cursor-pointer hover:opacity-80 transition-opacity rounded-full px-3 py-1 ${getCategoryColor(category.id)}`}
          >
            {category.emoji && <span className="mr-1">{category.emoji}</span>}
            <span className="text-xs font-medium">{category.nombre}</span>
          </Badge>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="start">
          <div className="p-3">
            <div className="text-sm font-medium mb-2">Cambiar categoría</div>
            <Select
              value={category.id}
              onValueChange={(value) => {
                onCategoryChange(value === "none" ? null : value)
                setOpen(false)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin categoría</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <div className="flex items-center gap-2">
                      {cat.emoji && <span>{cat.emoji}</span>}
                      <span>{cat.nombre}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
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
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-3">
          <div className="text-sm font-medium mb-2">Seleccionar categoría</div>
          <Select
            onValueChange={(value) => {
              onCategoryChange(value === "none" ? null : value)
              setOpen(false)
            }}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Elegir categoría..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Sin categoría</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  <div className="flex items-center gap-2">
                    {cat.emoji && <span>{cat.emoji}</span>}
                    <span>{cat.nombre}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="w-full mt-2 bg-transparent">
            <Plus className="h-3 w-3 mr-1" />
            Añadir nueva categoría
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
