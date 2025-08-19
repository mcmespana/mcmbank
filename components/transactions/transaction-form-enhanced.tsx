"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { SideSheet } from "@/components/ui/side-sheet"
import { CategorySearch } from "@/components/categories/category-search"
import { CalendarIcon, Euro, Upload, FileText, File } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import { cn } from "@/lib/utils"
import type { MovimientoConRelaciones, Categoria, Cuenta } from "@/lib/types/database"

interface TransactionFormEnhancedProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  movement?: MovimientoConRelaciones | null
  accounts: Cuenta[]
  categories: Categoria[]
  onSave: (data: Partial<MovimientoConRelaciones>) => Promise<void>
  mode: "create" | "edit"
}

export function TransactionFormEnhanced({ 
  open, 
  onOpenChange, 
  movement, 
  accounts, 
  categories, 
  onSave, 
  mode 
}: TransactionFormEnhancedProps) {
  const [activeTab, setActiveTab] = useState<"data" | "files">("data")
  const [formData, setFormData] = useState({
    concepto: movement?.concepto || "",
    importe: movement?.importe || 0,
    fecha: movement?.fecha ? new Date(movement.fecha) : new Date(),
    categoria_id: movement?.categoria_id || "",
    cuenta_id: movement?.cuenta_id || "",
    descripcion: movement?.descripcion || "",
    tipo: "gasto",
  })
  const [loading, setLoading] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const [amount, setAmount] = useState(
    movement?.importe ? Math.abs(movement.importe).toFixed(2) : ""
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.concepto.trim() || !formData.cuenta_id) {
      alert("Por favor completa todos los campos obligatorios")
      return
    }

    setLoading(true)

    try {
      const finalAmount = formData.tipo === "gasto" ? -Math.abs(parseFloat(amount)) : Math.abs(parseFloat(amount))
      
      await onSave({
        concepto: formData.concepto.trim(),
        importe: finalAmount,
        fecha: format(formData.fecha, "yyyy-MM-dd"),
        categoria_id: formData.categoria_id || null,
        cuenta_id: formData.cuenta_id,
        descripcion: formData.descripcion.trim() || null,
      })
      
      onOpenChange(false)
    } catch (error) {
      console.error("Error saving transaction:", error)
      alert("Error al guardar la transacción")
    } finally {
      setLoading(false)
    }
  }

  const handleAmountChange = (value: string) => {
    // Allow only numbers and decimal point
    const cleaned = value.replace(/[^0-9.]/g, "")
    const parts = cleaned.split(".")
    if (parts.length > 2) return // Prevent multiple decimal points
    
    setAmount(cleaned)
    setFormData({ ...formData, importe: parseFloat(cleaned) || 0 })
  }

  const formatCurrency = (value: string) => {
    if (!value) return ""
    const num = parseFloat(value)
    if (isNaN(num)) return ""
    return new Intl.NumberFormat('es-ES', {
      style: 'currency',
      currency: 'EUR',
      minimumFractionDigits: 2,
    }).format(num)
  }

  return (
    <SideSheet
      open={open}
      onOpenChange={onOpenChange}
      title={mode === "create" ? "Nueva transacción" : "Editar transacción"}
    >
      <div className="space-y-6">
        {/* Tab Navigation */}
        <div className="flex border-b">
          <button
            onClick={() => setActiveTab("data")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "data" 
                ? "border-primary text-primary" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Datos
          </button>
          <button
            onClick={() => setActiveTab("files")}
            className={cn(
              "px-4 py-2 text-sm font-medium border-b-2 transition-colors",
              activeTab === "files" 
                ? "border-primary text-primary" 
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Archivos
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "data" ? (
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Transaction Type */}
            <div className="space-y-2">
              <Label>Tipo de transacción *</Label>
              <Select value={formData.tipo} onValueChange={(value) => setFormData({ ...formData, tipo: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ingreso">
                    <span className="text-green-600">💰 Ingreso</span>
                  </SelectItem>
                  <SelectItem value="gasto">
                    <span className="text-red-600">💸 Gasto</span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="concepto">Título *</Label>
              <Input
                id="concepto"
                value={formData.concepto}
                onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
                placeholder="Título de la transacción"
                required
              />
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="importe">Cantidad *</Label>
              <div className="relative">
                <Euro className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="importe"
                  type="text"
                  value={amount}
                  onChange={(e) => handleAmountChange(e.target.value)}
                  placeholder="0,00"
                  className="pl-10"
                  required
                />
              </div>
              {amount && (
                <p className="text-sm text-muted-foreground">
                  {formatCurrency(amount)}
                </p>
              )}
            </div>

            {/* Date */}
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
                    locale={es}
                    weekStartsOn={1}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
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
                        <span>{cuenta.nombre}</span>
                        {cuenta.banco_nombre && (
                          <span className="text-xs text-muted-foreground">({cuenta.banco_nombre})</span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <Label>Categoría</Label>
              <CategorySearch
                categories={categories}
                selectedCategories={formData.categoria_id ? [formData.categoria_id] : []}
                onSelectionChange={(categoryIds) => 
                  setFormData({ ...formData, categoria_id: categoryIds[0] || "" })
                }
                allowMultiple={false}
                placeholder="Seleccionar categoría"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="descripcion">Descripción</Label>
              <Textarea
                id="descripcion"
                value={formData.descripcion}
                onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                placeholder="Descripción adicional (opcional)"
                rows={3}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? "Guardando..." : mode === "create" ? "Crear" : "Actualizar"}
              </Button>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                Cancelar
              </Button>
            </div>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Invoice Upload */}
            <div className="space-y-3">
              <Label className="text-base font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Factura
              </Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Suelta aquí la factura para añadirla...
                  </p>
                  <Button variant="outline" size="sm" className="mt-3">
                    Seleccionar archivo
                  </Button>
                </div>
              </div>
            </div>

            {/* Other Files Upload */}
            <div className="space-y-3">
              <Label className="text-base font-medium flex items-center gap-2">
                <File className="h-4 w-4" />
                Otros archivos
              </Label>
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6">
                <div className="text-center">
                  <Upload className="mx-auto h-8 w-8 text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">
                    Suelta aquí el archivo para añadirlo...
                  </p>
                  <Button variant="outline" size="sm" className="mt-3">
                    Seleccionar archivo
                  </Button>
                </div>
              </div>
            </div>

            <div className="text-sm text-muted-foreground">
              <p>La funcionalidad de subida de archivos se implementará próximamente.</p>
            </div>
          </div>
        )}
      </div>
    </SideSheet>
  )
}
