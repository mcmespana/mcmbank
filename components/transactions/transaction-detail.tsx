"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
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
import { LoadingSpinner } from "@/components/ui/loading-spinner"

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
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [activeTab, setActiveTab] = useState<"datos" | "archivos">("datos")
  const [fileCount, setFileCount] = useState(0)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const savedResetTimerRef = useRef<NodeJS.Timeout | null>(null)

  const clearAutoSaveTimer = () => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
      autoSaveTimerRef.current = null
    }
  }

  const clearSavedResetTimer = () => {
    if (savedResetTimerRef.current) {
      clearTimeout(savedResetTimerRef.current)
      savedResetTimerRef.current = null
    }
  }

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
      setActiveTab("datos")
      setFileCount(0)
      setIsAmountEditing(false)
      setShowAmountConfirm(false)
      setPendingAmount("")
      clearAutoSaveTimer()
      clearSavedResetTimer()
      setSaveStatus("idle")
    } else {
      setFormData({})
      clearAutoSaveTimer()
      clearSavedResetTimer()
      setSaveStatus("idle")
    }
  }, [movement])

  useEffect(() => {
    if (!movement) {
      return
    }

    if (!hasChanges) {
      clearAutoSaveTimer()
      setSaveStatus((status) => (status === "saving" ? "idle" : status))
      return
    }

    clearAutoSaveTimer()
    clearSavedResetTimer()
    setSaveStatus("saving")

    autoSaveTimerRef.current = setTimeout(async () => {
      try {
        await onUpdate(movement.id, formData)
        setSaveStatus("saved")
        clearSavedResetTimer()
        savedResetTimerRef.current = setTimeout(() => {
          setSaveStatus("idle")
        }, 2000)
      } catch (error) {
        console.error("Error auto-saving:", error)
        setSaveStatus("idle")
      }
    }, 2000)

    return () => {
      clearAutoSaveTimer()
    }
  }, [formData, movement, hasChanges, onUpdate])

  useEffect(() => {
    return () => {
      clearAutoSaveTimer()
      clearSavedResetTimer()
    }
  }, [])

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

  const parseAmountInput = (value: string) => {
    const trimmed = value.replace(/\s/g, "")

    if (!trimmed) {
      return null
    }

    const usesCommaAsDecimal =
      trimmed.includes(",") && (!trimmed.includes(".") || trimmed.lastIndexOf(",") > trimmed.lastIndexOf("."))

    const normalized = usesCommaAsDecimal
      ? trimmed.replace(/\./g, "").replace(/,/g, ".")
      : trimmed.replace(/,/g, "")

    const parsed = Number.parseFloat(normalized)
    return Number.isNaN(parsed) ? null : parsed
  }

  const formatPreviousDate = (dateValue?: string | null) => {
    if (!dateValue) {
      return "Sin fecha registrada"
    }

    try {
      return format(new Date(dateValue), "dd/MM/yyyy")
    } catch (error) {
      console.error("Error formatting previous date:", error)
      return dateValue
    }
  }

  const formatPreviousAmount = (amountValue?: number | null) => {
    if (typeof amountValue !== "number") {
      return "Sin cantidad registrada"
    }

    return formatCurrency(amountValue)
  }

  const appendChangeDetails = (prev: Partial<Movimiento>) => {
    const descriptionSource = prev.descripcion ?? ""
    const previousDateLabel = formatPreviousDate(prev.fecha)
    const previousAmountLabel = formatPreviousAmount(prev.importe)
    const details = `Fecha anterior a la modificación: ${previousDateLabel}\nCantidad anterior a la modificación: ${previousAmountLabel}`
    const trimmedDescription = descriptionSource.trimEnd()
    return trimmedDescription ? `${trimmedDescription}\n${details}` : details
  }

  const confirmAmountChange = () => {
    const parsedAmount = parseAmountInput(pendingAmount)

    if (parsedAmount === null) {
      return
    }

    setFormData((prev) => {
      if (parsedAmount === prev.importe) {
        return prev
      }

      return {
        ...prev,
        importe: parsedAmount,
        descripcion: appendChangeDetails(prev),
      }
    })

    setShowAmountConfirm(false)
    setPendingAmount("")
    setIsAmountEditing(false)
  }

  const cancelAmountChange = () => {
    setShowAmountConfirm(false)
    setPendingAmount("")
    setIsAmountEditing(false)
  }

  const statusLabel =
    saveStatus === "saving" ? "Guardando..." : saveStatus === "saved" ? "Guardado" : "Sin cambios"

  const statusIcon =
    saveStatus === "saving" ? (
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
    ) : (
      <Check
        className={cn(
          "h-4 w-4",
          saveStatus === "saved" ? "text-emerald-600 dark:text-emerald-300" : "text-muted-foreground",
        )}
      />
    )

  const statusContainerClass = cn(
    "flex items-center gap-2 px-3 py-2 rounded-md border shadow-sm",
    saveStatus === "saved"
      ? "bg-emerald-100 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-700"
      : "bg-muted dark:bg-muted border-border dark:border-border",
  )

  const statusTextClass = cn(
    "text-sm",
    saveStatus === "saved" ? "text-emerald-700 dark:text-emerald-200" : "text-muted-foreground",
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:w-[560px] sm:max-w-[640px] overflow-y-auto p-0 z-[60]">
        {!movement ? (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center gap-3 p-6 text-sm text-muted-foreground">
            <LoadingSpinner size="md" />
            <span>Cargando transacción...</span>
          </div>
        ) : (
          <>
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
                    <Alert className="border-amber-200 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <AlertDescription className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-amber-800 dark:text-amber-100">
                        <span>¿Seguro que quieres editar el importe?</span>
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" onClick={cancelAmountChange} className="h-7 bg-transparent dark:text-amber-100 dark:hover:bg-amber-900/60">
                            No
                          </Button>
                          <Button size="sm" onClick={confirmAmountChange} autoFocus className="h-7">
                            Sí
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
                              if (!date) {
                                return
                              }

                              const nextDate = format(date, "yyyy-MM-dd")

                              setFormData((prev) => {
                                if (prev.fecha === nextDate) {
                                  return prev
                                }

                                return {
                                  ...prev,
                                  fecha: nextDate,
                                  descripcion: appendChangeDetails(prev),
                                }
                              })

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
            {movement && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <div className={statusContainerClass}>
                  {statusIcon}
                  <span className={statusTextClass}>{statusLabel}</span>
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
