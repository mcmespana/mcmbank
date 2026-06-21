"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { getCategoryColorTokens } from "@/lib/utils/category-colors"
import { cn } from "@/lib/utils"
import type { Categoria } from "@/lib/types/database"
import { Check, Search, X, Ban } from "lucide-react"

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  categories: Categoria[]
  selectedId: string | null
  /** Categorías ya usadas en otras filas: se muestran en gris y no seleccionables. */
  disabledIds: string[]
  onSelect: (id: string | null) => void
  title?: string
  subtitle?: string
}

function norm(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

export function CategoriaPickerDialog({
  open,
  onOpenChange,
  categories,
  selectedId,
  disabledIds,
  onSelect,
  title = "Elegir categoría",
  subtitle,
}: Props) {
  const [search, setSearch] = useState("")
  const disabledSet = useMemo(() => new Set(disabledIds), [disabledIds])
  const scrollRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  // Reset búsqueda al abrir (patrón "ajustar estado al cambiar prop", sin efecto).
  const [prevOpen, setPrevOpen] = useState(open)
  if (open !== prevOpen) {
    setPrevOpen(open)
    if (open) setSearch("")
  }

  // Al abrir, llevar el scroll a la categoría seleccionada.
  useEffect(() => {
    if (!open || !selectedId) return
    const frame = requestAnimationFrame(() => {
      selectedRef.current?.scrollIntoView({ block: "center" })
    })
    return () => cancelAnimationFrame(frame)
  }, [open, selectedId])

  const { groups, orphans } = useMemo(() => {
    const parents = categories.filter((c) => !c.categoria_padre_id)
    const childMap = new Map<string, Categoria[]>()
    for (const c of categories) {
      if (!c.categoria_padre_id) continue
      const arr = childMap.get(c.categoria_padre_id) ?? []
      arr.push(c)
      childMap.set(c.categoria_padre_id, arr)
    }
    const sortByName = (a: Categoria, b: Categoria) => a.nombre.localeCompare(b.nombre, "es")
    const parentIds = new Set(parents.map((p) => p.id))
    const groups = parents
      .sort(sortByName)
      .map((parent) => ({ parent, children: (childMap.get(parent.id) ?? []).sort(sortByName) }))
    const orphans = categories
      .filter((c) => c.categoria_padre_id && !parentIds.has(c.categoria_padre_id))
      .sort(sortByName)
    return { groups, orphans }
  }, [categories])

  const q = norm(search.trim())
  const matches = (c: Categoria) => !q || norm(c.nombre).includes(q)

  const handlePick = (id: string) => {
    if (disabledSet.has(id)) return
    onSelect(id)
    onOpenChange(false)
  }

  const renderChip = (cat: Categoria, colorSource: Categoria) => {
    const { color, textColor, rgbValue } = getCategoryColorTokens(colorSource, categories)
    const style: CSSProperties = {
      ["--cat" as string]: color,
      ["--cat-text" as string]: textColor,
      ["--cat-rgb" as string]: rgbValue,
    }
    const isSelected = cat.id === selectedId
    const isDisabled = disabledSet.has(cat.id) && !isSelected
    return (
      <button
        key={cat.id}
        type="button"
        ref={isSelected ? selectedRef : undefined}
        onClick={() => handlePick(cat.id)}
        disabled={isDisabled}
        title={isDisabled ? "Ya asignada en otra fila" : undefined}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-all",
          isSelected
            ? "border-transparent bg-[var(--cat)] text-[var(--cat-text)] shadow-md ring-2 ring-[var(--cat)] ring-offset-2"
            : "border-[rgba(var(--cat-rgb),0.35)] bg-[rgba(var(--cat-rgb),0.18)] text-[var(--cat)] hover:bg-[rgba(var(--cat-rgb),0.3)] dark:border-transparent",
          isDisabled && "cursor-not-allowed border-dashed opacity-40 grayscale hover:bg-[rgba(var(--cat-rgb),0.18)]",
        )}
        style={style}
      >
        {cat.emoji && <span className="leading-none">{cat.emoji}</span>}
        <span className="leading-none">{cat.nombre}</span>
        {isSelected && <Check className="h-3.5 w-3.5" />}
        {isDisabled && <Ban className="h-3 w-3" />}
      </button>
    )
  }

  const visibleGroups = groups.filter(
    (g) => matches(g.parent) || g.children.some(matches),
  )
  const visibleOrphans = orphans.filter(matches)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-w-3xl flex-col gap-0 p-0">
        <DialogHeader className="space-y-2 border-b p-4">
          <DialogTitle>{title}</DialogTitle>
          {subtitle && <DialogDescription>{subtitle}</DialogDescription>}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              autoFocus
              placeholder="Buscar categoría…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-10 pl-9"
            />
          </div>
          {disabledIds.length > 0 && (
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Ban className="h-3 w-3" /> Las atenuadas ya están asignadas en otra fila.
            </p>
          )}
        </DialogHeader>

        {/* Scroll nativo: la rueda del ratón funciona sin problemas */}
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          {visibleGroups.length === 0 && visibleOrphans.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No se encontraron categorías</p>
          ) : (
            <>
              {visibleGroups.map(({ parent, children }) => {
                const { color, rgbValue } = getCategoryColorTokens(parent, categories)
                const headStyle: CSSProperties = {
                  ["--cat" as string]: color,
                  ["--cat-rgb" as string]: rgbValue,
                }
                const visibleChildren = q ? children.filter(matches) : children
                return (
                  <div
                    key={parent.id}
                    className="rounded-xl border border-[rgba(var(--cat-rgb),0.3)] bg-[rgba(var(--cat-rgb),0.06)] p-3"
                    style={headStyle}
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[var(--cat)]" />
                      {parent.emoji && <span className="text-base leading-none">{parent.emoji}</span>}
                      <span className="text-sm font-semibold">{parent.nombre}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 pl-1">
                      {/* el propio padre también es seleccionable */}
                      {renderChip(parent, parent)}
                      {visibleChildren.map((child) => renderChip(child, parent))}
                    </div>
                  </div>
                )
              })}

              {visibleOrphans.length > 0 && (
                <div className="rounded-xl border p-3">
                  <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Otras categorías</p>
                  <div className="flex flex-wrap gap-2">
                    {visibleOrphans.map((c) => renderChip(c, c))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t p-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onSelect(null)
              onOpenChange(false)
            }}
            className="text-muted-foreground"
          >
            <X className="mr-1.5 h-4 w-4" /> Sin categoría
          </Button>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
