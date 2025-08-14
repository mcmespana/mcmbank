"use client"
import { X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
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
  const updateFilter = (key: keyof Filters, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const hasActiveFilters = Object.values(filters).some((value) => value !== undefined && value !== "")

  return (
    <div className="space-y-6">
      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="outline" size="sm" onClick={onClearFilters} className="w-full bg-transparent">
          <X className="mr-2 h-4 w-4" />
          Limpiar filtros
        </Button>
      )}

      {/* Categories */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">Categorías</Label>
          <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            Añadir
          </Button>
        </div>
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

      <Separator />

      {/* Amount Range */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Rango de importe</Label>
        <div className="space-y-2">
          <div>
            <Label htmlFor="amount-min" className="text-xs text-muted-foreground">
              Mínimo
            </Label>
            <Input
              id="amount-min"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={filters.amountMin || ""}
              onChange={(e) =>
                updateFilter("amountMin", e.target.value ? Number.parseFloat(e.target.value) : undefined)
              }
            />
          </div>
          <div>
            <Label htmlFor="amount-max" className="text-xs text-muted-foreground">
              Máximo
            </Label>
            <Input
              id="amount-max"
              type="number"
              step="0.01"
              placeholder="0,00"
              value={filters.amountMax || ""}
              onChange={(e) =>
                updateFilter("amountMax", e.target.value ? Number.parseFloat(e.target.value) : undefined)
              }
            />
          </div>
        </div>
      </div>
    </div>
  )
}
