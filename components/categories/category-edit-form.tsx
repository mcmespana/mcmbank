"use client"

import type React from "react"
import { useState } from "react"
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
  onSave: (patch: Partial<Categoria>) => Promise<void>
  onCancel: () => void
}

// Colores predefinidos para categorías
const DEFAULT_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
  "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9",
  "#F8C471", "#82E0AA", "#F1948A", "#D7BDE2", "#FAD7A0",
  "#A9DFBF", "#F9E79F", "#D5A6BD", "#A3E4D7", "#FFB6C1"
]

export function CategoryEditForm({ category, onSave, onCancel }: CategoryEditFormProps) {
  const [formData, setFormData] = useState({
    nombre: category.nombre,
    emoji: category.emoji || "📁",
    tipo: category.tipo,
    color: category.color || "#4ECDC4",
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.nombre.trim()) {
      alert("El nombre de la categoría es obligatorio")
      return
    }

    setLoading(true)

    try {
      await onSave({
        nombre: formData.nombre.trim(),
        emoji: formData.emoji,
        tipo: formData.tipo,
        color: formData.color,
      })
    } catch (error) {
      console.error("Error saving category:", error)
      alert("Error al guardar la categoría")
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
            className="w-full justify-start"
          />
        </div>
        
        <div className="space-y-2">
          <Label>Color</Label>
          <ColorPicker
            value={formData.color}
            onChange={(color) => setFormData({ ...formData, color })}
            className="w-full"
          />
        </div>
      </div>

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

      {/* Category Type */}
      <div className="space-y-2">
        <Label>Tipo *</Label>
        <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ingreso">Ingreso</SelectItem>
            <SelectItem value="gasto">Gasto</SelectItem>
            <SelectItem value="mixto">Mixto</SelectItem>
          </SelectContent>
        </Select>
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
