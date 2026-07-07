"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { CategoriaPickerDialog } from "./categoria-picker-dialog"
import { DatabaseService } from "@/lib/services/database"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { Categoria } from "@/lib/types/database"
import type {
  Capitulo,
  MapeoConfig,
  MovimientoDescuadre,
  PeriodoTipo,
} from "@/lib/services/memoria-economica"
import {
  CheckCircle2,
  Circle,
  CopyX,
  ExternalLink,
  ListChecks,
  Loader2,
  PartyPopper,
  Plus,
  Tag,
} from "lucide-react"

interface Item extends MovimientoDescuadre {
  arreglado: boolean
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  delegacionId: string
  periodoTipo: PeriodoTipo
  anio: number
  mapeo: MapeoConfig | null
  categorias: Categoria[]
  /** Capítulos del informe con filas libres para "Añadir al informe". */
  capsConFilasLibres: Capitulo[]
  /** Añade una fila con la categoría al capítulo. Devuelve false si no pudo. */
  onAddCategoria: (cap: Capitulo, categoriaId: string) => boolean
  /** El usuario ha cambiado datos (recategorizado): el diálogo debe recalcular. */
  onDatosCambiados: () => void
}

const CAP_ADD_OPTIONS: { cap: Capitulo; label: string }[] = [
  { cap: "IV", label: "Capítulo IV · Actividades" },
  { cap: "V", label: "Capítulo V · Campañas solidarias" },
  { cap: "VI", label: "Capítulo VI · Otros" },
]

function fechaCorta(iso: string): string {
  const d = new Date(iso + "T00:00:00")
  return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short" }).format(d)
}

/** Último día del periodo (fin es exclusivo) para los filtros de Transacciones. */
function diaAntes(iso: string): string {
  const d = new Date(iso + "T00:00:00Z")
  d.setUTCDate(d.getUTCDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function ConciliacionSheet({
  open,
  onOpenChange,
  delegacionId,
  periodoTipo,
  anio,
  mapeo,
  categorias,
  capsConFilasLibres,
  onAddCategoria,
  onDatosCambiados,
}: Props) {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(false)
  const [fixingId, setFixingId] = useState<string | null>(null)
  const [pickerItem, setPickerItem] = useState<Item | null>(null)
  const [periodo, setPeriodo] = useState<{ inicio: string; fin: string } | null>(null)

  const fetchSeq = useRef(0)

  const refresh = useCallback(
    async (opts: { reset?: boolean } = {}) => {
      if (!mapeo) return
      const seq = ++fetchSeq.current
      if (opts.reset) {
        setItems([])
        setLoading(true)
      }
      try {
        const res = await fetch("/api/informes/descuadres", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ delegacionId, periodoTipo, anio, mapeo }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || "Error cargando los descuadres")
        if (seq !== fetchSeq.current) return
        const nuevos = (data.movimientos ?? []) as MovimientoDescuadre[]
        setPeriodo(data.periodo ?? null)
        setItems((prev) => {
          if (opts.reset || prev.length === 0) {
            return nuevos.map((n) => ({ ...n, arreglado: false }))
          }
          // Conservar la lista original para poder "tachar": lo que ya no
          // aparece está arreglado; lo que sigue se actualiza (p. ej. nueva
          // categoría tras recategorizar); lo nuevo se añade al final.
          const nuevoById = new Map(nuevos.map((n) => [n.id, n]))
          const conocidos = new Set(prev.map((p) => p.id))
          const conservados = prev.map((p) => {
            const n = nuevoById.get(p.id)
            return n ? { ...n, arreglado: false } : { ...p, arreglado: true }
          })
          const incorporados = nuevos
            .filter((n) => !conocidos.has(n.id))
            .map((n) => ({ ...n, arreglado: false }))
          return [...conservados, ...incorporados]
        })
      } catch (err) {
        if (seq !== fetchSeq.current) return
        console.error(err)
        toast.error(err instanceof Error ? err.message : "Error cargando los descuadres")
      } finally {
        if (seq === fetchSeq.current) setLoading(false)
      }
    },
    [delegacionId, periodoTipo, anio, mapeo],
  )

  // Carga inicial al abrir; refresco (debounced) cuando cambia el mapeo
  // (p. ej. tras "Añadir al informe") para tachar lo que ya quede recogido.
  const openedRef = useRef(false)
  useEffect(() => {
    if (!open) {
      openedRef.current = false
      return
    }
    if (!openedRef.current) {
      openedRef.current = true
      refresh({ reset: true })
      return
    }
    const t = setTimeout(() => refresh(), 400)
    return () => clearTimeout(t)
  }, [open, refresh])

  const recategorizar = async (item: Item, categoriaId: string | null) => {
    setFixingId(item.id)
    try {
      await DatabaseService.updateMovimientoCategoria(item.id, categoriaId)
      toast.success("Movimiento recategorizado")
      onDatosCambiados()
      await refresh()
    } catch (err) {
      console.error(err)
      toast.error("No se pudo recategorizar el movimiento")
    } finally {
      setFixingId(null)
    }
  }

  const catNameById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categorias) m.set(c.id, c.nombre)
    return m
  }, [categorias])

  // Agrupar: categorías sin fila (por categoría, mayor importe primero),
  // luego sin categoría, luego dobles.
  const grupos = useMemo(() => {
    const porCategoria = new Map<string, Item[]>()
    const sinCategoria: Item[] = []
    const dobles: Item[] = []
    for (const it of items) {
      if (it.motivo === "doble_contado") dobles.push(it)
      else if (it.motivo === "sin_categoria") sinCategoria.push(it)
      else {
        const arr = porCategoria.get(it.categoriaId!) ?? []
        arr.push(it)
        porCategoria.set(it.categoriaId!, arr)
      }
    }
    const cats = [...porCategoria.entries()]
      .map(([categoriaId, lista]) => ({
        categoriaId,
        nombre: lista[0].categoriaNombre ?? catNameById.get(categoriaId) ?? "Categoría",
        items: lista,
        pendiente: lista.reduce((s, i) => s + (i.arreglado ? 0 : Math.abs(i.importe)), 0),
      }))
      .sort((a, b) => b.pendiente - a.pendiente)
    return { cats, sinCategoria, dobles }
  }, [items, catNameById])

  const total = items.length
  const arreglados = items.filter((i) => i.arreglado).length
  const todoConciliado = total > 0 && arreglados === total

  const desde = periodo?.inicio
  const hasta = periodo ? diaAntes(periodo.fin) : undefined
  const rangoQS = desde && hasta ? `&desde=${desde}&hasta=${hasta}` : ""

  const renderItem = (item: Item) => {
    const arreglando = fixingId === item.id
    const puedeRecategorizar = !item.arreglado && item.motivo !== "doble_contado"
    return (
      <div
        key={item.id}
        className={cn(
          "flex items-center gap-2.5 rounded-lg border bg-background px-2.5 py-2 transition-all duration-300",
          item.arreglado && "border-emerald-200 bg-emerald-50/40 opacity-70 dark:border-emerald-900 dark:bg-emerald-900/10",
        )}
      >
        {item.arreglado ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
        ) : arreglando ? (
          <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <Circle className="h-4 w-4 shrink-0 text-muted-foreground/40" />
        )}
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              "truncate text-sm",
              item.arreglado && "text-muted-foreground line-through decoration-emerald-500/60",
            )}
            title={item.concepto}
          >
            {item.concepto || "(sin concepto)"}
          </p>
          <p className="text-[11px] text-muted-foreground">
            {fechaCorta(item.fecha)}
            {item.motivo === "doble_contado" && ` · contado ${item.veces} veces`}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 text-sm font-semibold tabular-nums",
            item.importe >= 0 ? "text-emerald-600" : "text-red-500",
            item.arreglado && "line-through opacity-60",
          )}
        >
          {formatCurrency(item.importe)}
        </span>
        {puedeRecategorizar && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-foreground"
            title="Recategorizar este movimiento"
            disabled={arreglando}
            onClick={() => setPickerItem(item)}
          >
            <Tag className="h-4 w-4" />
          </Button>
        )}
      </div>
    )
  }

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
          <SheetHeader className="space-y-1 border-b p-4 pr-12 text-left">
            <SheetTitle className="flex items-center gap-2 text-base">
              <ListChecks className="h-5 w-5 text-primary" /> Conciliar movimientos
            </SheetTitle>
            <SheetDescription>
              Movimientos del periodo que el informe no recoge (o cuenta dos veces). Arréglalos y
              se irán tachando.
            </SheetDescription>
            {total > 0 && (
              <div className="pt-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium">
                    {arreglados}/{total} conciliados
                  </span>
                  {loading && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-emerald-500 transition-all duration-500"
                    style={{ width: `${total ? (arreglados / total) * 100 : 0}%` }}
                  />
                </div>
              </div>
            )}
          </SheetHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
            {loading && items.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando descuadres…
              </div>
            ) : total === 0 ? (
              <div className="flex flex-col items-center gap-2 py-10 text-center">
                <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                <p className="text-sm font-medium">No hay nada que conciliar</p>
                <p className="text-xs text-muted-foreground">
                  Todos los movimientos del periodo están recogidos en el informe.
                </p>
              </div>
            ) : (
              <>
                {todoConciliado && (
                  <div className="flex items-center gap-2.5 rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm font-medium text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300">
                    <PartyPopper className="h-5 w-5 shrink-0" />
                    ¡Todo conciliado! El informe ya recoge todos los movimientos.
                  </div>
                )}

                {/* 1. Categorías que no están en el informe */}
                {grupos.cats.map((g) => (
                  <div key={g.categoriaId} className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {g.nombre}
                        <span className="ml-1.5 font-normal normal-case">
                          · sin fila en el informe
                        </span>
                      </p>
                      <div className="flex shrink-0 items-center gap-1">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-7 gap-1 px-2 text-xs"
                              disabled={
                                g.items.every((i) => i.arreglado) || capsConFilasLibres.length === 0
                              }
                            >
                              <Plus className="h-3.5 w-3.5" /> Añadir al informe
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-64 p-1.5">
                            <p className="px-2 py-1.5 text-xs text-muted-foreground">
                              Crear una fila con «{g.nombre}» en:
                            </p>
                            {CAP_ADD_OPTIONS.map((o) => (
                              <Button
                                key={o.cap}
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="w-full justify-start text-xs"
                                disabled={!capsConFilasLibres.includes(o.cap)}
                                onClick={() => {
                                  if (onAddCategoria(o.cap, g.categoriaId)) {
                                    toast.success(`«${g.nombre}» añadida al capítulo ${o.cap}`)
                                  }
                                }}
                              >
                                {o.label}
                                {!capsConFilasLibres.includes(o.cap) && (
                                  <span className="ml-auto text-[10px] text-muted-foreground">
                                    sin filas libres
                                  </span>
                                )}
                              </Button>
                            ))}
                          </PopoverContent>
                        </Popover>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0 text-muted-foreground"
                          title="Ver en Transacciones (nueva pestaña)"
                          asChild
                        >
                          <a
                            href={`/transacciones?categorias=${g.categoriaId}${rangoQS}`}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1.5">{g.items.map(renderItem)}</div>
                  </div>
                ))}

                {/* 2. Sin categoría */}
                {grupos.sinCategoria.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Sin categoría
                        <span className="ml-1.5 font-normal normal-case">
                          · etiquétalos para que entren
                        </span>
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 shrink-0 p-0 text-muted-foreground"
                        title="Ver en Transacciones (nueva pestaña)"
                        asChild
                      >
                        <a
                          href={`/transacciones?uncategorized=1${rangoQS}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </Button>
                    </div>
                    <div className="space-y-1.5">{grupos.sinCategoria.map(renderItem)}</div>
                  </div>
                )}

                {/* 3. Contados dos veces */}
                {grupos.dobles.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <CopyX className="h-3.5 w-3.5" /> Contados más de una vez
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Una categoría madre y su subcategoría están en filas distintas del informe.
                      Quita una de las dos filas en el paso de revisión.
                    </p>
                    <div className="space-y-1.5">{grupos.dobles.map(renderItem)}</div>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="border-t p-3">
            <Button type="button" variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
              Volver al informe
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <CategoriaPickerDialog
        open={!!pickerItem}
        onOpenChange={(o) => {
          if (!o) setPickerItem(null)
        }}
        categories={categorias}
        selectedId={pickerItem?.categoriaId ?? null}
        disabledIds={[]}
        onSelect={(id) => {
          if (pickerItem) recategorizar(pickerItem, id)
        }}
        title="Recategorizar movimiento"
        subtitle={pickerItem ? `${pickerItem.concepto} · ${formatCurrency(pickerItem.importe)}` : undefined}
      />
    </>
  )
}
