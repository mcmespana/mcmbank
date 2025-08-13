"use client"

import { useState } from "react"
import { CalendarIcon, X } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import type { Categoria } from "@/lib/types"
import type { TransactionFilters as Filters } from "./transaction-manager"

interface TransactionFiltersProps {
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  onClearFilters: () => void
  categories: Categoria[]
}

export function TransactionFiltersComponent({
  filters,
  onFiltersChange,
  onClearFilters,
  categories,
}: TransactionFiltersProps) {
  const [dateFromOpen, setDateFromOpen] = useState(false)
  const [dateToOpen, setDateToOpen] = useState(false)

  const updateFilter = (key: keyof Filters, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const hasActiveFilters = Object.values(filters).some((value) => value !== undefined && value !== "")

  return (
    <div className="space-y-4 rounded-lg border bg-card p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium">Filtros</h3>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters}>
            <X className="mr-2 h-4 w-4" />
            Limpiar filtros
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {/* Date From */}
        <div className="space-y-2">
          <Label htmlFor="date-from">Desde</Label>
          <Popover open={dateFromOpen} onOpenChange={setDateFromOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !filters.dateFrom && "text-muted-foreground",
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateFrom ? format(new Date(filters.dateFrom), "dd/MM/yyyy", { locale: es }) : "Seleccionar"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateFrom ? new Date(filters.dateFrom) : undefined}
                onSelect={(date) => {
                  updateFilter("dateFrom", date ? format(date, "yyyy-MM-dd") : undefined)
                  setDateFromOpen(false)
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Date To */}
        <div className="space-y-2">
          <Label htmlFor="date-to">Hasta</Label>
          <Popover open={dateToOpen} onOpenChange={setDateToOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className={cn("w-full justify-start text-left font-normal", !filters.dateTo && "text-muted-foreground")}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {filters.dateTo ? format(new Date(filters.dateTo), "dd/MM/yyyy", { locale: es }) : "Seleccionar"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={filters.dateTo ? new Date(filters.dateTo) : undefined}
                onSelect={(date) => {
                  updateFilter("dateTo", date ? format(date, "yyyy-MM-dd") : undefined)
                  setDateToOpen(false)
                }}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>

        {/* Category */}
        <div className="space-y-2">
          <Label htmlFor="category">Categoría</Label>
          <Select
            value={filters.categoryId || "all"}
            onValueChange={(value) => updateFilter("categoryId", value === "all" ? undefined : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Todas las categorías" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las categorías</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category.id} value={category.id}>
                  <div className="flex items-center gap-2">
                    {category.emoji && <span>{category.emoji}</span>}
                    <span>{category.nombre}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Amount Min */}
        <div className="space-y-2">
          <Label htmlFor="amount-min">Importe mínimo</Label>
          <Input
            id="amount-min"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={filters.amountMin || ""}
            onChange={(e) => updateFilter("amountMin", e.target.value ? Number.parseFloat(e.target.value) : undefined)}
          />
        </div>

        {/* Amount Max */}
        <div className="space-y-2">
          <Label htmlFor="amount-max">Importe máximo</Label>
          <Input
            id="amount-max"
            type="number"
            step="0.01"
            placeholder="0,00"
            value={filters.amountMax || ""}
            onChange={(e) => updateFilter("amountMax", e.target.value ? Number.parseFloat(e.target.value) : undefined)}
          />
        </div>
      </div>
    </div>
  )
}
