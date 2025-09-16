"use client"

import type React from "react"

import { useState, useEffect, useMemo } from "react"
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

type HistoryChange = "date" | "amount"

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
  const [formMovementId, setFormMovementId] = useState<string | null>(movement?.id ?? null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle")
  const [isHeaderDateOpen, setIsHeaderDateOpen] = useState(false)
  const [isFormDateOpen, setIsFormDateOpen] = useState(false)
  const [showAmountConfirm, setShowAmountConfirm] = useState(false)
  const [pendingAmount, setPendingAmount] = useState<string>("")
  const [isAmountEditing, setIsAmountEditing] = useState(false)
  const [activeTab, setActiveTab] = useState<"datos" | "archivos">("datos")
  const [fileCount, setFileCount] = useState(0)

  const baselineData = useMemo(() => {
    if (!movement) {
      return null
    }

    return {
      importe: movement.importe,
      fecha: movement.fecha,
      concepto: movement.concepto,
      descripcion: movement.descripcion || "",
      categoria_id: movement.categoria_id,
      contraparte: movement.contraparte || "",
    }
  }, [movement])

  const hasChanges = useMemo(() => {
    if (!baselineData) {
      return false
    }

    return JSON.stringify(formData) !== JSON.stringify(baselineData)
  }, [formData, baselineData])

  const account = accounts.find((acc) => acc.id === movement?.cuenta_id)
  const selectedCategory = categories.find((cat) => cat.id === formData.categoria_id)

  useEffect(() => {
    if (!movement || !baselineData) {
      setFormData({})
      setFormMovementId(null)
      setActiveTab("datos")
      setFileCount(0)
      setIsAmountEditing(false)
      setShowAmountConfirm(false)
      setPendingAmount("")
      setSaveStatus("idle")
      setIsHeaderDateOpen(false)
      setIsFormDateOpen(false)
      setIsInitialized(false)
      return
    }

    setFormData({ ...baselineData })
    setFormMovementId(movement.id)
    setActiveTab("datos")
    setFileCount(0)
    setIsAmountEditing(false)
    setShowAmountConfirm(false)
    setPendingAmount("")
    setSaveStatus("idle")
    setIsHeaderDateOpen(false)
    setIsFormDateOpen(false)
    setIsInitialized(true)
  }, [movement, baselineData])

  useEffect(() => {
    if (!movement || !baselineData || !isInitialized || movement.id !== formMovementId) {
      return
    }

    if (!hasChanges) {
      if (saveStatus === "saving") {
        setSaveStatus("idle")
      }
      return
    }

    setSaveStatus("saving")
    const timeoutId = setTimeout(async () => {
      try {
        await onUpdate(movement.id, formData)
        setSaveStatus("saved")
      } catch (error) {
        console.error("Error auto-saving:", error)
        setSaveStatus("idle")
      }
    }, 2000)

    return () => clearTimeout(timeoutId)
  }, [
    movement,
    baselineData,
    formData,
    hasChanges,
    isInitialized,
    formMovementId,
    onUpdate,
    saveStatus,
  ])

  useEffect(() => {
    if (saveStatus !== "saved") {
      return
    }

    const timer = setTimeout(() => setSaveStatus("idle"), 2000)
    return () => clearTimeout(timer)
  }, [saveStatus])

  const appendHistoryNote = (prev: Partial<Movimiento>, change: HistoryChange | HistoryChange[]) => {
    const descriptionBase = (prev.descripcion ?? "").trimEnd()

    const changes = Array.isArray(change) ? change : [change]
    const entries: string[] = []

    if (changes.includes("date")) {
      let previousDateLabel = "Sin fecha"
      if (prev.fecha) {
        const parsedDate = new Date(prev.fecha)
        previousDateLabel = Number.isNaN(parsedDate.getTime())
          ? prev.fecha
          : format(parsedDate, "dd/MM/yyyy")
      }
      entries.push(`Fecha anterior a la modificación: ${previousDateLabel}`)
    }

    if (changes.includes("amount")) {
      const previousAmountLabel =
        typeof prev.importe === "number"
          ? formatCurrency(prev.importe)
          : "Sin cantidad"
      entries.push(`Cantidad anterior a la modificación: ${previousAmountLabel}`)
    }

    if (entries.length === 0) {
      return descriptionBase
    }

    const logEntry = entries.join("\n")

    return descriptionBase ? `${descriptionBase}\n\n${logEntry}` : logEntry
  }

  const parseAmountValue = (value: string): number | null => {
    const trimmed = value.trim()
    if (!trimmed) {
      return null
    }

    const usesComma = trimmed.includes(",")
    const normalized = usesComma
      ? trimmed.replace(/\./g, "").replace(",", ".")
      : trimmed

    const parsed = Number.parseFloat(normalized)

    if (Number.isNaN(parsed)) {
      return null
    }

    return parsed
  }

  const handleAmountClick = () => {
    setIsAmountEditing(true)
    setPendingAmount(formData.importe !== undefined ? String(formData.importe) : "")
    setShowAmountConfirm(false)
  }

  const handleAmountChange = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      if (pendingAmount.trim().length === 0) {
        cancelAmountChange()
      } else {
        setShowAmountConfirm(true)
      }
    } else if (e.key === "Escape") {
      cancelAmountChange()
    }
  }

  const confirmAmountChange = () => {
    const parsedAmount = parseAmountValue(pendingAmount)

    if (parsedAmount === null) {
      cancelAmountChange()
      return
    }

    setFormData((prev) => {
      if (prev.importe === parsedAmount) {
        return { ...prev, importe: parsedAmount }
      }

      return {
        ...prev,
        importe: parsedAmount,
        descripcion: appendHistoryNote(prev, "amount"),
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

  const handleAmountBlur = (event: React.FocusEvent<HTMLInputElement>) => {
    if (showAmountConfirm) {
      const nextElement = event.relatedTarget as HTMLElement | null
      if (nextElement?.dataset.amountAction) {
        return
      }
    }

    cancelAmountChange()
  }

  const handleDateSelection = (selectedDate: Date | undefined, onClose: () => void) => {
    if (!selectedDate) {
      onClose()
      return
    }

    const formattedDate = format(selectedDate, "yyyy-MM-dd")

    setFormData((prev) => {
      if (prev.fecha === formattedDate) {
        return prev
      }

      return {
        ...prev,
        fecha: formattedDate,
        descripcion: appendHistoryNote(prev, "date"),
      }
    })

    onClose()
  }

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
                        type="text"
                        inputMode="decimal"
                        value={pendingAmount}
                        onChange={(e) => setPendingAmount(e.target.value)}
                        onKeyDown={handleAmountChange}
                        onBlur={handleAmountBlur}
                        className="w-40 h-10 text-center font-bold text-xl mx-auto"
                        autoFocus
                        aria-label="Editar importe"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={handleAmountClick}
                        className={cn(
                          "text-center font-bold text-xl sm:text-2xl hover:bg-muted/50 px-3 py-2 rounded transition-colors",
                          (formData.importe || 0) >= 0 ? "text-green-600" : "text-red-600",
                        )}
                      >
                        {formatCurrency(formData.importe || 0)}
                      </button>
                    )}
                    <Popover open={isHeaderDateOpen} onOpenChange={setIsHeaderDateOpen}>
                      <PopoverTrigger asChild>
                        <button
                          type="button"
                          className="mx-auto flex items-center gap-2 rounded-md px-2 py-1 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2"
                        >
                          <CalendarIcon className="h-4 w-4" />
                          {formData.fecha ? format(new Date(formData.fecha), "dd/MM/yyyy") : "Sin fecha"}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="center" sideOffset={12}>
                        <Calendar
                          mode="single"
                          selected={formData.fecha ? new Date(formData.fecha) : undefined}
                          onSelect={(date) => handleDateSelection(date, () => setIsHeaderDateOpen(false))}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
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
                    <Alert className="border border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
                      <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-300" />
                      <AlertDescription className="flex flex-wrap items-center justify-between gap-3 text-sm">
                        <span className="font-medium">¿Seguro que quieres editar el importe?</span>
                        <div className="flex flex-row-reverse items-center gap-2">
                          <Button
                            type="button"
                            size="sm"
                            onClick={confirmAmountChange}
                            className="h-7 px-3"
                            data-amount-action="confirm"
                            autoFocus
                          >
                            Sí
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={cancelAmountChange}
                            className="h-7 bg-transparent"
                            data-amount-action="cancel"
                          >
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
                      <Popover open={isFormDateOpen} onOpenChange={setIsFormDateOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal h-9",
                              !formData.fecha && "text-muted-foreground",
                            )}
                            type="button"
                            onClick={() => setIsFormDateOpen((prev) => !prev)}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {formData.fecha ? format(new Date(formData.fecha), "dd/MM/yyyy") : "Fecha"}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            mode="single"
                            selected={formData.fecha ? new Date(formData.fecha) : undefined}
                            onSelect={(date) => handleDateSelection(date, () => setIsFormDateOpen(false))}
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
            {movement && isInitialized && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
                <div
                  className={cn(
                    "flex items-center gap-2 rounded-md border px-3 py-2 text-sm shadow-sm backdrop-blur-sm",
                    saveStatus === "saving"
                      ? "bg-background/90 text-muted-foreground"
                      : saveStatus === "saved"
                      ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-300 border-green-200 dark:border-green-800"
                      : "bg-muted/80 text-muted-foreground dark:bg-background/70",
                  )}
                >
                  {saveStatus === "saving" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Guardando...</span>
                    </>
                  ) : (
                    <>
                      <Check
                        className={cn(
                          "h-4 w-4",
                          saveStatus === "saved"
                            ? "text-green-600 dark:text-green-400"
                            : "text-muted-foreground",
                        )}
                      />
                      <span>{saveStatus === "saved" ? "Guardado" : "Sin cambios"}</span>
                    </>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
