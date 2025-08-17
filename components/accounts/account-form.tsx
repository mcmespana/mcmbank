"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ColorPicker } from "@/components/ui/color-picker"
import { Badge } from "@/components/ui/badge"
import { X, Plus, User } from "lucide-react"
import { useDelegationContext } from "@/contexts/delegation-context"
import { DatabaseService } from "@/lib/services/database"
import type { CuentaConDelegacion } from "@/lib/types/database"
import type { TipoCuenta, OrigenCuenta } from "@/lib/types"

interface AccountFormProps {
  account?: CuentaConDelegacion
  onSuccess: () => void
  onCancel: () => void
}

interface FormData {
  nombre: string
  tipo: TipoCuenta
  origen: OrigenCuenta
  banco_nombre: string
  iban: string
  color: string
  descripcion: string
  personas_autorizadas: string[]
}

const defaultColors = [
  "#ec0000", // Santander red
  "#004cdb", // BBVA blue
  "#0066b3", // CaixaBank blue
  "#10b981", // Cash green
  "#f37021", // Bankinter orange
  "#ff6200", // ING orange
  "#6b7280", // Default gray
  "#8b5cf6", // Purple
  "#ef4444", // Red
  "#3b82f6"  // Blue
]

export function AccountForm({ account, onSuccess, onCancel }: AccountFormProps) {
  const { selectedDelegation } = useDelegationContext()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newPersonName, setNewPersonName] = useState("")
  
  const [formData, setFormData] = useState<FormData>({
    nombre: account?.nombre || "",
    tipo: (account?.tipo as TipoCuenta) || "banco",
    origen: (account?.origen as OrigenCuenta) || "manual",
    banco_nombre: account?.banco_nombre || "",
    iban: account?.iban || "",
    color: account?.color || defaultColors[0],
    descripcion: account?.descripcion || "",
    personas_autorizadas: account?.personas_autorizadas 
      ? account.personas_autorizadas.split(',').map(p => p.trim()).filter(p => p)
      : []
  })

  const isEditing = !!account

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedDelegation) {
      setError("No hay delegación seleccionada")
      return
    }

    // Validation
    if (!formData.nombre.trim()) {
      setError("El nombre de la cuenta es obligatorio")
      return
    }

    if (formData.tipo === "banco" && !formData.banco_nombre.trim()) {
      setError("El nombre del banco es obligatorio para cuentas bancarias")
      return
    }

    if (formData.tipo === "banco" && formData.iban && !isValidIban(formData.iban)) {
      setError("El IBAN no tiene un formato válido")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const accountData = {
        delegacion_id: selectedDelegation,
        nombre: formData.nombre.trim(),
        tipo: formData.tipo,
        origen: formData.origen,
        banco_nombre: formData.tipo === "banco" ? formData.banco_nombre.trim() : null,
        iban: formData.tipo === "banco" && formData.iban ? formData.iban.toUpperCase().replace(/\s/g, '') : null,
        color: formData.color,
        descripcion: formData.descripcion.trim() || null,
        personas_autorizadas: formData.personas_autorizadas.length > 0 
          ? formData.personas_autorizadas.join(', ') 
          : null,
      }

      if (isEditing) {
        await DatabaseService.updateAccount(account.id, accountData)
      } else {
        await DatabaseService.createAccount(accountData)
      }

      onSuccess()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar la cuenta")
    } finally {
      setLoading(false)
    }
  }

  const handleAddPerson = () => {
    if (newPersonName.trim() && !formData.personas_autorizadas.includes(newPersonName.trim())) {
      setFormData(prev => ({
        ...prev,
        personas_autorizadas: [...prev.personas_autorizadas, newPersonName.trim()]
      }))
      setNewPersonName("")
    }
  }

  const handleRemovePerson = (personToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      personas_autorizadas: prev.personas_autorizadas.filter(person => person !== personToRemove)
    }))
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddPerson()
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Account Name */}
      <div className="space-y-2">
        <Label htmlFor="nombre" className="text-base font-semibold">
          Nombre de la cuenta *
        </Label>
        <Input
          id="nombre"
          value={formData.nombre}
          onChange={(e) => setFormData(prev => ({ ...prev, nombre: e.target.value }))}
          placeholder="Ej: Cuenta Principal"
          required
        />
      </div>

      {/* Color Picker */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">Color</Label>
        <ColorPicker
          value={formData.color}
          onChange={(color) => setFormData(prev => ({ ...prev, color }))}
        />
      </div>

      {/* Account Type */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">Tipo de cuenta</Label>
        <Select
          value={formData.tipo}
          onValueChange={(value: TipoCuenta) => {
            setFormData(prev => ({ 
              ...prev, 
              tipo: value,
              // Reset bank-specific fields when switching to cash
              ...(value === "caja" ? { banco_nombre: "", iban: "", origen: "manual" } : {})
            }))
          }}
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
          <Label htmlFor="banco_nombre" className="text-base font-semibold">
            Nombre del banco *
          </Label>
          <Input
            id="banco_nombre"
            value={formData.banco_nombre}
            onChange={(e) => setFormData(prev => ({ ...prev, banco_nombre: e.target.value }))}
            placeholder="Ej: Banco Santander"
            required={formData.tipo === "banco"}
          />
        </div>
      )}

      {/* IBAN - Only for bank accounts */}
      {formData.tipo === "banco" && (
        <div className="space-y-2">
          <Label htmlFor="iban" className="text-base font-semibold">
            IBAN
          </Label>
          <Input
            id="iban"
            value={formData.iban}
            onChange={(e) => setFormData(prev => ({ ...prev, iban: e.target.value }))}
            placeholder="ES91 2100 0418 4502 0005 1332"
          />
        </div>
      )}

      {/* Account Origin - Only for bank accounts */}
      {formData.tipo === "banco" && (
        <div className="space-y-2">
          <Label className="text-base font-semibold">La cuenta es...</Label>
          <Select
            value={formData.origen}
            onValueChange={(value: OrigenCuenta) => setFormData(prev => ({ ...prev, origen: value }))}
            disabled // Blocked as requested
          >
            <SelectTrigger className="opacity-50">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="manual">Manual</SelectItem>
              <SelectItem value="conectada">Conectada</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Por ahora solo se permiten cuentas manuales
          </p>
        </div>
      )}

      {/* Authorized Persons */}
      <div className="space-y-2">
        <Label className="text-base font-semibold">Personas autorizadas</Label>
        <div className="space-y-3">
          <div className="flex gap-2">
            <Input
              value={newPersonName}
              onChange={(e) => setNewPersonName(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Nombre de la persona"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={handleAddPerson}
              disabled={!newPersonName.trim()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          
          {formData.personas_autorizadas.length > 0 && (
            <div className="space-y-2">
              {formData.personas_autorizadas.map((person, index) => (
                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded-md">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm">{person}</span>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => handleRemovePerson(person)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="descripcion" className="text-base font-semibold">
          Descripción
        </Label>
        <Textarea
          id="descripcion"
          value={formData.descripcion}
          onChange={(e) => setFormData(prev => ({ ...prev, descripcion: e.target.value }))}
          placeholder="Descripción adicional de la cuenta..."
          rows={3}
        />
      </div>

      {/* Action Buttons */}
      <div className="flex gap-3 pt-4">
        <Button type="submit" disabled={loading} className="flex-1">
          {loading ? "Guardando..." : isEditing ? "Actualizar Cuenta" : "Crear Cuenta"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

// Basic IBAN validation
function isValidIban(iban: string): boolean {
  const cleanIban = iban.replace(/\s/g, '').toUpperCase()
  
  // Basic format check (starts with 2 letters, followed by 2 digits, then alphanumeric)
  const ibanRegex = /^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/
  
  if (!ibanRegex.test(cleanIban)) {
    return false
  }
  
  // Length check for Spanish IBANs
  if (cleanIban.startsWith('ES') && cleanIban.length !== 24) {
    return false
  }
  
  return true
}