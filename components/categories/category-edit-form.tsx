"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { EmojiPickerButton } from "@/components/ui/emoji-picker"
import { ColorPicker } from "@/components/ui/color-picker"
import type { Categoria } from "@/lib/types/database"

interface CategoryEditFormProps {
  category: Categoria
  parentCategory?: Categoria
  onSave: (patch: Partial<Categoria>) => Promise<void>
  onCancel: () => void
  canManageGlobal: boolean
}

type ScopeOption = "delegacion" | "global"

export function CategoryEditForm({ category, parentCategory, onSave, onCancel, canManageGlobal }: CategoryEditFormProps) {
  const initialScope = (parentCategory
    ? parentCategory.es_global
      ? "global"
      : "delegacion"
    : category.es_global
      ? "global"
      : "delegacion") as ScopeOption

  const [formData, setFormData] = useState({
    nombre: category.nombre,
    emoji: parentCategory?.emoji || category.emoji || "📁",
    color: parentCategory?.color || category.color || "#4ECDC4",
    scope: initialScope,
  })
  const [loading, setLoading] = useState(false)

  const canToggleGlobal = canManageGlobal && (!parentCategory || parentCategory.es_global)

  useEffect(() => {
    setFormData({
      nombre: category.nombre,
      emoji: parentCategory?.emoji || category.emoji || "📁",
      color: parentCategory?.color || category.color || "#4ECDC4",
      scope: (parentCategory
        ? parentCategory.es_global
          ? "global"
          : "delegacion"
        : category.es_global
          ? "global"
          : "delegacion") as ScopeOption,
    })
  }, [category, parentCategory])

  useEffect(() => {
    if (!canToggleGlobal) {
      setFormData((prev) => (prev.scope === "global" ? { ...prev, scope: "delegacion" } : prev))
    }
  }, [canToggleGlobal])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.nombre.trim()) {
      alert("El nombre de la categoría es obligatorio")
      return
    }

    setLoading(true)

    try {
      // Lógica de resolvedScope:
      // - Sin padre: usar la selección del usuario
      // - Con padre local: siempre local (heredar del padre)
      // - Con padre global y gestor central: permitir elegir
      // - Con padre global sin permisos: forzar a local
      const resolvedScope = parentCategory
        ? (parentCategory.es_global && canManageGlobal)
          ? formData.scope  // Gestor central puede elegir global o local
          : "delegacion"    // Tesoreros o subcategorías de locales siempre local
        : formData.scope    // Sin padre, usar la selección

      await onSave({
        nombre: formData.nombre.trim(),
        emoji: formData.emoji,
        ...(parentCategory
          ? { categoria_padre_id: parentCategory.id }
          : { color: formData.color }),
        es_global: resolvedScope === "global",
      })
    } catch (error) {
      console.error("Error saving category:", error)
      alert("Error al guardar la categoría" + error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-6">
      {/* Category Icon and Color Preview */}
      <div className="flex justify-center">
        <Card className="relative">
          <CardContent className="p-6">
            <div 
              className="flex h-16 w-16 items-center justify-center rounded-lg text-2xl"
              style={{ backgroundColor: formData.color }}
            >
              {formData.emoji}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Emoji and Color Pickers */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Emoji</Label>
          <EmojiPickerButton
            value={formData.emoji}
            onChange={(emoji) => setFormData({ ...formData, emoji })}
            className="w-full center"
          />
        </div>

        {!parentCategory ? (
          <div className="space-y-2">
            <Label>Color</Label>
            <ColorPicker
              value={formData.color}
              onChange={(color) => setFormData({ ...formData, color })}
              className="w-full"
            />
          </div>
        ) : (
          <div className="space-y-2">
            <Label>Color</Label>
            <div
              className="h-10 w-full rounded border"
              style={{ backgroundColor: parentCategory.color }}
            />
          </div>
        )}
      </div>

      {parentCategory && (
        <div className="space-y-2">
          <Label>Subcategoría de</Label>
          <Input
            value={`${parentCategory.emoji || ""} ${parentCategory.nombre}`}
            disabled
          />
        </div>
      )}

      {canManageGlobal && (
        <div className="space-y-2">
          <Label>Ámbito *</Label>
          <Select
            value={formData.scope}
            onValueChange={(value) =>
              setFormData((prev) => ({ ...prev, scope: value as ScopeOption }))
            }
            disabled={!canToggleGlobal}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="delegacion">Delegación actual</SelectItem>
              <SelectItem value="global">Global (todas las delegaciones)</SelectItem>
            </SelectContent>
          </Select>
          {!canToggleGlobal && parentCategory && !parentCategory.es_global && (
            <p className="text-xs text-muted-foreground">
              Las subcategorías de una categoría local deben ser también locales.
            </p>
          )}
          {canToggleGlobal && parentCategory && parentCategory.es_global && (
            <p className="text-xs text-muted-foreground">
              Puedes crear una subcategoría local (solo para la delegación seleccionada) o global (para todas).
            </p>
          )}
        </div>
      )}

      {/* Category Name */}
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre *</Label>
        <Input
          id="nombre"
          value={formData.nombre}
          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
          placeholder="Nombre de la categoría"
          required
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Guardando..." : category.id ? "Actualizar" : "Crear"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 bg-transparent">
          Cancelar
        </Button>
      </div>
    </form>
  )
}
