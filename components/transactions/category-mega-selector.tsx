"use client"

import { useMemo, useState, useEffect, useRef, type CSSProperties } from "react"
import { X, Search, Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { BankAvatar } from "@/components/bank-avatar"
import { formatCurrency } from "@/lib/utils/format"
import { getCategoryColorTokens } from "@/lib/utils/category-colors"
import type { Categoria, Movimiento, Cuenta } from "@/lib/types/database"
import { cn } from "@/lib/utils"
import { CategoryPill } from "./category-pill"

interface CategoryMegaSelectorProps {
  categories: Categoria[]
  selectedCategoryId?: string | null
  onSelect: (categoryId: string) => void
  onClose: () => void
  movement?: Movimiento | null
  account?: Cuenta | null
  onCreateCategory?: () => void
  bulkSelectionLabel?: string
}

interface CategoryGroup {
  parent: Categoria
  children: Categoria[]
}

export function CategoryMegaSelector({
  categories,
  selectedCategoryId,
  onSelect,
  onClose,
  movement,
  account,
  onCreateCategory,
  bulkSelectionLabel,
}: CategoryMegaSelectorProps) {
  const [searchValue, setSearchValue] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const frame = requestAnimationFrame(() => inputRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [])

  const { groups, orphans, parentLookup, parentsWithoutChildren } = useMemo(() => {
    const parentCategories = categories.filter((cat) => !cat.categoria_padre_id)
    const childMap = new Map<string, Categoria[]>()
    const parentLookupMap = new Map<string, Categoria | undefined>()
    const standaloneParents: Categoria[] = []

    categories.forEach((category) => {
      if (category.categoria_padre_id) {
        const arr = childMap.get(category.categoria_padre_id) || []
        arr.push(category)
        childMap.set(category.categoria_padre_id, arr)
      }
    })

    const sortedParents = [...parentCategories].sort((a, b) => {
      const ordenA = "orden_efectivo" in a ? a.orden_efectivo ?? a.orden : a.orden
      const ordenB = "orden_efectivo" in b ? b.orden_efectivo ?? b.orden : b.orden
      if (ordenA !== ordenB) return ordenA - ordenB
      return a.nombre.localeCompare(b.nombre)
    })
    const groups: CategoryGroup[] = sortedParents.map((parent) => {
      const children = (childMap.get(parent.id) || []).sort((a, b) => {
        const ordenA = "orden_efectivo" in a ? a.orden_efectivo ?? a.orden : a.orden
        const ordenB = "orden_efectivo" in b ? b.orden_efectivo ?? b.orden : b.orden
        if (ordenA !== ordenB) return ordenA - ordenB
        return a.nombre.localeCompare(b.nombre)
      })
      if (children.length === 0) {
        standaloneParents.push(parent)
      }
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
        const ordenA = "orden_efectivo" in a ? a.orden_efectivo ?? a.orden : a.orden
        const ordenB = "orden_efectivo" in b ? b.orden_efectivo ?? b.orden : b.orden
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

    return { groups, orphans, parentLookup: parentLookupMap, parentsWithoutChildren: standaloneParents }
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
        const ordenA = "orden_efectivo" in a ? a.orden_efectivo ?? a.orden : a.orden
        const ordenB = "orden_efectivo" in b ? b.orden_efectivo ?? b.orden : b.orden
        if (ordenA !== ordenB) return ordenA - ordenB
        return a.nombre.localeCompare(b.nombre)
      })
  }, [categories, normalizedSearch, searchValue])

  const handleSelect = (categoryId: string) => {
    onSelect(categoryId)
    onClose()
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
            ) : null}
          </div>

          <div className="flex items-start justify-between gap-2 sm:flex-col sm:items-end sm:justify-start">
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
                        isSelected={selectedCategoryId === category.id}
                        onSelect={() => handleSelect(category.id)}
                      />
                    )
                  })
                )}
              </div>
            ) : (
              <div className="space-y-5 pb-4">
                {groups
                  .filter((group) => group.children.length > 0)
                  .map((group) => (
                    <CategoryGroupSection
                      key={group.parent.id}
                      group={group}
                      selectedCategoryId={selectedCategoryId}
                      onSelect={handleSelect}
                    />
                  ))}

                {(parentsWithoutChildren.length > 0 || orphans.length > 0) && (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase">
                      Categorías sin subcategorías
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {parentsWithoutChildren.map((category) => (
                        <CategoryPill
                          key={category.id}
                          category={category}
                          size="sm"
                          isSelected={selectedCategoryId === category.id}
                          onClick={() => handleSelect(category.id)}
                        />
                      ))}
                      {orphans.map((category) => (
                        <CategoryPill
                          key={category.id}
                          category={category}
                          size="sm"
                          isSelected={selectedCategoryId === category.id}
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
  const { rgbValue } = getCategoryColorTokens(parent ?? category)
  const style: CSSProperties = {
    ["--category-color-rgb" as string]: rgbValue,
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      style={style}
      className={cn(
        "w-full rounded-3xl border border-transparent bg-[rgba(var(--category-color-rgb),0.06)] px-4 py-3 text-left transition hover:bg-[rgba(var(--category-color-rgb),0.12)] dark:bg-[rgba(var(--category-color-rgb),0.2)] dark:hover:bg-[rgba(var(--category-color-rgb),0.32)]",
        isSelected &&
          "border-[rgba(var(--category-color-rgb),0.3)] ring-2 ring-offset-2 ring-offset-background ring-[rgba(var(--category-color-rgb),0.45)] dark:border-[rgba(var(--category-color-rgb),0.45)]",
      )}
    >
      <div className="flex flex-col gap-2">
        <CategoryPill category={category} size={category.categoria_padre_id ? "sm" : "md"} isSelected={isSelected} />
        {parent && (
          <div className="text-xs text-muted-foreground">
            Pertenece a <span className="font-medium text-foreground/80">{parent.nombre}</span>
          </div>
        )}
      </div>
    </button>
  )
}

interface CategoryGroupSectionProps {
  group: CategoryGroup
  selectedCategoryId?: string | null
  onSelect: (categoryId: string) => void
}

function CategoryGroupSection({ group, selectedCategoryId, onSelect }: CategoryGroupSectionProps) {
  const { parent, children } = group
  const { color, rgbValue } = getCategoryColorTokens(parent)
  const sectionStyle: CSSProperties = {
    ["--category-color" as string]: color,
    ["--category-color-rgb" as string]: rgbValue,
  }
  const isParentSelected = selectedCategoryId === parent.id

  return (
    <div
      className="rounded-3xl border border-[rgba(var(--category-color-rgb),0.18)] bg-[rgba(var(--category-color-rgb),0.08)] p-4 shadow-sm transition hover:shadow-md dark:border-[rgba(var(--category-color-rgb),0.32)] dark:bg-[rgba(var(--category-color-rgb),0.22)]"
      style={sectionStyle}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CategoryPill
          category={parent}
          size="lg"
          onClick={() => onSelect(parent.id)}
          isSelected={isParentSelected}
          className={cn(
            !isParentSelected &&
              "border border-border/40 bg-card text-foreground hover:bg-muted dark:border-border/60 dark:bg-card dark:hover:bg-muted",
          )}
        />
        {children.length > 0 && (
          <span className="text-xs font-medium text-[color:var(--category-color)] dark:text-white bg-[rgba(var(--category-color-rgb),0.18)] dark:bg-[rgba(var(--category-color-rgb),0.35)] px-2 py-1 rounded-full shadow-sm">
            {children.length} subcategoría{children.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>
      {children.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {children.map((child) => (
            <CategoryPill
              key={child.id}
              category={child}
              size="sm"
              onClick={() => onSelect(child.id)}
              isSelected={selectedCategoryId === child.id}
            />
          ))}
        </div>
      )}
    </div>
  )
}
