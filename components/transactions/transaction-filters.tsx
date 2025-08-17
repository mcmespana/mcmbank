"use client"
import { X, Plus, Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { DateRangeFilter } from "./date-range-filter"
import { AmountFilter } from "./amount-filter"
import { UncategorizedFilter } from "./uncategorized-filter"
import type { Categoria, CuentaConDelegacion } from "@/lib/types/database"
import type { TransactionFilters as Filters } from "./transaction-manager"

interface TransactionFiltersProps {
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  onClearFilters: () => void
  categories: Categoria[]
  accounts?: CuentaConDelegacion[]
  uncategorizedCount: number
}

export function TransactionFiltersComponent({
  filters,
  onFiltersChange,
  onClearFilters,
  categories,
  accounts = [],
  uncategorizedCount,
}: TransactionFiltersProps) {
  const updateFilter = (key: keyof Filters, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const hasActiveFilters = Object.values(filters).some((value) => value !== undefined && value !== "")

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Filtros</h3>
        </div>
        {hasActiveFilters && (
          <Button variant="outline" size="sm" onClick={onClearFilters} className="bg-transparent">
            <X className="mr-2 h-4 w-4" />
            Limpiar filtros
          </Button>
        )}
      </div>

      {/* Date Range Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Rango de fechas</Label>
        <DateRangeFilter
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onDateRangeChange={(dateFrom, dateTo) => {
            updateFilter("dateFrom", dateFrom)
            updateFilter("dateTo", dateTo)
          }}
        />
      </div>

      <Separator />

      {/* Amount Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Importe</Label>
        <AmountFilter
          minAmount={filters.minAmount}
          maxAmount={filters.maxAmount}
          onAmountChange={(minAmount, maxAmount) => {
            updateFilter("minAmount", minAmount)
            updateFilter("maxAmount", maxAmount)
          }}
        />
      </div>

      <Separator />

      {/* Uncategorized Filter */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Estado de categorización</Label>
        <UncategorizedFilter
          active={filters.uncategorized === true}
          count={uncategorizedCount}
          onToggle={(active) => updateFilter("uncategorized", active ? true : undefined)}
        />
      </div>

      <Separator />

      {/* Search */}
      <div className="space-y-2">
        <Label className="text-sm font-medium">Buscar</Label>
        <Input
          placeholder="Buscar en concepto o descripción..."
          value={filters.search || ""}
          onChange={(e) => updateFilter("search", e.target.value || undefined)}
        />
      </div>

      <Separator />

      {/* Accounts */}
      {accounts.length > 0 && (
        <>
          <div className="space-y-3">
            <Label className="text-sm font-medium">Cuenta</Label>
            <Select
              value={filters.accountId || "all"}
              onValueChange={(value) => updateFilter("accountId", value === "all" ? undefined : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Todas las cuentas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las cuentas</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      <span>{account.nombre}</span>
                      {account.banco_nombre && (
                        <span className="text-xs text-muted-foreground">({account.banco_nombre})</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Separator />
        </>
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
    </div>
  )
}
