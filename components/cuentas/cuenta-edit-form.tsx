"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Building2, PiggyBank, User, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent } from "@/components/ui/card"
import { ColorPicker } from "@/components/ui/color-picker"
import type { Cuenta } from "@/lib/types/database"

interface CuentaEditFormProps {
  cuenta: Cuenta
  onSave: (patch: Partial<Cuenta>) => Promise<void>
  onCancel: () => void
}

// Colores predefinidos para cuentas
const DEFAULT_COLORS = [
  "#4ECDC4",
  "#FF6B6B",
  "#45B7D1",
  "#96CEB4",
  "#DDA0DD",
  "#98D8C8",
  "#F7DC6F",
  "#BB8FCE",
  "#85C1E9",
  "#F8C471",
  "#82E0AA",
  "#F1948A",
  "#D7BDE2",
  "#FAD7A0",
  "#A9DFBF",
]

export function CuentaEditForm({ cuenta, onSave, onCancel }: CuentaEditFormProps) {
  const [formData, setFormData] = useState({
    nombre: cuenta.nombre || "",
    tipo: cuenta.tipo || "banco",
    origen: cuenta.origen || "manual",
    banco_nombre: cuenta.banco_nombre || "",
    iban: cuenta.iban || "",
    color: cuenta.color || "#4ECDC4",
    personas_autorizadas: cuenta.personas_autorizadas || "",
    descripcion: cuenta.descripcion || "",
  })
  const [loading, setLoading] = useState(false)
  const [personasList, setPersonasList] = useState<string[]>(
    cuenta.personas_autorizadas ? cuenta.personas_autorizadas.split(",").map((p) => p.trim()) : [],
  )

  // Actualizar personas_autorizadas cuando cambie personasList
  useEffect(() => {
    setFormData((prev) => ({
      ...prev,
      personas_autorizadas: personasList.join(", "),
    }))
  }, [personasList])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.nombre.trim()) {
      alert("El nombre de la cuenta es obligatorio")
      return
    }

    if (formData.tipo === "banco" && !formData.banco_nombre.trim()) {
      alert("El nombre del banco es obligatorio para cuentas bancarias")
      return
    }

    if (formData.tipo === "banco" && !formData.iban.trim()) {
      alert("El IBAN es obligatorio para cuentas bancarias")
      return
    }

    setLoading(true)

    try {
      await onSave({
        nombre: formData.nombre.trim(),
        tipo: formData.tipo as "banco" | "caja",
        origen: formData.origen as "manual" | "conectada",
        banco_nombre: formData.tipo === "banco" ? formData.banco_nombre.trim() : null,
        iban: formData.tipo === "banco" ? formData.iban.trim() : null,
        color: formData.color,
        personas_autorizadas: formData.personas_autorizadas,
        descripcion: formData.descripcion.trim() || null,
      })
    } catch (error) {
      console.error("Error saving account:", error)
      alert("Error al guardar la cuenta: " + error)
    } finally {
      setLoading(false)
    }
  }

  const addPersona = (nombre: string) => {
    if (nombre.trim() && !personasList.includes(nombre.trim())) {
      setPersonasList([...personasList, nombre.trim()])
    }
  }

  const removePersona = (index: number) => {
    setPersonasList(personasList.filter((_, i) => i !== index))
  }

  const handlePersonaKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault()
      const target = e.target as HTMLInputElement
      addPersona(target.value)
      target.value = ""
    }
  }

  const getAccountIcon = () => {
    if (formData.tipo === "caja") {
      return <PiggyBank className="h-8 w-8 text-white" />
    }
    return <Building2 className="h-8 w-8 text-white" />
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pt-6">
      {/* Account Icon and Color Preview */}
      <div className="flex justify-center">
        <Card className="relative">
          <CardContent className="p-6">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-full text-2xl shadow-lg"
              style={{ backgroundColor: formData.color }}
            >
              {getAccountIcon()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Color Picker */}
      <div className="space-y-2">
        <Label>Color de la cuenta</Label>
        <ColorPicker
          value={formData.color}
          onChange={(color) => setFormData({ ...formData, color })}
          className="w-full"
        />
      </div>

      {/* Account Name */}
      <div className="space-y-2">
        <Label htmlFor="nombre">Nombre de la cuenta *</Label>
        <Input
          id="nombre"
          value={formData.nombre}
          onChange={(e) => setFormData({ ...formData, nombre: e.target.value })}
          placeholder="Nombre de la cuenta"
          required
          className="font-semibold"
        />
      </div>

      {/* Account Type */}
      <div className="space-y-2">
        <Label>Tipo de cuenta *</Label>
        <Select
          value={formData.tipo}
          onValueChange={(value) => setFormData({ ...formData, tipo: value as "banco" | "caja" })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="banco">Banco</SelectItem>
            <SelectItem value="caja">Caja</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Bank Name - Only for bank accounts */}
      {formData.tipo === "banco" && (
        <div className="space-y-2">
          <Label htmlFor="banco_nombre">Nombre del banco *</Label>
          <Input
            id="banco_nombre"
            value={formData.banco_nombre}
            onChange={(e) => setFormData({ ...formData, banco_nombre: e.target.value })}
            placeholder="Nombre del banco"
            required
          />
        </div>
      )}

      {/* IBAN - Only for bank accounts */}
      {formData.tipo === "banco" && (
        <div className="space-y-2">
          <Label htmlFor="iban">IBAN *</Label>
          <Input
            id="iban"
            value={formData.iban}
            onChange={(e) => setFormData({ ...formData, iban: e.target.value })}
            placeholder="ES91 2100 0418 4502 0005 1332"
            required
          />
        </div>
      )}

      {/* Connection Type - Only for bank accounts */}
      {formData.tipo === "banco" && (
        <div className="space-y-2">
          <Label>Tipo de conexión</Label>
          <Select
            value={formData.origen}
            onValueChange={(value) => setFormData({ ...formData, origen: value as "manual" | "conectada" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="conectada" disabled>
                Conectada (Próximamente)
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-gray-500">
            Por ahora solo se permiten cuentas manuale, tú debes subir los movimientos importándolos del banco
          </p>
        </div>
      )}

      {/* Authorized Persons */}
      <div className="space-y-2">
        <Label htmlFor="personas">
          {formData.tipo === "caja" ? "Personas con acceso a la caja" : "Personas autorizadas"}
        </Label>
        <div className="space-y-3">
          <Input
            id="personas"
            placeholder="Escribe y añade con enter"
            onKeyPress={handlePersonaKeyPress}
            className="mb-2"
          />

          {personasList.length > 0 && (
            <div className="space-y-2">
              <Label className="text-sm text-gray-600">Personas autorizadas:</Label>
              <div className="flex flex-wrap gap-2">
                {personasList.map((persona, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                  >
                    <User className="h-3 w-3" />
                    <span>{persona}</span>
                    <button
                      type="button"
                      onClick={() => removePersona(index)}
                      className="hover:bg-blue-200 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="descripcion">Descripción</Label>
        <Textarea
          id="descripcion"
          value={formData.descripcion}
          onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
          placeholder="Información, accesos o detalles que quieras guardar sobre esta cuenta (opcional)"
          rows={3}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Guardando..." : cuenta.id ? "Actualizar" : "Crear"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1 bg-transparent">
          Cancelar
        </Button>
      </div>
    </form>
  )
}
