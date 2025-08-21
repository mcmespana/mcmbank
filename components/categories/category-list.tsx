"use client"

import { cn } from "@/lib/utils"
import { useState } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CategoryEditForm } from "./category-edit-form"
import { DateRangeFilter } from "@/components/transactions/date-range-filter"
import { useCategorias } from "@/hooks/use-categorias"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useDelegationContext } from "@/contexts/delegation-context"
import { DatabaseService } from "@/lib/services/database"
import { GripVertical, Search, Edit, Trash2, Plus, Building2, Wallet, X } from "lucide-react"
import { AmountDisplay } from "@/components/amount-display"
import { DeleteCategoryDialog } from "./delete-category-dialog"
import type { Categoria } from "@/lib/types/database"

const getCategoryTypeColor = (tipo: string) => {
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
          <CardContent className="p-3 sm:p-4 lg:p-6">
            <div className="flex items-center gap-3 sm:gap-4">
              {/* Drag Handle */}
              <div
                {...provided.dragHandleProps}
                className="flex h-8 w-8 items-center justify-center rounded text-muted-foreground hover:bg-muted cursor-grab active:cursor-grabbing flex-shrink-0"
              >
                <GripVertical className="h-4 w-4" />
              </div>

              {/* Category Icon */}
              <div
                className="flex h-12 w-12 sm:h-14 sm:w-14 lg:h-16 lg:w-16 items-center justify-center rounded-xl text-xl sm:text-2xl shadow-sm flex-shrink-0"
                style={{ backgroundColor: category.color || "#e5e7eb" }}
              >
                {category.emoji || "📁"}
              </div>

              {/* Category Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-base sm:text-lg truncate">{category.nombre}</h3>
                    <div className="flex items-center gap-2 mt-1 sm:mt-0">
                      
                      
                      
                    <AmountDisplay amount={balance} size="sm" />


                    </div>
                  </div>
                  
             
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 text-blue-600 hover:bg-blue-50"
                  onClick={() => onSearch(category)}
                  title="Buscar transacciones"
                >
                  <Search className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 text-gray-600 hover:bg-gray-50"
                  onClick={() => onEdit(category)}
                  title="Editar categoría"
                >
                  <Edit className="h-3 w-3 sm:h-4 sm:w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 sm:h-9 sm:w-9 text-red-600 hover:bg-red-50"
                  onClick={() => onDelete(category)}
                  title="Eliminar categoría"
                >
                  <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
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
  const { selectedDelegation, getCurrentDelegation } = useDelegationContext()
  const [searchTerm, setSearchTerm] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<Categoria | null>(null)
  const [deletingCategory, setDeletingCategory] = useState<Categoria | null>(null)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [createSheetOpen, setCreateSheetOpen] = useState(false)
  const [dateFrom, setDateFrom] = useState<string | undefined>()
  const [dateTo, setDateTo] = useState<string | undefined>()

  const currentDelegation = getCurrentDelegation()
  const organizacionId = currentDelegation?.organizacion_id

  const { categorias: categories, loading, error, updateCategoria, fetchCategorias } = useCategorias(organizacionId)
  const { movimientos } = useMovimientos(selectedDelegation || null)

  const getCategoryBalance = (categoryId: string) => {
    let filteredMovements = movimientos.filter((mov) => mov.categoria_id === categoryId)
    
    if (dateFrom) {
      filteredMovements = filteredMovements.filter((mov) => mov.fecha >= dateFrom)
    }
    if (dateTo) {
      filteredMovements = filteredMovements.filter((mov) => mov.fecha <= dateTo)
    }
    
    return filteredMovements.reduce((sum, mov) => sum + mov.importe, 0)
  }

  const handleDateRangeChange = (newDateFrom?: string, newDateTo?: string) => {
    setDateFrom(newDateFrom)
    setDateTo(newDateTo)
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
    window.location.href = `/transacciones?categoria=${category.id}`
  }

  const handleDeleteRequest = (category: Categoria) => {
    setDeletingCategory(category)
  }

  const handleConfirmDelete = async () => {
    if (!deletingCategory) return

    try {
      await DatabaseService.deleteCategoria(deletingCategory.id)
      await fetchCategorias()
    } catch (error) {
      console.error("Error deleting category:", error)
      alert("Error al eliminar la categoría")
    } finally {
      setDeletingCategory(null)
    }
  }

  const handleSaveCategory = async (patch: Partial<Categoria>) => {
    try {
      if (editingCategory) {
        await updateCategoria(editingCategory.id, patch)
      } else if (organizacionId) {
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
        await fetchCategorias()
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

  const filteredCategories = categories.filter((category) =>
    category.nombre.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const sortedCategories = [...filteredCategories].sort((a, b) => a.orden - b.orden)

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold">Categorías</h2>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            {categories.length} categorías • Arrastra para reordenar
          </p>
        </div>
        <Button onClick={handleCreate} size="default" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Añadir categoría
        </Button>
      </div>

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 sm:flex-1">
          <DateRangeFilter
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateRangeChange={handleDateRangeChange}
          />
        </div>
        
        <div className="w-auto sm:flex-1">
          <div className="sm:hidden">
            {searchOpen ? (
              <div className="relative flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar categorías..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 h-12"
                    autoFocus
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-12 w-12 flex-shrink-0"
                  onClick={() => {
                    setSearchOpen(false)
                    setSearchTerm("")
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant="outline"
                size="icon"
                className="h-12 w-12"
                onClick={() => setSearchOpen(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
          </div>

          <div className="hidden sm:block relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Filtrar por nombre de la categoría..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 h-12"
            />
          </div>
        </div>
      </div>

      {sortedCategories.length === 0 ? (
        <div className="flex items-center justify-center py-8 sm:py-12">
          <div className="text-center px-4">
            <p className="text-muted-foreground mb-4 text-sm sm:text-base">
              {searchTerm ? "No se encontraron categorías que coincidan con tu búsqueda" : "No hay categorías creadas"}
            </p>
            {!searchTerm && (
              <Button onClick={handleCreate} className="w-full sm:w-auto">
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
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-3 sm:space-y-4">
                {sortedCategories.map((category, index) => (
                  <CategoryCard
                    key={category.id}
                    category={category}
                    index={index}
                    balance={getCategoryBalance(category.id)}
                    onEdit={handleEdit}
                    onSearch={handleSearch}
                    onDelete={handleDeleteRequest}
                  />
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Sheets and Dialogs */}
      {deletingCategory && (
        <DeleteCategoryDialog
          categoria={deletingCategory}
          onConfirm={handleConfirmDelete}
          onCancel={() => setDeletingCategory(null)}
        />
      )}

      <Sheet open={editSheetOpen} onOpenChange={setEditSheetOpen}>
        <SheetContent className="w-full sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
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

      <Sheet open={createSheetOpen} onOpenChange={setCreateSheetOpen}>
        <SheetContent className="w-full sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
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