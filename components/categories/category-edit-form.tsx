"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Edit } from "lucide-react"
import type { Categoria } from "@/lib/types/database"

interface CategoryEditFormProps {
  category: Categoria
  onSave: (patch: Partial<Categoria>) => Promise<void>
  onCancel: () => void
}

const emojiOptions = [
  "📁",
  "💰",
  "🏠",
  "🚗",
  "🍔",
  "🛒",
  "💊",
  "🎓",
  "🎮",
  "👕",
  "⚡",
  "📱",
  "🎬",
  "🏋️",
  "✈️",
  "🎨",
  "📚",
  "🍕",
  "☕",
  "🎵",
  "💳",
  "🏦",
  "📊",
  "💼",
  "🔧",
  "🎯",
  "🌟",
  "🎁",
  "🏆",
  "💡",
]

export function CategoryEditForm({ category, onSave, onCancel }: CategoryEditFormProps) {
  const [formData, setFormData] = useState({
    nombre: category.nombre,
    emoji: category.emoji || "📁",
    tipo: category.tipo,
  })
  const [loading, setLoading] = useState(false)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)

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
      {/* Category Icon Preview */}
      <div className="flex justify-center">
        <Card className="relative">
          <CardContent className="p-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-muted text-2xl">
              {formData.emoji}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-background shadow-md"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            >
              <Edit className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Emoji Picker */}
      {showEmojiPicker && (
        <div className="space-y-3">
          <Label>Seleccionar emoji</Label>
          <div className="grid grid-cols-6 gap-2 p-4 border rounded-lg bg-muted/50">
            {emojiOptions.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setFormData({ ...formData, emoji })
                  setShowEmojiPicker(false)
                }}
                className={`h-10 w-10 rounded-lg text-xl hover:bg-background transition-colors ${
                  formData.emoji === emoji ? "bg-background ring-2 ring-primary" : ""
                }`}
              >
                {emoji}
              </button>
            ))}
          </div>
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
