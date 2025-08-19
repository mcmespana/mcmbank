"use client"
import { X, Tag, Building2, PiggyBank } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { CategorySelector } from "./category-selector"
import { AmountRangeFilter } from "./amount-range-filter"
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

  const hasActiveFilters = Object.entries(filters).some(([key, value]) => {
    if (key === "uncategorized" || key === "dateRange") return false
    if (key === "categoryIds") {
      return Array.isArray(value) && value.length > 0
    }
    return value !== undefined && value !== "" && value !== false
  })

  return (
    <div className="space-y-6">
      {hasActiveFilters && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Filtros activos</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="bg-white/80 hover:bg-white border-blue-300 text-blue-700 hover:text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950/70"
            >
              <X className="mr-2 h-4 w-4" />
              Quitar filtros
            </Button>
          </div>
        </div>
      )}

      <Button
        variant={filters.uncategorized ? "default" : "outline"}
        size="sm"
        onClick={() => updateFilter("uncategorized", !filters.uncategorized)}
        className={`w-full justify-start gap-2 ${
          filters.uncategorized
            ? "bg-orange-500 hover:bg-orange-600 text-white"
            : "bg-background hover:bg-orange-50 border-orange-200 text-orange-700 dark:hover:bg-orange-950/20 dark:text-orange-400"
        }`}
      >
        <Tag className="h-4 w-4" />
        <span>Sin categorizar</span>
        {uncategorizedCount > 0 && (
          <Badge
            variant="secondary"
            className={`ml-auto ${
              filters.uncategorized
                ? "bg-orange-600 text-orange-100"
                : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
            }`}
          >
            {uncategorizedCount}
          </Badge>
        )}
      </Button>

      <Separator className="bg-border" />

      <div className="space-y-3">
        <Label className="text-sm font-semibold text-foreground">Categorías</Label>
        <CategorySelector
          categories={categories}
          selectedCategories={filters.categoryIds || []}
          onSelectionChange={(categoryIds) =>
            updateFilter("categoryIds", categoryIds.length > 0 ? categoryIds : undefined)
          }
          allowMultiple={true}
          placeholder="Seleccionar categorías..."
        />
      </div>

      <Separator className="bg-border" />

      <div className="space-y-3">
        <Label className="text-sm font-semibold text-foreground">Buscar transacciones</Label>
        <div className="relative">
          <Input
            placeholder="Buscar en concepto o descripción..."
            value={filters.search || ""}
            onChange={(e) => updateFilter("search", e.target.value || undefined)}
            className="bg-background border-border focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
        </div>
      </div>

      <Separator className="bg-border" />

      {accounts.length > 0 && (
        <>
          <div className="space-y-3">
            <Label className="text-sm font-semibold text-foreground">Cuenta</Label>
            <Select
              value={filters.accountId || "all"}
              onValueChange={(value) => updateFilter("accountId", value === "all" ? undefined : value)}
            >
              <SelectTrigger className="bg-background border-border focus:border-primary">
                <SelectValue placeholder="Todas las cuentas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las cuentas</SelectItem>
                {accounts.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    <div className="flex items-center gap-2">
                      {account.tipo === "caja" ? (
                        <PiggyBank className="h-4 w-4 text-amber-600" />
                      ) : (
                        <Building2 className="h-4 w-4 text-blue-600" />
                      )}
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
          <Separator className="bg-border" />
        </>
      )}

      <div className="space-y-3">
        <Label className="text-sm font-semibold text-foreground">Importe</Label>
        <AmountRangeFilter
          amountFrom={filters.amountFrom}
          amountTo={filters.amountTo}
          onAmountRangeChange={(amountFrom, amountTo) => {
            updateFilter("amountFrom", amountFrom)
            updateFilter("amountTo", amountTo)
          }}
        />
      </div>
    </div>
  )
}
