"use client"

import { useMemo } from "react"
import { toast } from "sonner"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { CategoryEditForm } from "@/components/categories/category-edit-form"
import { DatabaseService } from "@/lib/services/database"
import type { Categoria } from "@/lib/types/database"

interface CategoryQuickCreateSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizacionId?: string | null
  delegacionId?: string | null
  canManageGlobal: boolean
  categories: Categoria[]
  onCreated: (category: Categoria) => void | Promise<void>
}

export function CategoryQuickCreateSheet({
  open,
  onOpenChange,
  organizacionId,
  delegacionId,
  canManageGlobal,
  categories,
  onCreated,
}: CategoryQuickCreateSheetProps) {
  const draftCategory = useMemo<Categoria>(
    () => ({
      id: "",
      organizacion_id: organizacionId || "",
      delegacion_id: delegacionId || null,
      nombre: "",
      tipo: "mixto",
      emoji: "📁",
      color: "#4ECDC4",
      orden: 0,
      categoria_padre_id: null,
      creado_en: "",
      es_global: false,
      esta_activa: true,
      activa: true,
    }),
    [organizacionId, delegacionId],
  )

  const handleSave = async (patch: Partial<Categoria>) => {
    if (!organizacionId) {
      toast.error("No se ha podido determinar la organización")
      return
    }

    const targetIsGlobal = !!patch.es_global

    if (targetIsGlobal && !canManageGlobal) {
      toast.error("Solo el gestor central puede crear categorías globales")
      return
    }

    if (!targetIsGlobal && !delegacionId) {
      toast.error("Selecciona una delegación para crear categorías locales")
      return
    }

    const siblings = categories.filter(
      (category) => !category.categoria_padre_id && category.es_global === targetIsGlobal,
    )
    const maxOrder = siblings.length > 0 ? Math.max(...siblings.map((category) => category.orden)) : 0

    try {
      const created = await DatabaseService.createCategoria({
        organizacion_id: organizacionId,
        delegacion_id: targetIsGlobal ? null : delegacionId!,
        nombre: patch.nombre!,
        tipo: "mixto",
        emoji: patch.emoji || "📁",
        color: patch.color || "#4ECDC4",
        orden: maxOrder + 1,
        categoria_padre_id: null,
        es_global: targetIsGlobal,
        esta_activa: true,
        activa: true,
      })

      await onCreated(created)
    } catch (error) {
      console.error("Error creating category:", error)
      toast.error("Error al crear la categoría")
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:w-[400px] sm:max-w-[540px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Crear categoría</SheetTitle>
        </SheetHeader>
        <CategoryEditForm
          category={draftCategory}
          onSave={handleSave}
          onCancel={() => onOpenChange(false)}
          canManageGlobal={canManageGlobal}
        />
      </SheetContent>
    </Sheet>
  )
}
