"use client"

import { cn } from "@/lib/utils"
import { useState } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CategoryEditForm } from "./category-edit-form"
import { useCategorias } from "@/hooks/use-categorias"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useDelegationContext } from "@/contexts/delegation-context"
import { DatabaseService } from "@/lib/services/database"
import { GripVertical, Search, Edit, Trash2, Plus } from "lucide-react"
import { AmountDisplay } from "@/components/amount-display"
import type { Categoria } from "@/lib/types/database"

interface CategoryCardProps {
  category: Categoria
  index: number
  balance: number
  onEdit: (category: Categoria) => void
  onSearch: (category: Categoria) => void
  onDelete: (category: Categoria) => void
  onCreateSub?: (category: Categoria) => void
  isSubcategory?: boolean
}

function CategoryCard({ category, index, balance, onEdit, onSearch, onDelete, onCreateSub, isSubcategory = false }: CategoryCardProps) {
  return (
    <Draggable draggableId={category.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          className={cn(
            "transition-shadow hover:shadow-md",
            snapshot.isDragging && "shadow-lg rotate-2",
            isSubcategory && "ml-6"
          )}
        >
          <CardContent className={cn(isSubcategory ? "p-4" : "p-6")}> 
            <div className="flex items-center gap-4">
              {/* Drag Handle */}
              <div
                {...provided.dragHandleProps}
                className={cn(
                  "flex items-center justify-center rounded text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing",
                  isSubcategory ? "h-6 w-6" : "h-8 w-8"
                )}
              >
                <GripVertical className={cn(isSubcategory ? "h-3 w-3" : "h-4 w-4")}/>
              </div>

              {/* Category Icon */}
              <div
                className={cn(
                  "flex items-center justify-center rounded-xl text-2xl shadow-sm",
                  isSubcategory ? "h-10 w-10 text-xl" : "h-16 w-16"
                )}
                style={{ backgroundColor: category.color || "#e5e7eb" }}
              >
                {category.emoji || "📁"}
              </div>

              {/* Category Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className={cn("font-semibold truncate", isSubcategory ? "text-base" : "text-lg")}>{category.nombre}</h3>
                </div>
                <div className="flex items-center gap-2">
                  <AmountDisplay amount={balance} size="sm" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                {onCreateSub && !isSubcategory && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 text-gray-600 hover:bg-gray-50"
                    onClick={() => onCreateSub(category)}
                    title="Añadir subcategoría"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-gray-600 hover:bg-gray-50"
                  onClick={() => onSearch(category)}
                  title="Buscar transacciones"
                >
                  <Search className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-gray-600 hover:bg-gray-50"
                  onClick={() => onEdit(category)}
                  title="Editar categoría"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 text-red-600 hover:bg-red-50"
                  onClick={() => onDelete(category)}
                  title="Eliminar categoría"
                >
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
  const { selectedDelegation, delegations, getCurrentDelegation } = useDelegationContext()
  const [searchTerm, setSearchTerm] = useState("")
  const [editingCategory, setEditingCategory] = useState<Categoria | null>(null)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [createSheetOpen, setCreateSheetOpen] = useState(false)
  const [newSubParent, setNewSubParent] = useState<Categoria | null>(null)

  // Get organization ID from selected delegation
  const currentDelegation = getCurrentDelegation()
  const organizacionId = currentDelegation?.organizacion_id

  const { categorias: categories, loading, error, updateCategoria } = useCategorias(organizacionId)

  const { movimientos } = useMovimientos(selectedDelegation || null)

  const getCategoryBalance = (categoryId: string) => {
    return movimientos.filter((mov) => mov.categoria_id === categoryId).reduce((sum, mov) => sum + mov.importe, 0)
  }

  const handleEdit = (category: Categoria) => {
    setEditingCategory(category)
    setEditSheetOpen(true)
  }

  const handleCreate = () => {
    setEditingCategory(null)
    setNewSubParent(null)
    setCreateSheetOpen(true)
  }

  const handleCreateSub = (parent: Categoria) => {
    setEditingCategory(null)
    setNewSubParent(parent)
    setCreateSheetOpen(true)
  }

  const handleSearch = (category: Categoria) => {
    // Navigate to transactions page with category filter
    window.location.href = `/transacciones?categoria=${category.id}`
  }

  const handleDelete = async (category: Categoria) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar la categoría "${category.nombre}"?`)) {
      return
    }

    try {
      await DatabaseService.deleteCategoria(category.id)
      // The hook will automatically refetch the data
    } catch (error) {
      console.error("Error deleting category:", error)
      alert("Error al eliminar la categoría")
    }
  }

  const handleSaveCategory = async (patch: Partial<Categoria>) => {
    try {
      if (editingCategory) {
        await updateCategoria(editingCategory.id, patch)
      } else if (organizacionId) {
        if (newSubParent) {
          const siblings = categories.filter((c) => c.categoria_padre_id === newSubParent.id)
          const maxOrder = Math.max(...siblings.map((c) => c.orden), 0)
          await DatabaseService.createCategoria({
            organizacion_id: organizacionId,
            nombre: patch.nombre!,
            tipo: newSubParent.tipo,
            emoji: patch.emoji || "📁",
            color: newSubParent.color,
            orden: maxOrder + 1,
            categoria_padre_id: newSubParent.id,
          })
        } else {
          const roots = categories.filter((c) => !c.categoria_padre_id)
          const maxOrder = Math.max(...roots.map((c) => c.orden), 0)
          await DatabaseService.createCategoria({
            organizacion_id: organizacionId,
            nombre: patch.nombre!,
            tipo: patch.tipo!,
            emoji: patch.emoji || "📁",
            color: patch.color || "#4ECDC4",
            orden: maxOrder + 1,
            categoria_padre_id: null,
          })
        }
      }

      setEditSheetOpen(false)
      setCreateSheetOpen(false)
      setEditingCategory(null)
      setNewSubParent(null)
    } catch (error) {
      console.error("Error saving category:", error)
      alert("Error al guardar la categoría")
    }
  }

  const handleDragEnd = async (result: any) => {
    const { source, destination, draggableId } = result
    if (!destination) return

    const sourceParentId = source.droppableId === "root" ? null : source.droppableId
    const destParentId = destination.droppableId === "root" ? null : destination.droppableId

    const moved = categories.find((c) => c.id === draggableId)
    if (!moved) return

    const sourceGroup = categories
      .filter((c) => (c.categoria_padre_id || null) === sourceParentId && c.id !== draggableId)
      .sort((a, b) => a.orden - b.orden)

    const destGroup = categories
      .filter((c) => (c.categoria_padre_id || null) === destParentId && c.id !== draggableId)
      .sort((a, b) => a.orden - b.orden)

    destGroup.splice(destination.index, 0, moved)

    try {
      for (const [index, cat] of sourceGroup.entries()) {
        await updateCategoria(cat.id, { orden: index + 1 })
      }
      const parent = destParentId ? categories.find((c) => c.id === destParentId) : null
      for (const [index, cat] of destGroup.entries()) {
        const patch: Partial<Categoria> = { orden: index + 1 }
        if (cat.id === draggableId) {
          patch.categoria_padre_id = destParentId
          if (parent) {
            patch.color = parent.color
            patch.tipo = parent.tipo
          }
        }
        await updateCategoria(cat.id, patch)
      }
    } catch (error) {
      console.error("Error reordering categories:", error)
    }
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
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Cargando categorías...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-destructive">Error: {error}</p>
      </div>
    )
  }

  // Filter categories by search term
  const filterText = searchTerm.toLowerCase()
  const matched = categories.filter((c) => c.nombre.toLowerCase().includes(filterText))
  const matchedParentIds = new Set(matched.map((c) => c.categoria_padre_id).filter(Boolean) as string[])

  const rootCategories = categories
    .filter((c) => !c.categoria_padre_id)
    .filter((c) => (filterText ? matchedParentIds.has(c.id) || c.nombre.toLowerCase().includes(filterText) : true))
    .sort((a, b) => a.orden - b.orden)

  const getSubcategories = (parentId: string) =>
    categories
      .filter((c) => c.categoria_padre_id === parentId)
      .filter((c) => (filterText ? c.nombre.toLowerCase().includes(filterText) : true))
      .sort((a, b) => a.orden - b.orden)

  return (
    <div className="space-y-6">
      {/* Header with Search */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold">Categorías</h2>
          <p className="text-muted-foreground mt-1">{categories.length} categorías • Arrastra para reordenar</p>
        </div>
        <Button onClick={handleCreate} size="lg">
          <Plus className="h-4 w-4 mr-2" />
          Añadir categoría
        </Button>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Filtrar por nombre de la categoría..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 h-12"
        />
      </div>

      {/* Categories List */}
      {rootCategories.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">
              {searchTerm ? "No se encontraron categorías que coincidan con tu búsqueda" : "No hay categorías creadas"}
            </p>
            {!searchTerm && (
              <Button onClick={handleCreate}>
                <Plus className="h-4 w-4 mr-2" />
                Crear primera categoría
              </Button>
            )}
          </div>
        </div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="root" type="CATEGORY">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-4">
                {rootCategories.map((category, index) => (
                  <div key={category.id}>
                    <CategoryCard
                      category={category}
                      index={index}
                      balance={getCategoryBalance(category.id)}
                      onEdit={handleEdit}
                      onSearch={handleSearch}
                      onDelete={handleDelete}
                      onCreateSub={handleCreateSub}
                    />
                    <Droppable droppableId={category.id} type="CATEGORY">
                      {(subProvided) => (
                        <div {...subProvided.droppableProps} ref={subProvided.innerRef} className="mt-2 space-y-2">
                          {getSubcategories(category.id).map((sub, subIndex) => (
                            <CategoryCard
                              key={sub.id}
                              category={sub}
                              index={subIndex}
                              balance={getCategoryBalance(sub.id)}
                              onEdit={handleEdit}
                              onSearch={handleSearch}
                              onDelete={handleDelete}
                              isSubcategory
                            />
                          ))}
                          {subProvided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Edit Category Sheet */}
      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Editar categoría</SheetTitle>
          </SheetHeader>
          {editingCategory && (
            <CategoryEditForm
              category={editingCategory}
              parentCategory={
                categories.find((c) => c.id === editingCategory.categoria_padre_id) || null
              }
              onSave={handleSaveCategory}
              onCancel={() => setEditSheetOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Create Category Sheet */}
      <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Crear categoría</SheetTitle>
          </SheetHeader>
          <CategoryEditForm
            category={{
              id: "",
              organizacion_id: organizacionId || "",
              nombre: "",
              tipo: newSubParent ? newSubParent.tipo : "gasto",
              emoji: "📁",
              color: newSubParent ? newSubParent.color : "#4ECDC4",
              orden: 0,
              categoria_padre_id: newSubParent ? newSubParent.id : null,
              creado_en: "",
            }}
            parentCategory={newSubParent}
            onSave={handleSaveCategory}
            onCancel={() => setCreateSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
