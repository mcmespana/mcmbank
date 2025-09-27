"use client"

import type React from "react"

import { useState, useMemo, useEffect, useRef, type CSSProperties } from "react"
import { Check, ChevronsUpDown, X, Search, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { getCategoryColorTokens } from "@/lib/utils/category-colors"
import { cn } from "@/lib/utils"
import type { Categoria } from "@/lib/types/database"

interface CategoryGroup {
  parent: Categoria
  children: Categoria[]
}

type CategoriaWithOptionalOrder = Categoria & {
  orden_efectivo?: number | null
}

function getCategoryOrderValue(category: CategoriaWithOptionalOrder) {
  if (typeof category.orden_efectivo === "number") {
    return category.orden_efectivo
  }

  return category.orden
}

function sortCategoriesByOrder(categories: Categoria[]) {
  return [...categories].sort((a, b) => {
    const orderA = getCategoryOrderValue(a as CategoriaWithOptionalOrder)
    const orderB = getCategoryOrderValue(b as CategoriaWithOptionalOrder)

    if (orderA !== orderB) {
      return orderA - orderB
    }

    return a.nombre.localeCompare(b.nombre)
  })
}

interface CategorySelectorProps {
  categories: Categoria[]
  selectedCategories: string[]
  onSelectionChange: (categoryIds: string[]) => void
  allowMultiple?: boolean
  placeholder?: string
  onCategoryRemove?: (categoryId: string) => void
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (isOpen: boolean) => void
  focusSearchOnOpen?: boolean
}

export function CategorySelector({
  categories,
  selectedCategories,
  onSelectionChange,
  allowMultiple = false,
  placeholder = "Seleccionar categoría...",
  onCategoryRemove,
  open: openProp,
  defaultOpen = false,
  onOpenChange,
  focusSearchOnOpen = false,
}: CategorySelectorProps) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const [searchValue, setSearchValue] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const normalizedSearch = searchValue.trim().toLowerCase()
  const hasSearch = normalizedSearch.length > 0

  const { groups, orphans, parentLookup } = useMemo(() => {
    const parentCategories = categories.filter((cat) => !cat.categoria_padre_id)
    const childMap = new Map<string, Categoria[]>()
    const parentLookupMap = new Map<string, Categoria | undefined>()

    categories.forEach((category) => {
      if (!category.categoria_padre_id) {
        return
      }

      const children = childMap.get(category.categoria_padre_id) ?? []
      children.push(category)
      childMap.set(category.categoria_padre_id, children)
    })

    const sortedParents = sortCategoriesByOrder(parentCategories)
    const groups: CategoryGroup[] = sortedParents.map((parent) => {
      const children = sortCategoriesByOrder(childMap.get(parent.id) ?? [])
      children.forEach((child) => parentLookupMap.set(child.id, parent))
      parentLookupMap.set(parent.id, undefined)
      return {
        parent,
        children,
      }
    })

    const parentIds = new Set(parentCategories.map((cat) => cat.id))
    const orphans = sortCategoriesByOrder(
      categories.filter((cat) => cat.categoria_padre_id && !parentIds.has(cat.categoria_padre_id)),
    )

    orphans.forEach((orphan) => {
      if (!orphan.categoria_padre_id) {
        return
      }

      const parent = categories.find((cat) => cat.id === orphan.categoria_padre_id)
      if (parent) {
        parentLookupMap.set(orphan.id, parent)
      }
    })

    return { groups, orphans, parentLookup: parentLookupMap }
  }, [categories])

  const isControlled = openProp !== undefined
  const open = isControlled ? openProp : internalOpen
  const setOpenState = (nextOpen: boolean) => {
    if (!isControlled) {
      setInternalOpen(nextOpen)
    }
    onOpenChange?.(nextOpen)
  }

  useEffect(() => {
    if (!open) {
      return
    }

    setSearchValue("")

    if (!focusSearchOnOpen) {
      return
    }

    const frame = requestAnimationFrame(() => {
      searchInputRef.current?.focus()
    })

    return () => cancelAnimationFrame(frame)
  }, [open, focusSearchOnOpen])

  const filteredCategories = useMemo(() => {
    if (!normalizedSearch) {
      return []
    }

    const emojiSearch = searchValue.trim()

    return sortCategoriesByOrder(
      categories.filter(
        (category) =>
          category.nombre.toLowerCase().includes(normalizedSearch) ||
          (emojiSearch && category.emoji && category.emoji.includes(emojiSearch)),
      ),
    )
  }, [categories, normalizedSearch, searchValue])

  const selectedCategoryObjects = useMemo(() => {
    return categories.filter((cat) => selectedCategories.includes(cat.id))
  }, [categories, selectedCategories])

  const selectionLabel = useMemo(() => {
    if (selectedCategories.length === 0) {
      return placeholder
    }

    if (allowMultiple) {
      if (selectedCategories.length === 1) {
        return selectedCategoryObjects[0]?.nombre ?? placeholder
      }

      return `${selectedCategories.length} categoría${selectedCategories.length !== 1 ? "s" : ""} seleccionada${
        selectedCategories.length !== 1 ? "s" : ""
      }`
    }

    return selectedCategoryObjects[0]?.nombre ?? "Categoría seleccionada"
  }, [allowMultiple, placeholder, selectedCategories, selectedCategoryObjects])

  const selectedCategorySet = useMemo(() => new Set(selectedCategories), [selectedCategories])

  const handleSelect = (categoryId: string) => {
    if (allowMultiple) {
      const newSelection = selectedCategories.includes(categoryId)
        ? selectedCategories.filter((id) => id !== categoryId)
        : [...selectedCategories, categoryId]
      onSelectionChange(newSelection)
    } else {
      onSelectionChange([categoryId])
      setOpenState(false)
    }
  }

  const removeCategory = (categoryId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    if (onCategoryRemove) {
      onCategoryRemove(categoryId)
    } else {
      const newSelection = selectedCategories.filter((id) => id !== categoryId)
      onSelectionChange(newSelection)
    }
  }

  const clearAll = () => {
    onSelectionChange([])
  }

  return (
    <div className="space-y-3">
      <Popover open={open} onOpenChange={setOpenState}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            type="button"
            onClick={() => setOpenState(!open)}
            className={cn(
              "group flex h-11 w-full min-w-[260px] items-center justify-between gap-3 rounded-xl border border-border/60",
              "bg-background/90 px-4 text-left text-sm font-medium shadow-sm transition-all duration-200",
              "hover:border-primary/40 hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1",
              open && "border-primary/50 bg-primary/5",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/80">
                Categorías
              </span>
              <span className="truncate text-sm text-foreground">{selectionLabel}</span>
            </div>
            <div className="flex items-center gap-2">
              {allowMultiple && selectedCategories.length > 0 && (
                <span className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded-full bg-primary/15 px-2 text-xs font-semibold text-primary">
                  {selectedCategories.length}
                </span>
              )}
              <ChevronsUpDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200",
                  open && "rotate-180",
                )}
              />
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[320px] rounded-2xl border border-border/70 bg-popover p-0 shadow-xl sm:w-[360px]"
          align="start"
          sideOffset={8}
        >
          <div className="border-b border-border/60 bg-background/95 p-3 backdrop-blur supports-[backdrop-filter]:bg-background/80">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                placeholder="Buscar categorías..."
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault()
                    const firstCategory = filteredCategories[0]
                    if (firstCategory) {
                      handleSelect(firstCategory.id)
                    }
                  }
                }}
                className="h-10 rounded-lg border-border bg-background/90 pl-9 pr-9 text-sm"
                ref={searchInputRef}
              />
              {searchValue && (
                <button
                  type="button"
                  onClick={() => setSearchValue("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 focus-visible:ring-offset-1"
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            {hasSearch && (
              <div className="mt-3 flex items-center justify-between rounded-lg border border-border/60 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                <span>
                  {filteredCategories.length === 0
                    ? "Sin resultados"
                    : `${filteredCategories.length} resultado${filteredCategories.length !== 1 ? "s" : ""}`}
                </span>
                {filteredCategories.length > 0 && (
                  <span className="font-medium text-foreground/80">
                    Pulsa Enter para elegir el primero
                  </span>
                )}
              </div>
            )}
          </div>
          <ScrollArea className="max-h-[320px]">
            <div className="space-y-3 px-3 py-4">
              {hasSearch ? (
                filteredCategories.length === 0 ? (
                  <div className="py-8 text-center text-muted-foreground">
                    <p className="text-sm">No se encontraron categorías</p>
                  </div>
                ) : (
                  filteredCategories.map((category) => (
                    <CategorySearchResult
                      key={category.id}
                      category={category}
                      parent={parentLookup.get(category.id)}
                      isSelected={selectedCategorySet.has(category.id)}
                      onSelect={() => handleSelect(category.id)}
                    />
                  ))
                )
              ) : groups.length === 0 && orphans.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <p className="text-sm">No hay categorías disponibles</p>
                </div>
              ) : (
                <>
                  {groups.map((group) => (
                    <CategoryGroupCard
                      key={group.parent.id}
                      group={group}
                      onSelectParent={() => handleSelect(group.parent.id)}
                      onSelectChild={(categoryId) => handleSelect(categoryId)}
                      selectedCategorySet={selectedCategorySet}
                    />
                  ))}

                  {orphans.length > 0 && (
                    <div className="space-y-2">
                      <p className="px-1 text-xs font-semibold uppercase text-muted-foreground">
                        Subcategorías sin grupo
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {orphans.map((category) => {
                          const parent = parentLookup.get(category.id)
                          const colorSource = parent ?? category

                          return (
                            <CategoryChipButton
                              key={category.id}
                              category={category}
                              colorSource={colorSource}
                              selected={selectedCategorySet.has(category.id)}
                              onSelect={() => handleSelect(category.id)}
                            />
                          )
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </ScrollArea>
          <div className="border-t p-3">
            <Button
              variant="outline"
              size="sm"
              className="h-9 w-full rounded-xl border-border/60 bg-transparent text-sm hover:border-primary/40 hover:bg-primary/5"
              type="button"
            >
              <Plus className="mr-2 h-4 w-4" />
              Crear nueva categoría
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      {/* Selected Categories Display */}
      {allowMultiple && selectedCategories.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">
              Categorías seleccionadas ({selectedCategories.length})
            </span>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              onClick={clearAll}
              className="h-auto p-1 text-xs text-muted-foreground hover:text-foreground"
            >
              Limpiar todas
            </Button>
          </div>
          <div className="flex flex-wrap gap-2">
            {selectedCategoryObjects.map((category) => {
              const parent = parentLookup.get(category.id)
              const colorSource = parent ?? category

              return (
                <SelectedCategoryBadge
                  key={category.id}
                  category={category}
                  colorSource={colorSource}
                  onRemove={(event) => removeCategory(category.id, event)}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

interface CategoryGroupCardProps {
  group: CategoryGroup
  onSelectParent: () => void
  onSelectChild: (categoryId: string) => void
  selectedCategorySet: Set<string>
}

function CategoryGroupCard({ group, onSelectParent, onSelectChild, selectedCategorySet }: CategoryGroupCardProps) {
  const { parent, children } = group
  const { color, textColor, rgbValue } = getCategoryColorTokens(parent)
  const style: CSSProperties = {
    ["--category-color" as string]: color,
    ["--category-text-color" as string]: textColor,
    ["--category-color-rgb" as string]: rgbValue,
  }

  const isParentSelected = selectedCategorySet.has(parent.id)
  const hasChildSelected = children.some((child) => selectedCategorySet.has(child.id))
  const isActive = isParentSelected || hasChildSelected

  return (
    <div
      className={cn(
        "rounded-2xl border border-border/60 bg-[rgba(var(--category-color-rgb),0.08)] p-3 transition-all duration-200",
        "hover:border-[var(--category-color)] hover:bg-[rgba(var(--category-color-rgb),0.12)] hover:shadow-[0_12px_30px_-18px_rgba(var(--category-color-rgb),0.6)]",
        isActive &&
          "border-[var(--category-color)] bg-[rgba(var(--category-color-rgb),0.16)] shadow-[0_16px_40px_-24px_rgba(var(--category-color-rgb),0.7)]",
      )}
      style={style}
    >
      <button
        type="button"
        onClick={onSelectParent}
        className="flex w-full items-center justify-between gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--category-color-rgb),0.45)] focus-visible:ring-offset-2"
      >
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border border-[rgba(var(--category-color-rgb),0.35)] bg-white text-[var(--category-color)] shadow-sm transition-colors",
              "dark:bg-background",
              isParentSelected && "border-transparent bg-[var(--category-color)] text-[var(--category-text-color)]",
            )}
          >
            {isParentSelected ? (
              <Check className="h-4 w-4" />
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-[var(--category-color)]" />
            )}
          </div>
          <span className="flex items-center gap-2 text-sm font-semibold leading-none text-foreground">
            {parent.emoji && <span className="text-base leading-none">{parent.emoji}</span>}
            {parent.nombre}
          </span>
        </div>
        {children.length > 0 && (
          <span className="text-xs font-medium text-muted-foreground">
            {children.length} subcategoría{children.length !== 1 ? "s" : ""}
          </span>
        )}
      </button>

      {children.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 pl-11">
          {children.map((child) => (
            <CategoryChipButton
              key={child.id}
              category={child}
              colorSource={parent}
              selected={selectedCategorySet.has(child.id)}
              onSelect={() => onSelectChild(child.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface CategoryChipButtonProps {
  category: Categoria
  colorSource: Categoria
  selected: boolean
  onSelect: () => void
}

function CategoryChipButton({ category, colorSource, selected, onSelect }: CategoryChipButtonProps) {
  const { color, textColor, rgbValue } = getCategoryColorTokens(colorSource)
  const style: CSSProperties = {
    ["--category-color" as string]: color,
    ["--category-text-color" as string]: textColor,
    ["--category-color-rgb" as string]: rgbValue,
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--category-color-rgb),0.45)] focus-visible:ring-offset-2",
        selected
          ? "border-transparent bg-[var(--category-color)] text-[var(--category-text-color)] shadow-sm"
          : "border-transparent bg-[rgba(var(--category-color-rgb),0.14)] text-[var(--category-color)] hover:bg-[rgba(var(--category-color-rgb),0.22)] dark:bg-[rgba(var(--category-color-rgb),0.18)] dark:hover:bg-[rgba(var(--category-color-rgb),0.26)]",
      )}
      style={style}
    >
      {category.emoji && <span className="text-sm leading-none">{category.emoji}</span>}
      <span className="leading-none">{category.nombre}</span>
      {selected && <Check className="h-3.5 w-3.5" />}
    </button>
  )
}

interface CategorySearchResultProps {
  category: Categoria
  parent?: Categoria
  isSelected: boolean
  onSelect: () => void
}

function CategorySearchResult({ category, parent, isSelected, onSelect }: CategorySearchResultProps) {
  const colorSource = parent ?? category
  const { color, textColor, rgbValue } = getCategoryColorTokens(colorSource)
  const style: CSSProperties = {
    ["--category-color" as string]: color,
    ["--category-text-color" as string]: textColor,
    ["--category-color-rgb" as string]: rgbValue,
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl border border-transparent bg-[rgba(var(--category-color-rgb),0.08)] px-4 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--category-color-rgb),0.4)] focus-visible:ring-offset-2",
        "hover:bg-[rgba(var(--category-color-rgb),0.14)]",
        isSelected &&
          "border-[var(--category-color)] bg-[rgba(var(--category-color-rgb),0.16)] shadow-[0_12px_32px_-20px_rgba(var(--category-color-rgb),0.6)]",
      )}
      style={style}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-1">
          <span className="flex items-center gap-2 text-sm font-semibold leading-none">
            {category.emoji && <span className="text-base leading-none">{category.emoji}</span>}
            {category.nombre}
          </span>
          {parent && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              {parent.emoji && <span className="text-sm leading-none">{parent.emoji}</span>}
              {parent.nombre}
            </span>
          )}
        </div>
        {isSelected && (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--category-color)] text-[var(--category-text-color)] shadow-sm">
            <Check className="h-4 w-4" />
          </span>
        )}
      </div>
    </button>
  )
}

interface SelectedCategoryBadgeProps {
  category: Categoria
  colorSource: Categoria
  onRemove: (event: React.MouseEvent<HTMLButtonElement>) => void
}

function SelectedCategoryBadge({ category, colorSource, onRemove }: SelectedCategoryBadgeProps) {
  const { color, textColor, rgbValue } = getCategoryColorTokens(colorSource)
  const style: CSSProperties = {
    ["--category-color" as string]: color,
    ["--category-text-color" as string]: textColor,
    ["--category-color-rgb" as string]: rgbValue,
  }

  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border border-transparent bg-[rgba(var(--category-color-rgb),0.16)] px-3 py-1.5 text-xs font-medium text-[var(--category-color)] shadow-sm transition-colors duration-200 dark:bg-[rgba(var(--category-color-rgb),0.26)]"
      style={style}
    >
      {category.emoji && <span className="text-sm leading-none">{category.emoji}</span>}
      <span className="leading-none">{category.nombre}</span>
      <button
        type="button"
        onClick={onRemove}
        className="flex h-5 w-5 items-center justify-center rounded-full bg-transparent text-[var(--category-color)] transition-colors duration-200 hover:bg-[rgba(var(--category-color-rgb),0.18)] hover:text-[var(--category-text-color)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--category-color-rgb),0.4)] focus-visible:ring-offset-1"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
