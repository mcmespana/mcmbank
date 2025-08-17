"use client"

import { useState } from "react"
import { DollarSign, Minus, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Badge } from "@/components/ui/badge"

interface AmountFilterProps {
  minAmount?: number
  maxAmount?: number
  onAmountChange: (minAmount?: number, maxAmount?: number) => void
}

export function AmountFilter({ minAmount, maxAmount, onAmountChange }: AmountFilterProps) {
  const [open, setOpen] = useState(false)
  const [localMin, setLocalMin] = useState(minAmount?.toString() || "")
  const [localMax, setLocalMax] = useState(maxAmount?.toString() || "")

  const hasActiveFilter = minAmount !== undefined || maxAmount !== undefined

  const handleApply = () => {
    const min = localMin ? parseFloat(localMin) : undefined
    const max = localMax ? parseFloat(localMax) : undefined
    
    // Validate that min is not greater than max
    if (min !== undefined && max !== undefined && min > max) {
      return
    }
    
    onAmountChange(min, max)
    setOpen(false)
  }

  const handleClear = () => {
    setLocalMin("")
    setLocalMax("")
    onAmountChange(undefined, undefined)
    setOpen(false)
  }

  const getDisplayValue = () => {
    if (minAmount !== undefined && maxAmount !== undefined) {
      return `${minAmount.toFixed(2)}€ - ${maxAmount.toFixed(2)}€`
    } else if (minAmount !== undefined) {
      return `Desde ${minAmount.toFixed(2)}€`
    } else if (maxAmount !== undefined) {
      return `Hasta ${maxAmount.toFixed(2)}€`
    }
    return "Filtrar por cantidad"
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={hasActiveFilter ? "default" : "outline"}
          size="sm"
          className="gap-2"
        >
          <DollarSign className="h-4 w-4" />
          {getDisplayValue()}
          {hasActiveFilter && (
            <Badge variant="secondary" className="ml-1 text-xs">
              Activo
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4" align="start">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Filtrar por cantidad</Label>
            {hasActiveFilter && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="h-auto p-1 text-xs"
              >
                Limpiar
              </Button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Importe mínimo</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                  €
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={localMin}
                  onChange={(e) => setLocalMin(e.target.value)}
                  className="pl-8"
                  placeholder="0.01"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Importe máximo</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground text-sm">
                  €
                </span>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={localMax}
                  onChange={(e) => setLocalMax(e.target.value)}
                  className="pl-8"
                  placeholder="Sin límite"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="flex-1">
              Cancelar
            </Button>
            <Button size="sm" onClick={handleApply} className="flex-1">
              Aplicar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}