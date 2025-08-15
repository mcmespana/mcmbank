"use client"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Badge } from "@/components/ui/badge"
import { formatCurrency } from "@/lib/utils/format"
import { getAccountDisplayName, getAccountIcon } from "@/lib/utils/movement-utils"
import type { Movimiento, Cuenta, Categoria } from "@/lib/types/database"

interface TransactionDetailProps {
  movement: Movimiento | null
  accounts: Cuenta[]
  categories: Categoria[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (movementId: string, patch: Partial<Movimiento>) => Promise<void>
}

export function TransactionDetail({
  movement,
  accounts,
  categories,
  open,
  onOpenChange,
  onUpdate,
}: TransactionDetailProps) {
  const [formData, setFormData] = useState<Partial<Movimiento>>({})
  const [dateOpen, setDateOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (movement) {
      setFormData({
        fecha: movement.fecha,
        concepto: movement.concepto,
        descripcion: movement.descripcion || "",
        categoria_id: movement.categoria_id,
      })
    }
  }, [movement])

  if (!movement) return null

  const account = accounts.find((acc) => acc.id === movement.cuenta_id)
  const category = categories.find((cat) => cat.id === movement.categoria_id)

  const handleSave = async () => {
    setSaving(true)
    try {
      await onUpdate(movement.id, formData)
      onOpenChange(false)
    } catch (error) {
      console.error("Error saving movement:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      fecha: movement.fecha,
      concepto: movement.concepto,
      descripcion: movement.descripcion || "",
      categoria_id: movement.categoria_id,
    })
    onOpenChange(false)
  }

  const hasChanges =
    JSON.stringify(formData) !==
    JSON.stringify({
      fecha: movement.fecha,
      concepto: movement.concepto,
      descripcion: movement.descripcion || "",
      categoria_id: movement.categoria_id,
    })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-[400px] sm:w-[540px]">
        <SheetHeader>
          <SheetTitle>Detalle de transacción</SheetTitle>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Account and Amount (Read-only) */}
          <div className="space-y-4 rounded-lg border p-4 bg-muted/20">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium">Cuenta</p>
                {account && (
                  <Badge variant="secondary" className="gap-1">
                    <span>{getAccountIcon(account)}</span>
                    <span>{getAccountDisplayName(account)}</span>
                  </Badge>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm font-medium">Importe</p>
                <p className={`text-lg font-bold ${movement.importe > 0 ? "text-green-600" : "text-red-600"}`}>
                  {formatCurrency(movement.importe)}
                </p>
              </div>
            </div>

            {movement.contraparte && (
              <div>
                <p className="text-sm font-medium">Contraparte</p>
                <p className="text-sm text-muted-foreground">{movement.contraparte}</p>
              </div>
            )}

            {movement.metodo && (
              <div>
                <p className="text-sm font-medium">Método</p>
                <p className="text-sm text-muted-foreground">{movement.metodo}</p>
              </div>
            )}
          </div>

          {/* Editable Fields */}
          <div className="space-y-4">
            {/* Date */}
            <div className="space-y-2">
              <Label htmlFor="fecha">Fecha</Label>
              <Popover open={dateOpen} onOpenChange={setDateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !formData.fecha && "text-muted-foreground",
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {formData.fecha ? format(new Date(formData.fecha), "dd/MM/yyyy") : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={formData.fecha ? new Date(formData.fecha) : undefined}
                    onSelect={(date) => {
                      setFormData((prev) => ({ ...prev, fecha: date ? format(date, "yyyy-MM-dd") : undefined }))
                      setDateOpen(false)
                    }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Concept */}
            <div className="space-y-2">
              <Label htmlFor="concepto">Concepto</Label>
              <Input
                id="concepto"
                value={formData.concepto || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, concepto: e.target.value }))}
                placeholder="Concepto de la transacción"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion || ""}
                onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
                placeholder="Descripción adicional (opcional)"
                rows={3}
              />
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label htmlFor="categoria">Categoría</Label>
              <Select
                value={formData.categoria_id || "none"}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, categoria_id: value === "none" ? null : value }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin categoría">
                    {category && (
                      <div className="flex items-center gap-2">
                        {category.emoji && <span>{category.emoji}</span>}
                        <span>{category.nombre}</span>
                      </div>
                    )}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin categoría</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-2">
                        {cat.emoji && <span>{cat.emoji}</span>}
                        <span>{cat.nombre}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button onClick={handleSave} disabled={!hasChanges || saving} className="flex-1">
              {saving ? "Guardando..." : "Guardar"}
            </Button>
            <Button variant="outline" onClick={handleCancel} className="flex-1 bg-transparent">
              Cancelar
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
