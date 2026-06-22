"use client"

import type React from "react"

import { useState, useMemo, useEffect, useRef, type CSSProperties } from "react"
import { Check, ChevronsUpDown, X, Search, Plus, CheckCheck } from "lucide-react"
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
  /** Categorías a mostrar en gris y no seleccionables (p. ej. ya usadas en otro sitio). */
  disabledCategoryIds?: string[]
  /** Texto opcional bajo el aviso de categorías deshabilitadas. */
  hideCreateButton?: boolean
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
  disabledCategoryIds,
  hideCreateButton = false,
}: CategorySelectorProps) {
  const disabledCategorySet = useMemo(() => new Set(disabledCategoryIds ?? []), [disabledCategoryIds])
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const [searchValue, setSearchValue] = useState("")
  const searchInputRef = useRef<HTMLInputElement>(null)
  const normalizedSearch = searchValue.trim().toLowerCase()

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

  // Reset del buscador al abrir, ajustando estado durante el render comparando
  // con el valor previo (patrón "adjust state when a prop changes", sin efecto).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setSearchValue("")
  }

  // El efecto solo hace foco (side-effect de DOM), no toca estado.
  useEffect(() => {
    if (!open || !focusSearchOnOpen) {
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

  const selectedCategorySet = useMemo(() => new Set(selectedCategories), [selectedCategories])

  const handleSelect = (categoryId: string) => {
    if (disabledCategorySet.has(categoryId)) return
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

  const allCategoryIds = useMemo(() => categories.map((cat) => cat.id), [categories])
  const allSelected =
    allowMultiple && allCategoryIds.length > 0 && allCategoryIds.every((id) => selectedCategorySet.has(id))

  const toggleAll = () => {
    onSelectionChange(allSelected ? [] : allCategoryIds)
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
            className="w-full justify-between bg-background border-border hover:bg-muted/50 h-9"
          >
            <span className="truncate text-sm">
              {selectedCategories.length === 0
                ? placeholder
                : allowMultiple
                  ? `${selectedCategories.length} categoría${selectedCategories.length !== 1 ? "s" : ""} seleccionada${selectedCategories.length !== 1 ? "s" : ""}`
                  : selectedCategoryObjects[0]?.nombre || "Categoría seleccionada"}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-[calc(100vw-2rem)] sm:w-[380px] p-0"
          align="start"
          side="bottom"
          sideOffset={6}
          avoidCollisions={false}
        >
          <div className="border-b p-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
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
                className="h-9 bg-background pl-9"
                ref={searchInputRef}
              />
            </div>
          </div>
          <ScrollArea className="h-[min(45vh,340px)]">
            <div className="space-y-3 p-3">
              {normalizedSearch ? (
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
                      isDisabled={disabledCategorySet.has(category.id)}
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
                      disabledCategorySet={disabledCategorySet}
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
                              disabled={disabledCategorySet.has(category.id)}
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
          <div className="border-t p-3 space-y-2">
            {allowMultiple && (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  type="button"
                  onClick={toggleAll}
                  className="h-9 flex-1 bg-transparent"
                >
                  <CheckCheck className="mr-2 h-4 w-4" />
                  {allSelected ? "Quitar todas" : "Seleccionar todas"}
                </Button>
                {selectedCategories.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    type="button"
                    onClick={clearAll}
                    className="h-9 flex-1 bg-transparent text-muted-foreground hover:text-foreground"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Limpiar ({selectedCategories.length})
                  </Button>
                )}
              </div>
            )}
            {!hideCreateButton && (
              <Button variant="outline" size="sm" className="h-9 w-full bg-transparent" type="button">
                <Plus className="mr-2 h-4 w-4" />
                Crear nueva categoría
              </Button>
            )}
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
  disabledCategorySet?: Set<string>
}

function CategoryGroupCard({ group, onSelectParent, onSelectChild, selectedCategorySet, disabledCategorySet }: CategoryGroupCardProps) {
  const disabledSet = disabledCategorySet ?? new Set<string>()
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
        "rounded-2xl border border-border/60 bg-[rgba(var(--category-color-rgb),0.08)] p-3 transition-[border-color,background-color,box-shadow] duration-200",
        "hover:border-[var(--category-color)] hover:bg-[rgba(var(--category-color-rgb),0.12)] hover:shadow-[0_12px_30px_-18px_rgba(var(--category-color-rgb),0.6)]",
        isActive &&
          "border-[var(--category-color)] bg-[rgba(var(--category-color-rgb),0.16)] shadow-[0_16px_40px_-24px_rgba(var(--category-color-rgb),0.7)]",
      )}
      style={style}
    >
      <button
        type="button"
        onClick={onSelectParent}
        disabled={disabledSet.has(parent.id)}
        className={cn(
          "flex w-full items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--category-color-rgb),0.45)] focus-visible:ring-offset-2",
          disabledSet.has(parent.id) && "cursor-not-allowed opacity-40",
        )}
        title={disabledSet.has(parent.id) ? "Ya asignada en otra fila" : undefined}
      >
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[rgba(var(--category-color-rgb),0.25)] transition-colors shadow-sm",
            isParentSelected
              ? "border-transparent bg-[var(--category-color)] text-[var(--category-text-color)]"
              : "bg-[rgba(var(--category-color-rgb),0.1)] text-[var(--category-color)] dark:bg-[rgba(var(--category-color-rgb),0.2)]",
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
      </button>

      {children.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2 pl-11">
          {children.map((child) => (
            <CategoryChipButton
              key={child.id}
              category={child}
              colorSource={parent}
              selected={selectedCategorySet.has(child.id)}
              disabled={disabledSet.has(child.id)}
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
  disabled?: boolean
}

function CategoryChipButton({ category, colorSource, selected, onSelect, disabled = false }: CategoryChipButtonProps) {
  const { color, textColor, rgbValue } = getCategoryColorTokens(colorSource)
  const style: CSSProperties = {
    ["--category-color" as string]: color,
    ["--category-text-color" as string]: textColor,
    ["--category-color-rgb" as string]: rgbValue,
  }

  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
      disabled={disabled}
      title={disabled ? "Ya asignada en otra fila" : undefined}
      className={cn(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-[color,background-color,border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--category-color-rgb),0.45)] focus-visible:ring-offset-2",
        selected
          ? "border-transparent bg-[var(--category-color)] text-[var(--category-text-color)] shadow-sm"
          : "border-[rgba(var(--category-color-rgb),0.35)] bg-[rgba(var(--category-color-rgb),0.25)] text-[var(--category-color)] hover:bg-[rgba(var(--category-color-rgb),0.35)] shadow-sm dark:bg-[rgba(var(--category-color-rgb),0.18)] dark:hover:bg-[rgba(var(--category-color-rgb),0.26)] dark:border-transparent dark:shadow-none",
        disabled && "cursor-not-allowed opacity-40 grayscale hover:bg-[rgba(var(--category-color-rgb),0.25)]",
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
  isDisabled?: boolean
  onSelect: () => void
}

function CategorySearchResult({ category, parent, isSelected, isDisabled = false, onSelect }: CategorySearchResultProps) {
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
      disabled={isDisabled}
      title={isDisabled ? "Ya asignada en otra fila" : undefined}
      className={cn(
        "w-full rounded-2xl border border-transparent bg-[rgba(var(--category-color-rgb),0.08)] px-4 py-3 text-left transition-[color,background-color,border-color,box-shadow] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgba(var(--category-color-rgb),0.4)] focus-visible:ring-offset-2",
        "hover:bg-[rgba(var(--category-color-rgb),0.14)]",
        isSelected &&
          "border-[var(--category-color)] bg-[rgba(var(--category-color-rgb),0.16)] shadow-[0_12px_32px_-20px_rgba(var(--category-color-rgb),0.6)]",
        isDisabled && "cursor-not-allowed opacity-40 grayscale hover:bg-[rgba(var(--category-color-rgb),0.08)]",
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
      className="inline-flex items-center gap-2 rounded-full border border-[rgba(var(--category-color-rgb),0.35)] px-3 py-1.5 text-xs font-semibold shadow-sm transition-colors duration-200 bg-[rgba(var(--category-color-rgb),0.25)] text-[var(--category-color)] dark:bg-[rgba(var(--category-color-rgb),0.2)] dark:border-[rgba(var(--category-color-rgb),0.4)]"
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
