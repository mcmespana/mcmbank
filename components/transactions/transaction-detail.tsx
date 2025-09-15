"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { CalendarIcon, AlertTriangle, Check, Loader2, ArrowLeft } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsContent } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { CategorySelector } from "./category-selector"
import { BankAvatar } from "@/components/bank-avatar"
import { TabWithCounter } from "./tab-with-counter"
import { formatCurrency } from "@/lib/utils/format"
import { TransactionFiles } from "./transaction-files"
import type { Movimiento, Cuenta, Categoria } from "@/lib/types/database"

interface TransactionDetailProps {
  movement: Movimiento | null
  accounts: Cuenta[]
  categories: Categoria[]
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: (movementId: string, patch: Partial<Movimiento>) => Promise<void>
  onBack?: () => void
}

export function TransactionDetail({
  movement,
  accounts,
  categories,
  open,
  onOpenChange,
  onUpdate,
  onBack,
}: TransactionDetailProps) {
  const [formData, setFormData] = useState<Partial<Movimiento>>({})
  const [dateOpen, setDateOpen] = useState(false)
  const [showAmountConfirm, setShowAmountConfirm] = useState(false)
  const [pendingAmount, setPendingAmount] = useState<string>("")
  const [isAmountEditing, setIsAmountEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [activeTab, setActiveTab] = useState<"datos" | "archivos">("datos")
  const [fileCount, setFileCount] = useState(0)
  const [showSaved, setShowSaved] = useState(false)

  const account = accounts.find((acc) => acc.id === movement?.cuenta_id)
  const selectedCategory = categories.find((cat) => cat.id === formData.categoria_id)

  const hasChanges =
    JSON.stringify(formData) !==
    JSON.stringify({
      importe: movement?.importe,
      fecha: movement?.fecha,
      concepto: movement?.concepto,
      descripcion: movement?.descripcion || "",
      categoria_id: movement?.categoria_id,
      contraparte: movement?.contraparte || "",
    })

  useEffect(() => {
    if (movement) {
      setFormData({
        importe: movement.importe,
        fecha: movement.fecha,
        concepto: movement.concepto,
        descripcion: movement.descripcion || "",
        categoria_id: movement.categoria_id,
        contraparte: movement.contraparte || "",
      })
      setLastSaved(null)
      setShowSaved(false)
    }
  }, [movement])

  useEffect(() => {
    if (movement && hasChanges) {
      setIsSaving(true)
      setShowSaved(false)
      const timeoutId = setTimeout(async () => {
        try {
          await onUpdate(movement.id, formData)
          setLastSaved(new Date())
        } catch (error) {
          console.error("Error auto-saving:", error)
        } finally {
          setIsSaving(false)
        }
      }, 2000)

      return () => clearTimeout(timeoutId)
    }
  }, [formData, movement, hasChanges, onUpdate])

  useEffect(() => {
    if (!isSaving && lastSaved) {
      setShowSaved(true)
      const timer = setTimeout(() => setShowSaved(false), 2000)
      return () => clearTimeout(timer)
    }
  }, [isSaving, lastSaved])

  const handleAmountClick = () => {
    setIsAmountEditing(true)
    setPendingAmount(formData.importe?.toString() || "")
  }

  const handleAmountChange = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      setShowAmountConfirm(true)
    } else if (e.key === "Escape") {
      setIsAmountEditing(false)
      setPendingAmount("")
    }
  }

  const confirmAmountChange = () => {
    setFormData((prev) => ({ ...prev, importe: Number.parseFloat(pendingAmount) || 0 }))
    setShowAmountConfirm(false)
    setPendingAmount("")
    setIsAmountEditing(false)
  }

  const cancelAmountChange = () => {
    setShowAmountConfirm(false)
    setPendingAmount("")
    setIsAmountEditing(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="z-[60] w-full overflow-y-auto p-0 sm:w-[560px] sm:max-w-[640px]">
        <div className="p-4 sm:p-6">
          <SheetHeader className="pb-4">
            <div className="flex items-center gap-2">
              {onBack && (
                <Button variant="ghost" size="icon" className="-ml-2" onClick={onBack}>
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              )}
              <SheetTitle className="text-xl font-semibold text-left">Transacción</SheetTitle>
            </div>

            <div className="bg-muted/30 rounded-lg p-3 sm:p-4 space-y-3 sm:space-y-4 mt-4">
              {account && (
                <div className="flex items-center gap-3">
                  <div
                    className="rounded-full p-0.5"
                    style={{ backgroundColor: account.color || "#4ECDC4" }}
                  >
                    <BankAvatar account={account} size="sm" />
                  </div>
                  <div>
                    <p className="font-medium text-sm">{account.nombre}</p>
                    <p className="text-xs text-muted-foreground">{account.banco_nombre}</p>
                  </div>
                </div>
              )}

              <div className="text-center space-y-1">
                {isAmountEditing ? (
                  <Input
                    type="number"
                    step="0.01"
                    value={pendingAmount}
                    onChange={(e) => setPendingAmount(e.target.value)}
                    onKeyDown={handleAmountChange}
                    onBlur={cancelAmountChange}
                    className="w-40 h-10 text-center font-bold text-xl mx-auto"
                    autoFocus
                  />
                ) : (
                  <button
                    onClick={handleAmountClick}
                    className={cn(
                      "text-center font-bold text-xl sm:text-2xl hover:bg-muted/50 px-3 py-2 rounded transition-colors",
                      (formData.importe || 0) >= 0 ? "text-green-600" : "text-red-600",
                    )}
                  >
                    {formatCurrency(formData.importe || 0)}
                  </button>
                )}
                <p className="text-sm text-muted-foreground">
                  {formData.fecha ? format(new Date(formData.fecha), "dd/MM/yyyy") : "Sin fecha"}
                </p>
              </div>

              {selectedCategory && (
                <div className="flex justify-center">
                  <div
                    className="px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2"
                    style={{
                      backgroundColor: selectedCategory.color + "20",
                      color: selectedCategory.color,
                      border: `1px solid ${selectedCategory.color}40`,
                    }}
                  >
                    <span>{selectedCategory.emoji}</span>
                    <span>{selectedCategory.nombre}</span>
                  </div>
                </div>
              )}
            </div>
          </SheetHeader>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "datos" | "archivos")} className="w-full">
            <div className="flex w-full rounded-md bg-muted p-1">
              <TabWithCounter
                label="Datos"
                isActive={activeTab === "datos"}
                onClick={() => setActiveTab("datos")}
                className="flex-1"
              />
              <TabWithCounter
                label="Archivos"
                count={fileCount}
                isActive={activeTab === "archivos"}
                onClick={() => setActiveTab("archivos")}
                className="flex-1"
              />
            </div>

            <TabsContent value="datos" className="space-y-4 mt-4">
              {showAmountConfirm && (
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="flex items-center justify-between">
                    <span className="text-amber-800">¿Seguro que quieres editar el importe?</span>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={confirmAmountChange} className="h-7">
                        Sí
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelAmountChange} className="h-7 bg-transparent">
                        No
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="concepto" className="text-sm font-medium">
                    Concepto
                  </Label>
                  <Input
                    id="concepto"
                    value={formData.concepto || ""}
                    onChange={(e) => setFormData((prev) => ({ ...prev, concepto: e.target.value }))}
                    placeholder="Concepto de la transacción"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fecha" className="text-sm font-medium">
                    Fecha
                  </Label>
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-9",
                          !formData.fecha && "text-muted-foreground",
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.fecha ? format(new Date(formData.fecha), "dd/MM/yyyy") : "Fecha"}
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
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria" className="text-sm font-medium">
                  Categoría
                </Label>
                <CategorySelector
                  categories={categories}
                  selectedCategories={formData.categoria_id ? [formData.categoria_id] : []}
                  onSelectionChange={(categoryIds) =>
                    setFormData((prev) => ({ ...prev, categoria_id: categoryIds.length > 0 ? categoryIds[0] : null }))
                  }
                  allowMultiple={false}
                  placeholder="Sin categoría"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contacto" className="text-sm font-medium">
                  Contacto
                </Label>
                <Input
                  id="contacto"
                  value={formData.contraparte || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, contraparte: e.target.value }))}
                  placeholder="Nombre del contacto"
                  className="h-9"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="descripcion" className="text-sm font-medium">
                  Descripción
                </Label>
                <Textarea
                  id="descripcion"
                  value={formData.descripcion || ""}
                  onChange={(e) => setFormData((prev) => ({ ...prev, descripcion: e.target.value }))}
                  placeholder="Descripción adicional (opcional)"
                  rows={3}
                  className="resize-none"
                />
              </div>
            </TabsContent>

            <TabsContent value="archivos" className="space-y-6 mt-6">
              <TransactionFiles
                movementId={movement?.id || null}
                delegacionId={account?.delegacion_id}
                onCountChange={setFileCount}
              />
            </TabsContent>
          </Tabs>
        </div>
        {(isSaving || showSaved) && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md shadow">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Guardando...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4 text-green-600" />
                  <span className="text-sm text-green-600">Guardado</span>
                </>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}
