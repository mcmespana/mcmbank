"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import { Edit } from "lucide-react"
import type { Categoria } from "@/lib/types"

interface CategoryEditFormProps {
  category: Categoria
  onSave: (patch: Partial<Categoria>) => Promise<void>
  onCancel: () => void
}

const colorOptions = [
  { value: "red", class: "bg-red-500" },
  { value: "green", class: "bg-green-500" },
  { value: "yellow", class: "bg-yellow-500" },
  { value: "blue", class: "bg-blue-500" },
  { value: "purple", class: "bg-purple-500" },
  { value: "teal", class: "bg-teal-500" },
  { value: "indigo", class: "bg-indigo-500" },
  { value: "orange", class: "bg-orange-500" },
  { value: "lime", class: "bg-lime-500" },
  { value: "cyan", class: "bg-cyan-500" },
  { value: "amber", class: "bg-amber-500" },
  { value: "gray", class: "bg-gray-500" },
  { value: "navy", class: "bg-blue-900" },
  { value: "maroon", class: "bg-red-900" },
  { value: "olive", class: "bg-yellow-700" },
  { value: "brown", class: "bg-amber-800" },
  { value: "pink", class: "bg-pink-500" },
  { value: "slate", class: "bg-slate-600" },
]

export function CategoryEditForm({ category, onSave, onCancel }: CategoryEditFormProps) {
  const [formData, setFormData] = useState({
    nombre: category.nombre,
    emoji: category.emoji,
    tipo: category.tipo,
    color: "blue", // Default color since we don't have this in the data model yet
  })
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      await onSave({
        nombre: formData.nombre,
        emoji: formData.emoji,
        tipo: formData.tipo as "ingreso" | "gasto",
      })
    } catch (error) {
      console.error("Error saving category:", error)
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
            <div className="flex h-16 w-16 items-center justify-center rounded-lg bg-blue-100 text-2xl">
              {formData.emoji}
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute -top-2 -right-2 h-8 w-8 rounded-full bg-background shadow-md"
            >
              <Edit className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Color Picker */}
      <div className="space-y-3">
        <Label>Color</Label>
        <div className="grid grid-cols-6 gap-2">
          {colorOptions.map((color) => (
            <button
              key={color.value}
              type="button"
              onClick={() => setFormData({ ...formData, color: color.value })}
              className={`h-8 w-8 rounded-full ${color.class} ${
                formData.color === color.value ? "ring-2 ring-offset-2 ring-blue-500" : ""
              }`}
            />
          ))}
        </div>
      </div>

      {/* Category Name */}
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre</Label>
        <Input
          id="nombre"
          value={formData.nombre}
          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
          placeholder="Nombre de la categoría"
        />
      </div>

      {/* Category Type */}
      <div className="space-y-2">
        <Label>Tipo</Label>
        <Select
          value={formData.tipo}
          onValueChange={(value) => setFormData({ ...formData, tipo: value as "ingreso" | "gasto" })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ingreso">Ingreso</SelectItem>
            <SelectItem value="gasto">Gasto</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Guardando..." : "Guardar"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 bg-transparent">
          Cancelar
        </Button>
      </div>
    </form>
  )
}
