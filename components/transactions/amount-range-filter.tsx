"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Euro, X } from "lucide-react"

interface AmountRangeFilterProps {
  amountFrom?: number
  amountTo?: number
  onAmountRangeChange: (amountFrom?: number, amountTo?: number) => void
}

export function AmountRangeFilter({ amountFrom, amountTo, onAmountRangeChange }: AmountRangeFilterProps) {
  const [open, setOpen] = useState(false)
  const [tempFrom, setTempFrom] = useState(amountFrom?.toString() || "")
  const [tempTo, setTempTo] = useState(amountTo?.toString() || "")

  const hasActiveFilter = amountFrom !== undefined || amountTo !== undefined

  const handleApply = () => {
    const fromValue = tempFrom ? Number.parseFloat(tempFrom) : undefined
    const toValue = tempTo ? Number.parseFloat(tempTo) : undefined
    onAmountRangeChange(fromValue, toValue)
    setOpen(false)
  }

  const handleClear = () => {
    setTempFrom("")
    setTempTo("")
    onAmountRangeChange(undefined, undefined)
    setOpen(false)
  }

  const handleXClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    handleClear()
  }

  const getDisplayText = () => {
    if (amountFrom !== undefined && amountTo !== undefined) {
      return `${amountFrom}€ - ${amountTo}€`
    }
    if (amountFrom !== undefined) {
      return `Desde ${amountFrom}€`
    }
    if (amountTo !== undefined) {
      return `Hasta ${amountTo}€`
    }
    return "Rango de importe"
  }

  return (
    <div className="w-full">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant={hasActiveFilter ? "default" : "outline"}
            size="sm"
            className={`w-full justify-start gap-2 ${
              hasActiveFilter
                ? "bg-blue-500 hover:bg-blue-600 text-white"
                : "bg-background hover:bg-muted border-border"
            }`}
          >
            <Euro className="h-4 w-4" />
            <span className="truncate">{getDisplayText()}</span>
            {hasActiveFilter && (
              <X className="h-3 w-3 ml-auto hover:bg-blue-600 rounded-full p-0.5" onClick={handleXClick} />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-4" align="start">
          <div className="space-y-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Filtrar por importe</h4>
              <p className="text-xs text-muted-foreground">
                Define un rango de importes para filtrar las transacciones
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="amount-from" className="text-xs">
                  Desde (€)
                </Label>
                <Input
                  id="amount-from"
                  type="number"
                  placeholder="0.00"
                  value={tempFrom}
                  onChange={(e) => setTempFrom(e.target.value)}
                  className="h-8"
                  step="1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amount-to" className="text-xs">
                  Hasta (€)
                </Label>
                <Input
                  id="amount-to"
                  type="number"
                  placeholder="1000.00"
                  value={tempTo}
                  onChange={(e) => setTempTo(e.target.value)}
                  className="h-8"
                  step="1"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
                Cancelar
              </Button>
              <Button variant="outline" size="sm" onClick={handleClear}>
                Limpiar
              </Button>
              <Button size="sm" onClick={handleApply}>
                Aplicar
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
