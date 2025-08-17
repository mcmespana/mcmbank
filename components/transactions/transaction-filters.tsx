"use client"
import { X, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import type { Categoria, CuentaConDelegacion } from "@/lib/types/database"
import type { TransactionFilters as Filters } from "./transaction-manager"

interface TransactionFiltersProps {
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  onClearFilters: () => void
  categories: Categoria[]
  accounts?: CuentaConDelegacion[]
}

export function TransactionFiltersComponent({
  filters,
  onFiltersChange,
  onClearFilters,
  categories,
  accounts = [],
}: TransactionFiltersProps) {
  const updateFilter = (key: keyof Filters, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const hasActiveFilters = Object.values(filters).some((value) => value !== undefined && value !== "" && value !== false)

  return (
    <div className="space-y-6">
      {/* Clear Filters */}
      {hasActiveFilters && (
        <Button variant="outline" size="sm" onClick={onClearFilters} className="w-full bg-transparent">
          <X className="mr-2 h-4 w-4" />
          Limpiar filtros
        </Button>
      )}

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

      <Separator />

      {/* Amount Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Rango de importe</Label>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Input
              type="number"
              placeholder="Mín €"
              value={filters.amountFrom || ""}
              onChange={(e) => updateFilter("amountFrom", e.target.value ? Number(e.target.value) : undefined)}
              step="0.01"
            />
          </div>
          <div>
            <Input
              type="number"
              placeholder="Máx €"
              value={filters.amountTo || ""}
              onChange={(e) => updateFilter("amountTo", e.target.value ? Number(e.target.value) : undefined)}
              step="0.01"
            />
          </div>
        </div>
      </div>

      <Separator />

      {/* Uncategorized Filter */}
      <div className="space-y-3">
        <Button
          variant={filters.uncategorized ? "default" : "outline"}
          size="sm"
          className="w-full relative"
          onClick={() => updateFilter("uncategorized", !filters.uncategorized)}
        >
          Sin categoría
          {filters.uncategorized && (
            <span className="absolute -top-1 -right-1 bg-primary text-primary-foreground text-xs rounded-full h-5 w-5 flex items-center justify-center">
              ✓
            </span>
          )}
        </Button>
      </div>
    </div>
  )
}
