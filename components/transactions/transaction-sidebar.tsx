"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer"
import { useMediaQuery } from "@/hooks/use-media-query"
import { formatCurrency } from "@/lib/utils/format"
import { CategoryChip } from "./category-chip"
import { BankAvatar } from "./bank-avatar"
import { 
  X, 
  Save, 
  Upload, 
  FileText, 
  Calendar,
  DollarSign,
  Building2,
  User
} from "lucide-react"
import type { Movimiento, Cuenta, Categoria } from "@/lib/types/database"

interface TransactionSidebarProps {
  movement?: Movimiento
  accounts: Cuenta[]
  categories: Categoria[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (movement: Partial<Movimiento>) => Promise<void>
  onDelete?: (movementId: string) => Promise<void>
}

export function TransactionSidebar({
  movement,
  accounts,
  categories,
  open,
  onOpenChange,
  onSave,
  onDelete
}: TransactionSidebarProps) {
  const isDesktop = useMediaQuery("(min-width: 1024px)")
  const [formData, setFormData] = useState<Partial<Movimiento>>({})
  const [saving, setSaving] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  // Initialize form data when movement changes
  useEffect(() => {
    if (movement) {
      setFormData({
        concepto: movement.concepto,
        descripcion: movement.descripcion,
        importe: movement.importe,
        fecha: movement.fecha,
        cuenta_id: movement.cuenta_id,
        categoria_id: movement.categoria_id,
        contraparte: movement.contraparte,
        metodo: movement.metodo,
        notas: movement.notas,
      })
      setSelectedCategories(movement.categoria_id ? [movement.categoria_id] : [])
    }
  }, [movement])

  const handleSave = async () => {
    if (!movement) return
    
    setSaving(true)
    try {
      await onSave({
        ...formData,
        categoria_id: selectedCategories.length > 0 ? selectedCategories[0] : null
      })
      onOpenChange(false)
    } catch (error) {
      console.error("Error saving transaction:", error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!movement || !onDelete) return
    
    if (confirm("¿Estás seguro de que quieres eliminar esta transacción?")) {
      await onDelete(movement.id)
      onOpenChange(false)
    }
  }

  const updateFormData = (key: keyof Movimiento, value: any) => {
    setFormData(prev => ({ ...prev, [key]: value }))
  }

  const selectedAccount = accounts.find(acc => acc.id === formData.cuenta_id)

  if (isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-[500px] sm:w-[600px] p-0">
          <div className="flex flex-col h-full">
            {/* Header */}
            <SheetHeader className="px-6 py-4 border-b">
              <div className="flex items-center justify-between">
                <SheetTitle className="text-lg font-semibold">
                  {movement ? "Editar transacción" : "Nueva transacción"}
                </SheetTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onOpenChange(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </SheetHeader>

            {/* Content */}
            <ScrollArea className="flex-1">
              <div className="p-6">
                <TransactionForm
                  formData={formData}
                  accounts={accounts}
                  categories={categories}
                  selectedCategories={selectedCategories}
                  onFormDataChange={updateFormData}
                  onCategoriesChange={setSelectedCategories}
                />
              </div>
            </ScrollArea>

            {/* Footer */}
            <div className="border-t p-6 bg-muted/30">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>Última modificación: {movement ? new Date(movement.creado_en).toLocaleDateString('es-ES') : 'Nueva'}</span>
                </div>
                <div className="flex gap-2">
                  {onDelete && movement && (
                    <Button variant="destructive" size="sm" onClick={handleDelete}>
                      Eliminar
                    </Button>
                  )}
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? "Guardando..." : "Guardar"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    )
  }

  // Mobile drawer
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <div className="flex flex-col h-[90vh]">
          {/* Header */}
          <DrawerHeader className="border-b">
            <div className="flex items-center justify-between">
              <DrawerTitle className="text-lg font-semibold">
                {movement ? "Editar transacción" : "Nueva transacción"}
              </DrawerTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DrawerHeader>

          {/* Content */}
          <ScrollArea className="flex-1">
            <div className="p-4">
              <TransactionForm
                formData={formData}
                accounts={accounts}
                categories={categories}
                selectedCategories={selectedCategories}
                onFormDataChange={updateFormData}
                onCategoriesChange={setSelectedCategories}
              />
            </div>
          </ScrollArea>

          {/* Footer */}
          <div className="border-t p-4 bg-muted/30">
            <div className="flex gap-2">
              {onDelete && movement && (
                <Button variant="destructive" size="sm" onClick={handleDelete} className="flex-1">
                  Eliminar
                </Button>
              )}
              <Button onClick={handleSave} disabled={saving} className="flex-1">
                {saving ? "Guardando..." : "Guardar"}
              </Button>
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  )
}

interface TransactionFormProps {
  formData: Partial<Movimiento>
  accounts: Cuenta[]
  categories: Categoria[]
  selectedCategories: string[]
  onFormDataChange: (key: keyof Movimiento, value: any) => void
  onCategoriesChange: (categoryIds: string[]) => void
}

function TransactionForm({
  formData,
  accounts,
  categories,
  selectedCategories,
  onFormDataChange,
  onCategoriesChange
}: TransactionFormProps) {
  return (
    <div className="space-y-6">
      {/* Tabs */}
      <Tabs defaultValue="datos" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="datos">Datos</TabsTrigger>
          <TabsTrigger value="archivos">Archivos</TabsTrigger>
        </TabsList>

        {/* Datos Tab */}
        <TabsContent value="datos" className="space-y-6 mt-6">
          {/* Account Selection */}
          <div className="space-y-2">
            <Label>Cuenta</Label>
            <div className="flex items-center gap-3 p-3 border rounded-lg">
              {formData.cuenta_id && (
                <BankAvatar 
                  account={accounts.find(acc => acc.id === formData.cuenta_id)} 
                  size="sm" 
                />
              )}
              <Select
                value={formData.cuenta_id || ""}
                onValueChange={(value) => onFormDataChange("cuenta_id", value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Seleccionar cuenta" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((account) => (
                    <SelectItem key={account.id} value={account.id}>
                      <div className="flex items-center gap-2">
                        <BankAvatar account={account} size="sm" />
                        <span>{account.nombre}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label>Concepto</Label>
            <Input
              value={formData.concepto || ""}
              onChange={(e) => onFormDataChange("concepto", e.target.value)}
              placeholder="Descripción de la transacción"
            />
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label>Importe (€)</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground">
                €
              </span>
              <Input
                type="number"
                step="0.01"
                value={formData.importe || ""}
                onChange={(e) => onFormDataChange("importe", parseFloat(e.target.value) || 0)}
                className="pl-8"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Date */}
          <div className="space-y-2">
            <Label>Fecha</Label>
            <Input
              type="date"
              value={formData.fecha || ""}
              onChange={(e) => onFormDataChange("fecha", e.target.value)}
            />
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <Label>Categorías</Label>
            <CategoryChip
              categories={categories.filter(cat => selectedCategories.includes(cat.id))}
              allCategories={categories}
              onCategoriesChange={onCategoriesChange}
              maxCategories={3}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>Descripción</Label>
            <Textarea
              value={formData.descripcion || ""}
              onChange={(e) => onFormDataChange("descripcion", e.target.value)}
              placeholder="Descripción adicional (opcional)"
              rows={3}
            />
          </div>

          {/* Counterparty */}
          <div className="space-y-2">
            <Label>Contraparte</Label>
            <Input
              value={formData.contraparte || ""}
              onChange={(e) => onFormDataChange("contraparte", e.target.value)}
              placeholder="Nombre de la empresa o persona"
            />
          </div>

          {/* Payment Method */}
          <div className="space-y-2">
            <Label>Método de pago</Label>
            <Select
              value={formData.metodo || ""}
              onValueChange={(value) => onFormDataChange("metodo", value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar método" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="transferencia">Transferencia</SelectItem>
                <SelectItem value="tarjeta">Tarjeta</SelectItem>
                <SelectItem value="efectivo">Efectivo</SelectItem>
                <SelectItem value="cheque">Cheque</SelectItem>
                <SelectItem value="otros">Otros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notas</Label>
            <Textarea
              value={formData.notas || ""}
              onChange={(e) => onFormDataChange("notas", e.target.value)}
              placeholder="Notas adicionales (opcional)"
              rows={2}
            />
          </div>
        </TabsContent>

        {/* Archivos Tab */}
        <TabsContent value="archivos" className="space-y-6 mt-6">
          {/* Invoice Upload */}
          <div className="space-y-3">
            <Label className="text-sm font-medium uppercase text-muted-foreground">
              FACTURA
            </Label>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                Suelta aquí la factura para añadirla...
              </p>
            </div>
          </div>

          {/* Other Files Upload */}
          <div className="space-y-3">
            <Label className="text-sm font-medium uppercase text-muted-foreground">
              OTROS ARCHIVOS
            </Label>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center hover:border-muted-foreground/50 transition-colors">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-sm text-muted-foreground">
                Suelta aquí el archivo para añadirlo...
              </p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}