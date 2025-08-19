"use client"

import type React from "react"

import { useState } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { CalendarIcon, Building2, Check, X, Save } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { CategorySelector } from "./category-selector"
import { BankAvatar } from "@/components/bank-avatar"
import { formatCurrency } from "@/lib/utils/format"
import type { Movimiento, Cuenta, Categoria } from "@/lib/types/database"

interface TransactionCreatePanelProps {
  accounts: Cuenta[]
  categories: Categoria[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreate: (data: Partial<Movimiento>) => Promise<void>
}

export function TransactionCreatePanel({
  accounts,
  categories,
  open,
  onOpenChange,
  onCreate,
}: TransactionCreatePanelProps) {
  const [formData, setFormData] = useState<Partial<Movimiento>>({
    concepto: "",
    importe: 0,
    fecha: format(new Date(), "yyyy-MM-dd"),
    descripcion: "",
    categoria_id: "",
    contraparte: "",
    cuenta_id: "",
  })
  const [dateOpen, setDateOpen] = useState(false)
  const [isCreating, setIsCreating] = useState(false)

  const isFormValid = 
    formData.concepto?.trim() && 
    formData.cuenta_id && 
    formData.importe !== 0 && 
    formData.importe !== undefined

  const selectedAccount = accounts.find((acc) => acc.id === formData.cuenta_id)
  const selectedCategory = categories.find((cat) => cat.id === formData.categoria_id)

  const handleCreate = async () => {
    if (!isFormValid) {
      alert("Por favor completa los campos obligatorios: concepto, cuenta e importe")
      return
    }

    setIsCreating(true)
    try {
      await onCreate({
        ...formData,
        concepto: formData.concepto?.trim(),
        descripcion: formData.descripcion?.trim() || "",
        contraparte: formData.contraparte?.trim() || "",
      })
      // Reset form
      setFormData({
        concepto: "",
        importe: 0,
        fecha: format(new Date(), "yyyy-MM-dd"),
        descripcion: "",
        categoria_id: "",
        contraparte: "",
        cuenta_id: "",
      })
      onOpenChange(false)
    } catch (error) {
      console.error("Error creating transaction:", error)
      alert("Error al crear la transacción. Por favor, inténtalo de nuevo.")
    } finally {
      setIsCreating(false)
    }
  }

  const handleCancel = () => {
    // Reset form
    setFormData({
      concepto: "",
      importe: 0,
      fecha: format(new Date(), "yyyy-MM-dd"),
      descripcion: "",
      categoria_id: "",
      contraparte: "",
      cuenta_id: "",
    })
    onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader className="space-y-3 pb-6 border-b">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Building2 className="h-5 w-5 text-primary" />
            Nueva Transacción
          </SheetTitle>
          <p className="text-sm text-muted-foreground">
            Completa los datos para crear una nueva transacción
          </p>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Amount Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-muted-foreground">IMPORTE *</Label>
              <div className={cn(
                "text-xs px-2 py-1 rounded-full",
                isFormValid ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
              )}>
                {isFormValid ? "✓ Válido" : "Obligatorio"}
              </div>
            </div>
            
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                value={formData.importe || ""}
                onChange={(e) => setFormData({ ...formData, importe: parseFloat(e.target.value) || 0 })}
                className={cn(
                  "text-2xl font-bold text-center py-6 border-2 transition-all",
                  formData.importe && formData.importe !== 0
                    ? "bg-primary/5 border-primary/20 focus:border-primary"
                    : "bg-muted/30 border-border focus:border-primary"
                )}
                placeholder="0,00"
              />
              <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                <span className="text-xl font-medium text-muted-foreground">€</span>
              </div>
            </div>
          </div>

          {/* Concept */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-muted-foreground">CONCEPTO *</Label>
              <div className={cn(
                "text-xs px-2 py-1 rounded-full",
                formData.concepto?.trim() ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
              )}>
                {formData.concepto?.trim() ? "✓" : "Obligatorio"}
              </div>
            </div>
            <Input
              value={formData.concepto || ""}
              onChange={(e) => setFormData({ ...formData, concepto: e.target.value })}
              placeholder="Descripción de la transacción"
              className={cn(
                "transition-all",
                formData.concepto?.trim()
                  ? "bg-primary/5 border-primary/20"
                  : "bg-muted/30"
              )}
            />
          </div>

          {/* Date */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-muted-foreground">FECHA</Label>
            <Popover open={dateOpen} onOpenChange={setDateOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal bg-muted/30",
                    !formData.fecha && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {formData.fecha ? format(new Date(formData.fecha), "dd 'de' MMMM 'de' yyyy", { locale: es }) : "Seleccionar fecha"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={formData.fecha ? new Date(formData.fecha) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setFormData({ ...formData, fecha: format(date, "yyyy-MM-dd") })
                      setDateOpen(false)
                    }
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Account Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium text-muted-foreground">CUENTA *</Label>
              <div className={cn(
                "text-xs px-2 py-1 rounded-full",
                formData.cuenta_id ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" : "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400"
              )}>
                {formData.cuenta_id ? "✓" : "Obligatorio"}
              </div>
            </div>
            <div className={cn(
              "rounded-lg p-3 transition-all",
              formData.cuenta_id
                ? "bg-primary/5 border border-primary/20"
                : "bg-muted/30"
            )}>
              {selectedAccount ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="rounded-full p-2"
                      style={{ backgroundColor: selectedAccount.color || "#4ECDC4" }}
                    >
                      <BankAvatar account={selectedAccount} />
                    </div>
                    <div>
                      <div className="font-medium">{selectedAccount.nombre}</div>
                      <div className="text-sm text-muted-foreground">
                        {selectedAccount.tipo} • {selectedAccount.banco_nombre || "Banco"}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, cuenta_id: "" })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <Select value={formData.cuenta_id || ""} onValueChange={(value) => setFormData({ ...formData, cuenta_id: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar cuenta" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        <div className="flex items-center gap-2">
                          <div
                            className="rounded-full p-1 w-6 h-6 flex items-center justify-center"
                            style={{ backgroundColor: account.color || "#4ECDC4" }}
                          >
                            <BankAvatar account={account} />
                          </div>
                          <div>
                            <div className="font-medium">{account.nombre}</div>
                            <div className="text-xs text-muted-foreground">{account.banco_nombre || "Banco"}</div>
                          </div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-muted-foreground">CATEGORÍA</Label>
            <div className="bg-muted/30 rounded-lg p-3">
              {selectedCategory ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{selectedCategory.emoji}</span>
                    <span className="font-medium">{selectedCategory.nombre}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFormData({ ...formData, categoria_id: "" })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <CategorySelector
                  categories={categories}
                  selectedCategories={formData.categoria_id ? [formData.categoria_id] : []}
                  onSelectionChange={(categoryIds) => {
                    setFormData({ ...formData, categoria_id: categoryIds[0] || "" })
                  }}
                  allowMultiple={false}
                  placeholder="Seleccionar categoría..."
                />
              )}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-muted-foreground">DESCRIPCIÓN</Label>
            <Textarea
              value={formData.descripcion || ""}
              onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
              placeholder="Notas adicionales..."
              rows={3}
              className="bg-muted/30 resize-none"
            />
          </div>

          {/* Contact */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-muted-foreground">CONTACTO</Label>
            <Input
              value={formData.contraparte || ""}
              onChange={(e) => setFormData({ ...formData, contraparte: e.target.value })}
              placeholder="Quién realizó la transacción"
              className="bg-muted/30"
            />
          </div>
        </div>

        {/* Action Buttons - Fixed at bottom */}
        <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 sm:relative sm:bg-transparent sm:border-t-0 sm:p-0 sm:pt-6">
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1" 
              onClick={handleCancel}
              disabled={isCreating}
            >
              Cancelar
            </Button>
            <Button 
              className="flex-1 bg-primary hover:bg-primary/90" 
              onClick={handleCreate}
              disabled={isCreating || !isFormValid}
            >
              {isCreating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Crear
                </>
              )}
            </Button>
          </div>
        </div>
        
        {/* Spacer for mobile fixed buttons */}
        <div className="h-20 sm:hidden"></div>
      </SheetContent>
    </Sheet>
  )
}
