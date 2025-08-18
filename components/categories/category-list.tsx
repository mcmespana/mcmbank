"use client"

import { cn } from "@/lib/utils"
import { useState } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CategoryEditForm } from "./category-edit-form"
import { useCategorias } from "@/hooks/use-categorias"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useDelegationContext } from "@/contexts/delegation-context"
import { DatabaseService } from "@/lib/services/database"
import { DateRangeFilter } from "@/components/transactions/date-range-filter"
import { GripVertical, Search, Edit, Trash2, Plus } from "lucide-react"
import type { Categoria } from "@/lib/types/database"

const getBalanceColor = (balance: number) => {
  if (balance > 0) {
    return "bg-green-100 text-green-800 hover:bg-green-200"
  } else if (balance < 0) {
    return "bg-red-100 text-red-800 hover:bg-red-200"
  } else {
    return "bg-blue-100 text-blue-800 hover:bg-blue-200"
  }
}

const formatBalance = (balance: number) => {
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
  }).format(balance)
}

interface CategoryCardProps {
  category: Categoria
  index: number
  balance: number
  onEdit: (category: Categoria) => void
  onSearch: (category: Categoria) => void
  onDelete: (category: Categoria) => void
}

function CategoryCard({ category, index, balance, onEdit, onSearch, onDelete }: CategoryCardProps) {
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
              <div 
                className="flex h-12 w-12 items-center justify-center rounded-lg text-xl"
                style={{ backgroundColor: category.color || "#e5e7eb" }}
              >
                {category.emoji || "📁"}
              </div>

              {/* Category Info */}
              <div className="flex-1">
                <h3 className="font-medium">{category.nombre}</h3>
                <Badge className={getBalanceColor(balance)} variant="secondary">
                  {formatBalance(balance)}
                </Badge>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-600 hover:bg-gray-50"
                  onClick={() => onSearch(category)}
                  title="Buscar transacciones"
                >
                  <Search className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-gray-600 hover:bg-gray-50"
                  onClick={() => onEdit(category)}
                  title="Editar categoría"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-red-600 hover:bg-red-50"
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
  const [dateFrom, setDateFrom] = useState<string | undefined>()
  const [dateTo, setDateTo] = useState<string | undefined>()

  // Get organization ID from selected delegation
  const currentDelegation = getCurrentDelegation()
  const organizacionId = currentDelegation?.organizacion_id

  const { categorias: categories, loading, error, updateCategoria } = useCategorias(organizacionId)
  const { movimientos: movements } = useMovimientos(selectedDelegation, {
    fechaDesde: dateFrom,
    fechaHasta: dateTo,
  })

  // Calculate balance for each category
  const getCategoryBalance = (categoryId: string) => {
    return movements
      .filter(movement => movement.categoria_id === categoryId)
      .reduce((total, movement) => total + movement.importe, 0)
  }

  const handleEdit = (category: Categoria) => {
    setEditingCategory(category)
    setEditSheetOpen(true)
  }

  const handleCreate = () => {
    setEditingCategory(null)
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
        // Update existing category
        await updateCategoria(editingCategory.id, patch)
      } else if (organizacionId) {
        // Create new category
        const maxOrder = Math.max(...categories.map((c) => c.orden), 0)
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

      setEditSheetOpen(false)
      setCreateSheetOpen(false)
      setEditingCategory(null)
    } catch (error) {
      console.error("Error saving category:", error)
      alert("Error al guardar la categoría")
    }
  }

  const handleDragEnd = async (result: any) => {
    if (!result.destination) return

    const items = Array.from(sortedCategories)
    const [reorderedItem] = items.splice(result.source.index, 1)
    items.splice(result.destination.index, 0, reorderedItem)

    // Update order for all affected categories
    try {
      const updates = items.map((item, index) => ({
        id: item.id,
        orden: index + 1,
      }))

      for (const update of updates) {
        await updateCategoria(update.id, { orden: update.orden })
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
        <Button onClick={handleCreate}>
          <Plus className="h-4 w-4 mr-2" />
          Añadir categoría
        </Button>
      </div>

      {/* Search Bar and Date Filter */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Filtrar por nombre de la categoría..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Date Range Filter */}
        <DateRangeFilter
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateRangeChange={(from, to) => {
            setDateFrom(from)
            setDateTo(to)
          }}
        />
      </div>

      {/* Categories List */}
      {sortedCategories.length === 0 ? (
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
          <Droppable droppableId="categories">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3">
                {sortedCategories.map((category, index) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    index={index}
                    balance={getCategoryBalance(category.id)}
                    onEdit={handleEdit}
                    onSearch={handleSearch}
                    onDelete={handleDelete}
                  />
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
              tipo: "gasto",
              emoji: "📁",
              color: "#4ECDC4",
              orden: 0,
              categoria_padre_id: null,
              creado_en: "",
            }}
            onSave={handleSaveCategory}
            onCancel={() => setCreateSheetOpen(false)}
          />
        </SheetContent>
      </Sheet>
    </div>
  )
}
