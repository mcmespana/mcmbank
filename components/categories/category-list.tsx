"use client"

import { cn } from "@/lib/utils"

import { useState } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ErrorMessage } from "@/components/ui/error-message"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CategoryEditForm } from "./category-edit-form"
import { useCategories } from "@/hooks/use-categories"
import { useDelegationContext } from "@/contexts/delegation-context"
import { GripVertical, Search, Edit, Trash2, Plus } from "lucide-react"
import type { Categoria, TipoCategoria } from "@/lib/types"

const getCategoryTypeColor = (tipo: TipoCategoria) => {
  switch (tipo) {
    case "ingreso":
      return "bg-green-100 text-green-800 hover:bg-green-200"
    case "gasto":
      return "bg-red-100 text-red-800 hover:bg-red-200"
    case "mixto":
      return "bg-blue-100 text-blue-800 hover:bg-blue-200"
    default:
      return "bg-gray-100 text-gray-800 hover:bg-gray-200"
  }
}

interface CategoryCardProps {
  category: Categoria
  index: number
  onEdit: (category: Categoria) => void
  onSearch: (category: Categoria) => void
}

function CategoryCard({ category, index, onEdit, onSearch }: CategoryCardProps) {
  return (
    <Draggable draggableId={category.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn("transition-shadow hover:shadow-md", snapshot.isDragging && "shadow-lg rotate-2")}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              {/* Drag Handle */}
              <div
                {...provided.dragHandleProps}
                className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing"
              >
                <GripVertical className="h-4 w-4" />
              </div>

              {/* Category Icon */}
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted">
                <span className="text-xl">{category.emoji}</span>
              </div>

              {/* Category Info */}
              <div className="flex-1">
                <h3 className="font-medium">{category.nombre}</h3>
                <Badge className={getCategoryTypeColor(category.tipo)} variant="secondary">
                  {category.tipo === "ingreso" ? "Ingreso" : "Gasto"}
                </Badge>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-blue-600 hover:bg-blue-50"
                  onClick={() => onSearch(category)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-600 hover:bg-gray-50"
                  onClick={() => onSearch(category)}
                >
                  <Search className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-600 hover:bg-gray-50"
                  onClick={() => onEdit(category)}
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-600 hover:bg-red-50">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </Draggable>
  )
}

export function CategoryList() {
  const { selectedDelegation, delegations } = useDelegationContext()
  const [searchTerm, setSearchTerm] = useState("")
  const [editingCategory, setEditingCategory] = useState<Categoria | null>(null)
  const [editSheetOpen, setEditSheetOpen] = useState(false)

  // Get organization ID from selected delegation
  const selectedDelegationData = delegations.find((d) => d.id === selectedDelegation)
  const orgId = selectedDelegationData?.organizacion_id || "org-1"

  const { categories, loading, error } = useCategories(orgId)

  const handleEdit = (category: Categoria) => {
    setEditingCategory(category)
    setEditSheetOpen(true)
  }

  const handleSearch = (category: Categoria) => {
    // Dummy function for now as requested
    console.log("Search transactions for category:", category.nombre)
  }

  const handleSaveCategory = async (patch: Partial<Categoria>) => {
    // TODO: Implement category update
    console.log("Save category:", patch)
    setEditSheetOpen(false)
    setEditingCategory(null)
  }

  const handleDragEnd = (result: any) => {
    if (!result.destination) return

    // TODO: Implement category reordering
    console.log("Reorder categories:", result)
  }

  if (!selectedDelegation) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">Selecciona una delegación para ver las categorías</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return <ErrorMessage message={error} />
  }

  if (categories.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">No se encontraron categorías</p>
      </div>
    )
  }

  // Filter categories by search term
  const filteredCategories = categories.filter((category) =>
    category.nombre.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  // Sort by order
  const sortedCategories = [...filteredCategories].sort((a, b) => a.orden - b.orden)

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Categorías</h2>
          <p className="text-muted-foreground">{categories.length} categorías • Arrastra para reordenar</p>
        </div>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          Añadir etiqueta
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filtrar por nombre de la etiqueta..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Categories List with Drag and Drop */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <Droppable droppableId="categories">
          {(provided) => (
            <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
              {sortedCategories.map((category, index) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  index={index}
                  onEdit={handleEdit}
                  onSearch={handleSearch}
                />
              ))}
              {provided.placeholder}
            </div>
          )}
        </Droppable>
      </DragDropContext>

      {/* Edit Category Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Editar etiqueta</SheetTitle>
          </SheetHeader>
          {editingCategory && (
            <CategoryEditForm
              category={editingCategory}
              onSave={handleSaveCategory}
              onCancel={() => setEditSheetOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
