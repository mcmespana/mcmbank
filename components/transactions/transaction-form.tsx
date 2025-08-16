"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { CalendarIcon, DollarSign, Tag, Building2, Calendar } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import type { MovimientoConRelaciones, Categoria, Cuenta } from "@/lib/types/database"

interface TransactionFormProps {
  movement?: MovimientoConRelaciones | null
  accounts: Cuenta[]
  categories: Categoria[]
  onSave: (data: Partial<MovimientoConRelaciones>) => Promise<void>
  onCancel: () => void
  mode: "create" | "edit"
}

export function TransactionForm({ movement, accounts, categories, onSave, onCancel, mode }: TransactionFormProps) {
  const [formData, setFormData] = useState({
    concepto: movement?.concepto || "",
    importe: movement?.importe || 0,
    fecha: movement?.fecha ? new Date(movement.fecha) : new Date(),
    categoria_id: movement?.categoria_id || "",
    cuenta_id: movement?.cuenta_id || "",
    notas: movement?.notas || "",
    tipo: (movement && "tipo" in movement ? (movement as any).tipo : undefined) || "gasto",
  })
  const [loading, setLoading] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.concepto.trim() || !formData.cuenta_id || !formData.categoria_id) {
      alert("Por favor completa todos los campos obligatorios")
      return
    }

    setLoading(true)

    try {
      await onSave({
        concepto: formData.concepto.trim(),
        importe: formData.importe,
        fecha: format(formData.fecha, "yyyy-MM-dd"),
        categoria_id: formData.categoria_id,
        cuenta_id: formData.cuenta_id,
        notas: formData.notas.trim(),
      })
    } catch (error) {
      console.error("Error saving transaction:", error)
      alert("Error al guardar la transacción")
    } finally {
      setLoading(false)
    }
  }

  const filteredCategories = categories.filter(cat => 
    cat.tipo === formData.tipo || cat.tipo === "mixto"
  )

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {mode === "create" ? "Nueva Transacción" : "Editar Transacción"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Transaction Type */}
          <div className="space-y-2">
            <Label>Tipo de transacción *</Label>
            <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ingreso">Ingreso</SelectItem>
                <SelectItem value="gasto">Gasto</SelectItem>
                <SelectItem value="transferencia">Transferencia</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Concept and Amount */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="concepto">Concepto *</Label>
              <Input
                id="concepto"
                value={formData.concepto}
                onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
                placeholder="Descripción de la transacción"
                required
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="importe">Importe *</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="importe"
                  type="number"
                  step="0.01"
                  value={formData.importe}
                  onChange={(e) => setFormData({ ...formData, importe: parseFloat(e.target.value) || 0 })}
                  placeholder="0.00"
                  className="pl-10"
                  required
                />
              </div>
            </div>
          </div>

          {/* Date and Category */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Fecha *</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.fecha && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.fecha ? format(formData.fecha, "PPP", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={formData.fecha}
                    onSelect={(date) => {
                      if (date) {
                        setFormData({ ...formData, fecha: date })
                        setDateOpen(false)
                      }
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label>Categoría *</Label>
              <Select value={formData.categoria_id} onValueChange={(value) => setFormData({ ...formData, categoria_id: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría" />
                </SelectTrigger>
                <SelectContent>
                  {filteredCategories.map((categoria) => (
                    <SelectItem key={categoria.id} value={categoria.id}>
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{categoria.emoji}</span>
                        <span>{categoria.nombre}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Account */}
          <div className="space-y-2">
            <Label>Cuenta *</Label>
            <Select value={formData.cuenta_id} onValueChange={(value) => setFormData({ ...formData, cuenta_id: value })}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar cuenta" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((cuenta) => (
                  <SelectItem key={cuenta.id} value={cuenta.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      <span>{cuenta.nombre}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notas">Notas</Label>
            <Textarea
              id="notas"
              value={formData.notas}
              onChange={(e) => setFormData({ ...formData, notas: e.target.value })}
              placeholder="Notas adicionales (opcional)"
              rows={3}
            />
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? "Guardando..." : mode === "create" ? "Crear" : "Actualizar"}
            </Button>
            <Button type="button" variant="outline" onClick={onCancel} className="flex-1">
              Cancelar
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}