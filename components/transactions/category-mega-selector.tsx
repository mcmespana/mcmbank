"use client"

import { useMemo, useState, useEffect, useRef, type CSSProperties } from "react"
import { X, Search, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { BankAvatar } from "@/components/bank-avatar"
import { formatCurrency } from "@/lib/utils/format"
import { getCategoryColorTokens } from "@/lib/utils/category-colors"
import type { Categoria, Movimiento, Cuenta } from "@/lib/types/database"
import { cn } from "@/lib/utils"

interface CategoryMegaSelectorProps {
  categories: Categoria[]
  selectedCategoryId?: string | null
  selectedCategories?: string[]
  onSelect?: (categoryId: string) => void
  onSelectionChange?: (categoryIds: string[]) => void
  onClose: () => void
  movement?: Movimiento | null
  account?: Cuenta | null
  onCreateCategory?: () => void
  bulkSelectionLabel?: string
  allowMultiple?: boolean
  title?: string
}

interface CategoryGroup {
  parent: Categoria
  children: Categoria[]
}

export function CategoryMegaSelector({
  categories,
  selectedCategoryId,
  selectedCategories: selectedCategoriesProp = [],
  onSelect,
  onSelectionChange,
  onClose,
  movement,
  account,
  onCreateCategory,
  bulkSelectionLabel,
  allowMultiple = false,
  title,
}: CategoryMegaSelectorProps) {
  const [searchValue, setSearchValue] = useState("")
  const [internalSelectedCategories, setInternalSelectedCategories] = useState<string[]>(selectedCategoriesProp)
  const inputRef = useRef<HTMLInputElement>(null)

  const selectedCategories = allowMultiple ? internalSelectedCategories : []
  const isSelected = (categoryId: string) =>
    allowMultiple ? selectedCategories.includes(categoryId) : selectedCategoryId === categoryId

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  const { groups, orphans, parentLookup } = useMemo(() => {
    const parentCategories = categories.filter((cat) => !cat.categoria_padre_id)
    const childMap = new Map<string, Categoria[]>()
    const parentLookupMap = new Map<string, Categoria | undefined>()

    categories.forEach((category) => {
      if (category.categoria_padre_id) {
        const arr = childMap.get(category.categoria_padre_id) || []
        arr.push(category)
        childMap.set(category.categoria_padre_id, arr)
      }
    })

    const sortedParents = [...parentCategories].sort((a, b) => {
      const ordenA = "orden_efectivo" in a ? (a as any).orden_efectivo ?? a.orden : a.orden
      const ordenB = "orden_efectivo" in b ? (b as any).orden_efectivo ?? b.orden : b.orden
      if (ordenA !== ordenB) return ordenA - ordenB
      return a.nombre.localeCompare(b.nombre)
    })
    const groups: CategoryGroup[] = sortedParents.map((parent) => {
      const children = (childMap.get(parent.id) || []).sort((a, b) => {
        const ordenA = "orden_efectivo" in a ? (a as any).orden_efectivo ?? a.orden : a.orden
        const ordenB = "orden_efectivo" in b ? (b as any).orden_efectivo ?? b.orden : b.orden
        if (ordenA !== ordenB) return ordenA - ordenB
        return a.nombre.localeCompare(b.nombre)
      })
      children.forEach((child) => parentLookupMap.set(child.id, parent))
      parentLookupMap.set(parent.id, undefined)
      return {
        parent,
        children,
      }
    })

    const parentIds = new Set(parentCategories.map((cat) => cat.id))
    const orphans = categories
      .filter((cat) => cat.categoria_padre_id && !parentIds.has(cat.categoria_padre_id))
      .sort((a, b) => {
        const ordenA = "orden_efectivo" in a ? (a as any).orden_efectivo ?? a.orden : a.orden
        const ordenB = "orden_efectivo" in b ? (b as any).orden_efectivo ?? b.orden : b.orden
        if (ordenA !== ordenB) return ordenA - ordenB
        return a.nombre.localeCompare(b.nombre)
      })

    orphans.forEach((orphan) => {
      if (orphan.categoria_padre_id) {
        const parent = categories.find((cat) => cat.id === orphan.categoria_padre_id)
        if (parent) {
          parentLookupMap.set(orphan.id, parent)
        }
      }
    })

    return { groups, orphans, parentLookup: parentLookupMap }
  }, [categories])

  const normalizedSearch = searchValue.trim().toLowerCase()

  const filteredResults = useMemo(() => {
    if (!normalizedSearch) {
      return []
    }

    return categories
      .filter((category) =>
        category.nombre.toLowerCase().includes(normalizedSearch) ||
        (category.emoji && category.emoji.includes(searchValue.trim())),
      )
      .sort((a, b) => {
        const ordenA = "orden_efectivo" in a ? (a as any).orden_efectivo ?? a.orden : a.orden
        const ordenB = "orden_efectivo" in b ? (b as any).orden_efectivo ?? b.orden : b.orden
        if (ordenA !== ordenB) return ordenA - ordenB
        return a.nombre.localeCompare(b.nombre)
      })
  }, [categories, normalizedSearch, searchValue])

  const handleSelect = (categoryId: string) => {
    if (allowMultiple) {
      const newSelection = selectedCategories.includes(categoryId)
        ? selectedCategories.filter((id) => id !== categoryId)
        : [...selectedCategories, categoryId]
      setInternalSelectedCategories(newSelection)
    } else {
      onSelect?.(categoryId)
      onClose()
    }
  }

  const handleApply = () => {
    onSelectionChange?.(internalSelectedCategories)
    onClose()
  }

  const handleClearAll = () => {
    setInternalSelectedCategories([])
  }

  return (
    <div className="bg-background shadow-xl border border-border/40 w-full max-w-3xl h-full sm:h-auto max-h-screen sm:max-h-[calc(100vh-4rem)] rounded-t-3xl sm:rounded-3xl overflow-hidden flex flex-col">
      <div className="border-b bg-muted/40 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
          <div className="flex flex-1 items-start gap-3 sm:items-center">
            {movement ? (
              <>
                <div className="flex-shrink-0 rounded-full p-0.5 border border-border/40 shadow-sm">
                  <BankAvatar account={account || undefined} size="sm" />
                </div>
                <div className="space-y-1 min-w-0">
                  <p className="text-[11px] tracking-wide text-muted-foreground uppercase">
                    {account?.nombre || account?.banco_nombre || "Cuenta sin nombre"}
                  </p>
                  <h2 className="text-base font-semibold leading-tight line-clamp-2 sm:line-clamp-1">{movement.concepto}</h2>
                  {(movement.contraparte || movement.descripcion) && (
                    <p className="text-sm text-muted-foreground line-clamp-1">
                      {movement.contraparte || movement.descripcion}
                    </p>
                  )}
                </div>
              </>
            ) : bulkSelectionLabel ? (
              <div className="flex items-start gap-3">
                <div className="hidden h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-xl text-primary sm:flex">
                  ✨
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Selección múltiple</p>
                  <h2 className="text-base font-semibold leading-tight sm:text-lg">{bulkSelectionLabel}</h2>
                  <p className="text-xs text-muted-foreground">
                    Todas recibirán la misma categoría en un abrir y cerrar de ojos.
                  </p>
                </div>
              </div>
            ) : title ? (
              <div className="flex items-start gap-3">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold leading-tight">{title}</h2>
                  {allowMultiple && selectedCategories.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {selectedCategories.length} categoría{selectedCategories.length !== 1 ? "s" : ""} seleccionada{selectedCategories.length !== 1 ? "s" : ""}
                    </p>
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-2">
            {allowMultiple && selectedCategories.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClearAll}
                className="text-muted-foreground hover:text-foreground"
              >
                Limpiar
              </Button>
            )}
            {movement && (
              <span
                className={cn(
                  "text-lg font-semibold",
                  movement.importe >= 0 ? "text-emerald-600" : "text-rose-600",
                )}
              >
                {formatCurrency(movement.importe)}
              </span>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              onClick={onClose}
              aria-label="Cerrar selector"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden p-4 sm:p-6 flex flex-col min-h-0">
        <div className="flex h-full flex-col gap-4 sm:gap-5 min-h-0">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                ref={inputRef}
                value={searchValue}
                onChange={(event) => setSearchValue(event.target.value)}
                placeholder="Filtrar por nombre de la etiqueta..."
                className="pl-9 h-10 rounded-xl"
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    if (normalizedSearch && filteredResults[0]) {
                      handleSelect(filteredResults[0].id)
                    }
                  }
                }}
              />
            </div>
            <Button
              variant="outline"
              className="rounded-xl h-10 px-3 w-full sm:w-auto"
              type="button"
              onClick={() => onCreateCategory?.()}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto overscroll-contain touch-pan-y pr-1 sm:pr-3 [-webkit-overflow-scrolling:touch]">
            {normalizedSearch ? (
              <div className="space-y-2 pb-4">
                {filteredResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">No se encontraron categorías</p>
                ) : (
                  filteredResults.map((category) => {
                    const parent = category.categoria_padre_id
                      ? parentLookup.get(category.categoria_padre_id)
                      : undefined
                    return (
                      <CategoryResultRow
                        key={category.id}
                        category={category}
                        parent={parent}
                        isSelected={isSelected(category.id)}
                        onSelect={() => handleSelect(category.id)}
                      />
                    )
                  })
                )}
              </div>
            ) : (
              <div className="space-y-5 pb-4">
                {groups.map((group) => (
                  <CategoryGroupSection
                    key={group.parent.id}
                    group={group}
                    isSelected={isSelected}
                    onSelect={handleSelect}
                  />
                ))}

                {orphans.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">Otras categorías</p>
                    <div className="flex flex-wrap gap-2">
                      {orphans.map((category) => (
                        <CategoryPill
                          key={category.id}
                          category={category}
                          size="sm"
                          isSelected={isSelected(category.id)}
                          onClick={() => handleSelect(category.id)}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {allowMultiple && (
        <div className="border-t bg-muted/20 p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <p className="text-sm text-muted-foreground">
              {selectedCategories.length === 0
                ? "Selecciona categorías para filtrar"
                : `${selectedCategories.length} categoría${selectedCategories.length !== 1 ? "s" : ""} seleccionada${selectedCategories.length !== 1 ? "s" : ""}`}
            </p>
            <Button onClick={handleApply} disabled={selectedCategories.length === 0}>
              Aplicar filtros
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

interface CategoryResultRowProps {
  category: Categoria
  parent?: Categoria
  isSelected: boolean
  onSelect: () => void
}

function CategoryResultRow({ category, parent, isSelected, onSelect }: CategoryResultRowProps) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border border-transparent bg-muted/30 px-4 py-3 text-left transition hover:bg-muted",
        isSelected && "border-primary bg-primary/5",
      )}
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <CategoryPill category={category} size={category.categoria_padre_id ? "xs" : "md"} />
          {parent && (
            <span className="text-xs text-muted-foreground">{parent.nombre}</span>
          )}
        </div>
      </div>
    </button>
  )
}

interface CategoryGroupSectionProps {
  group: CategoryGroup
  isSelected: (categoryId: string) => boolean
  onSelect: (categoryId: string) => void
}

function CategoryGroupSection({ group, isSelected, onSelect }: CategoryGroupSectionProps) {
  const { parent, children } = group

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <CategoryPill
          category={parent}
          size="lg"
          onClick={() => onSelect(parent.id)}
          isSelected={isSelected(parent.id)}
        />
        {children.length > 0 && (
          <span className="text-xs text-muted-foreground">
            {children.length} subcategoría{children.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {children.length > 0 && (
        <div className="flex flex-wrap gap-2 pl-6 sm:pl-12">
          {children.map((child) => (
            <CategoryPill
              key={child.id}
              category={child}
              size="sm"
              onClick={() => onSelect(child.id)}
              isSelected={isSelected(child.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CategoryPillProps {
  category: Categoria
  size?: "xs" | "sm" | "md" | "lg"
  isSelected?: boolean
  onClick?: () => void
}

function CategoryPill({ category, size = "md", isSelected = false, onClick }: CategoryPillProps) {
  const { color, textColor, rgbValue } = getCategoryColorTokens(category)
  const badgeStyles: CSSProperties = {
    ["--category-color" as string]: color,
    ["--category-text-color" as string]: textColor,
    ["--category-color-rgb" as string]: rgbValue,
  }

  const sizeClasses =
    size === "lg"
      ? "text-sm px-4 py-2"
      : size === "sm"
        ? "text-xs px-3 py-1.5"
        : size === "xs"
          ? "text-xs px-2.5 py-1"
          : "text-xs px-3.5 py-1.5"

  return (
    <Badge
      variant="outline"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-transparent shadow-sm transition-all duration-200 bg-[var(--category-color)] text-[var(--category-text-color)] hover:shadow-md cursor-pointer",
        isSelected && "ring-2 ring-primary",
        sizeClasses,
      )}
      style={badgeStyles}
    >
      {category.emoji && <span className="text-sm leading-none">{category.emoji}</span>}
      <span className="font-medium leading-none">{category.nombre}</span>
    </Badge>
  )
}
