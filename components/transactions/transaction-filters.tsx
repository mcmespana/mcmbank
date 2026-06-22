"use client"
import { X, Tag, Building2, PiggyBank, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { CategorySelector } from "./category-selector"
import { AmountRangeFilter } from "./amount-range-filter"
import { ContactoSelector } from "@/components/contactos/contacto-selector"
import { CONTACTO_TIPO_INFO, CONTACTO_TIPO_ORDER } from "@/lib/utils/contacto-tipos"
import { cn } from "@/lib/utils"
import type { Categoria, ContactoConCategoriaPredeterminada, ContactoTipo, CuentaConDelegacion } from "@/lib/types/database"
import type { TransactionFilters as Filters } from "./transaction-manager"

interface TransactionFiltersProps {
  filters: Filters
  onFiltersChange: (filters: Filters) => void
  onClearFilters: () => void
  categories: Categoria[]
  accounts?: CuentaConDelegacion[]
  contactos?: ContactoConCategoriaPredeterminada[]
  uncategorizedCount: number
}

export function TransactionFiltersComponent({
  filters,
  onFiltersChange,
  onClearFilters,
  categories,
  accounts = [],
  contactos = [],
  uncategorizedCount,
}: TransactionFiltersProps) {
  const updateFilter = (key: keyof Filters, value: any) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  const toggleContactoTipo = (tipo: ContactoTipo) => {
    const current = filters.contactoTipos || []
    const next = current.includes(tipo) ? current.filter((t) => t !== tipo) : [...current, tipo]
    updateFilter("contactoTipos", next.length > 0 ? next : undefined)
  }

  const activeFilterCount = Object.entries(filters).filter(([key, value]) => {
    if (key === "uncategorized" || key === "dateRange") return false
    if (key === "categoryIds" || key === "contactoIds" || key === "contactoTipos") {
      return Array.isArray(value) && value.length > 0
    }
    return value !== undefined && value !== "" && value !== false
  }).length
  const hasActiveFilters = activeFilterCount > 0

  return (
    <div className="space-y-4">
      {hasActiveFilters && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-2.5 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-2 w-2 bg-blue-500 rounded-full animate-pulse shrink-0"></div>
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300 truncate">
                {activeFilterCount} filtro{activeFilterCount !== 1 ? "s" : ""} activo{activeFilterCount !== 1 ? "s" : ""}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={onClearFilters}
              className="h-7 px-2 text-xs bg-white/80 hover:bg-white border-blue-300 text-blue-700 hover:text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-950/70"
            >
              <X className="mr-1 h-3.5 w-3.5" />
              Quitar
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

      {/* En md+ la búsqueda vive en la barra superior; aquí solo en móvil */}
      <div className="space-y-2 md:hidden">
        <Label className="text-xs font-semibold text-foreground uppercase tracking-wide">Buscar</Label>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Concepto, descripción, contacto…"
            value={filters.search || ""}
            onChange={(e) => updateFilter("search", e.target.value || undefined)}
            className="h-9 bg-background border-border pl-9 pr-8 focus:border-primary focus:ring-1 focus:ring-primary/20"
          />
          {filters.search && (
            <button
              type="button"
              onClick={() => updateFilter("search", undefined)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold text-foreground uppercase tracking-wide">Categorías</Label>
        <CategorySelector
          categories={categories}
          selectedCategories={filters.categoryIds || []}
          onSelectionChange={(categoryIds) =>
            updateFilter("categoryIds", categoryIds.length > 0 ? categoryIds : undefined)
          }
          allowMultiple={true}
          placeholder="Todas las categorías"
        />
      </div>

      {accounts.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs font-semibold text-foreground uppercase tracking-wide">Cuenta</Label>
          <Select
            value={filters.accountId || "all"}
            onValueChange={(value) => updateFilter("accountId", value === "all" ? undefined : value)}
          >
            <SelectTrigger className="h-9 bg-background border-border focus:border-primary">
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
      )}

      <div className="space-y-2">
        <Label className="text-xs font-semibold text-foreground uppercase tracking-wide">Contactos</Label>
        <ContactoSelector
          contactos={contactos}
          value={filters.contactoIds?.[0] ?? null}
          onChange={(id) => updateFilter("contactoIds", id ? [id] : undefined)}
          placeholder="Cualquier contacto"
        />
        <div className="flex flex-wrap gap-1">
          {CONTACTO_TIPO_ORDER.map((t) => {
            const info = CONTACTO_TIPO_INFO[t]
            const active = (filters.contactoTipos ?? []).includes(t)
            return (
              <button
                key={t}
                type="button"
                onClick={() => toggleContactoTipo(t)}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] transition-colors",
                  active
                    ? `${info.bgClass} ${info.textClass} ${info.borderClass} shadow-sm`
                    : "border-border/40 bg-background/60 text-muted-foreground hover:bg-muted",
                )}
              >
                <span aria-hidden>{info.emoji}</span>
                <span>{info.shortLabel}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-semibold text-foreground uppercase tracking-wide">Importe</Label>
        <AmountRangeFilter
          amountFrom={filters.amountFrom}
          amountTo={filters.amountTo}
          onAmountRangeChange={(amountFrom, amountTo) => {
            onFiltersChange({ ...filters, amountFrom, amountTo })
          }}
        />
      </div>
    </div>
  )
}
