"use client"

import { useMemo, useState } from "react"
import { ChevronRight, Loader2, SearchX } from "lucide-react"
import { DateRangeFilter } from "@/components/transactions/date-range-filter"
import { CategorySelector } from "@/components/transactions/category-selector"
import { EmptyState } from "@/components/ui/empty-state"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { ListHeaderRow, ListRow } from "@/components/ui/list-row"
import { cn } from "@/lib/utils"
import { useSaldoContactos } from "@/hooks/use-saldo-contactos"
import { formatCurrency } from "@/lib/utils/format"
import { CONTACTO_TIPO_DEFAULT_EMOJIS } from "@/lib/utils/contacto-tipos"
import type { Categoria, ContactoConCategoriaPredeterminada } from "@/lib/types/database"
import { nombreEfectivoContacto } from "@/lib/types/database"
import { ProveedorMovimientosSheet } from "./proveedor-movimientos-sheet"

/** Plantilla de columnas compartida entre la cabecera y las filas (lg+). */
const SALDO_COLS = "lg:grid-cols-[minmax(0,1.6fr)_4rem_minmax(0,1.4fr)_minmax(0,7rem)_1.25rem]"

interface ProveedoresSaldosProps {
  delegacionId: string | null
  contactos: ContactoConCategoriaPredeterminada[]
  categorias: Pick<Categoria, "id" | "nombre" | "emoji" | "color" | "tipo">[]
}

/**
 * Saldo por proveedor: a quién le paga la delegación, cuánto, y en qué
 * actividad. Ordenado por gasto, porque la pregunta es siempre "¿quién se lleva
 * el dinero?" y no "¿quién va primero por orden alfabético?".
 *
 * Arranca en el curso actual en vez de "desde el inicio": un saldo por proveedor
 * de todos los años juntos no responde a nada que se pueda hacer hoy.
 */
export function ProveedoresSaldos({ delegacionId, contactos, categorias }: ProveedoresSaldosProps) {
  const cursoActual = useMemo(() => rangoCursoActual(), [])
  const [desde, setDesde] = useState<string | undefined>(cursoActual.desde)
  const [hasta, setHasta] = useState<string | undefined>(cursoActual.hasta)
  const [categoriasFiltro, setCategoriasFiltro] = useState<string[]>([])
  const [abierto, setAbierto] = useState<ContactoConCategoriaPredeterminada | null>(null)

  const { saldos, totales, gastoMaximo, loading, error } = useSaldoContactos(delegacionId, {
    desde,
    hasta,
    categorias: categoriasFiltro,
  })

  const contactosPorId = useMemo(() => {
    const mapa = new Map<string, ContactoConCategoriaPredeterminada>()
    for (const c of contactos) mapa.set(c.id, c)
    return mapa
  }, [contactos])

  const categoriasPorId = useMemo(() => {
    const mapa = new Map<string, ProveedoresSaldosProps["categorias"][number]>()
    for (const c of categorias) mapa.set(c.id, c)
    return mapa
  }, [categorias])

  return (
    <div className="space-y-4">
      {/* Filtros: los dos componentes que ya usa Movimientos, sin reinventarlos */}
      <div className="flex flex-col gap-3 rounded-xl border border-border/40 bg-card/40 p-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <DateRangeFilter
            dateFrom={desde}
            dateTo={hasta}
            defaultPreset="this-school-year"
            onDateRangeChange={(nuevoDesde, nuevoHasta) => {
              setDesde(nuevoDesde)
              setHasta(nuevoHasta)
            }}
          />
        </div>
        <div className="min-w-0 flex-1">
          <CategorySelector
            categories={categorias as Categoria[]}
            selectedCategories={categoriasFiltro}
            onSelectionChange={setCategoriasFiltro}
            allowMultiple
            placeholder="Todas las actividades"
          />
        </div>
      </div>

      {loading && saldos.length === 0 ? (
        <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Calculando saldos…
        </div>
      ) : error ? (
        <EmptyState title="No se pudo calcular el saldo por proveedor" description={error} />
      ) : saldos.length === 0 ? (
        <EmptyState
          icon={<SearchX className="h-6 w-6" />}
          title="Ningún movimiento con proveedor en este periodo"
          description="Vincula proveedores a tus movimientos, o amplía las fechas, y aquí verás cuánto va a cada uno."
        />
      ) : (
        <div className="space-y-1">
          <ListHeaderRow className={SALDO_COLS}>
            <span>Proveedor</span>
            <span className="text-right">Movs</span>
            <span>Actividad principal</span>
            <span className="text-right">Gasto</span>
            <span />
          </ListHeaderRow>

          {saldos.map((fila) => {
            const contacto = contactosPorId.get(fila.contacto_id)
            const categoria = fila.categoria_principal_id ? categoriasPorId.get(fila.categoria_principal_id) : undefined
            const gastos = Number(fila.gastos)
            const ingresos = Number(fila.ingresos)
            // Proporción sobre el proveedor que más gasta: así el ranking se lee
            // sin comparar cifras a ojo.
            const proporcion = gastoMaximo > 0 ? Math.max(2, Math.round((gastos / gastoMaximo) * 100)) : 0

            return (
              <ListRow
                key={fila.contacto_id}
                onClick={() => contacto && setAbierto(contacto)}
                className={cn("lg:grid lg:items-center lg:gap-3", SALDO_COLS)}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <EntityAvatar
                    name={contacto?.nombre ?? "—"}
                    emoji={contacto?.emoji}
                    defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
                    colorHex={contacto?.color}
                    logoUrl={contacto?.logo_url}
                    size="sm"
                    seed={`contacto:${fila.contacto_id}`}
                  />
                  <span className="truncate text-sm font-semibold tracking-tight">
                    {contacto ? nombreEfectivoContacto(contacto) : "Contacto sin ficha"}
                  </span>
                </div>

                <span className="hidden text-right text-xs tabular-nums text-muted-foreground lg:block">
                  {fila.movimientos}
                </span>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {categoria ? (
                      <span className="inline-flex max-w-full items-center gap-1 truncate rounded-full border border-border/60 bg-muted/50 px-2 py-0.5 text-[11px] text-muted-foreground">
                        <span aria-hidden>{categoria.emoji ?? "🏷️"}</span>
                        <span className="truncate">{categoria.nombre}</span>
                      </span>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">Sin categoría</span>
                    )}
                    <span className="text-[11px] text-muted-foreground lg:hidden">· {fila.movimientos} movs</span>
                  </div>
                  <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-red-500/50" style={{ width: `${proporcion}%` }} />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2 lg:block lg:text-right">
                  <span className="text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">
                    {gastos > 0 ? `−${formatCurrency(gastos)}` : formatCurrency(0)}
                  </span>
                  {ingresos > 0 && (
                    <span className="block text-[11px] tabular-nums text-emerald-600 dark:text-emerald-400">
                      +{formatCurrency(ingresos)}
                    </span>
                  )}
                </div>

                <ChevronRight className="hidden h-4 w-4 shrink-0 text-muted-foreground lg:block" />
              </ListRow>
            )
          })}

          {/* Fila de totales: un recuento sin total no está terminado. */}
          <div
            className={cn(
              "mt-1 flex items-center justify-between gap-3 border-t border-border px-3 pt-2 lg:grid lg:items-center",
              SALDO_COLS,
            )}
          >
            <span className="text-xs font-semibold">
              {totales.contactos} {totales.contactos === 1 ? "proveedor" : "proveedores"}
            </span>
            <span className="hidden text-right text-xs tabular-nums text-muted-foreground lg:block">
              {totales.movimientos}
            </span>
            <span className="hidden lg:block" />
            <div className="lg:text-right">
              <span className="text-sm font-bold tabular-nums text-red-600 dark:text-red-400">
                −{formatCurrency(totales.gastos)}
              </span>
              {totales.ingresos > 0 && (
                <span className="block text-[11px] tabular-nums text-emerald-600 dark:text-emerald-400">
                  +{formatCurrency(totales.ingresos)}
                </span>
              )}
            </div>
            <span className="hidden lg:block" />
          </div>
        </div>
      )}

      <ProveedorMovimientosSheet
        contacto={abierto}
        delegacionId={delegacionId}
        desde={desde}
        hasta={hasta}
        categorias={categoriasFiltro}
        open={Boolean(abierto)}
        onOpenChange={(open) => !open && setAbierto(null)}
      />
    </div>
  )
}

/**
 * Curso escolar en marcha, de septiembre a agosto. Es el mismo criterio que el
 * preset "Este curso escolar" del filtro de fechas; se repite aquí porque el
 * estado inicial se necesita antes de que ese componente se monte.
 */
function rangoCursoActual(): { desde: string; hasta: string } {
  const hoy = new Date()
  const anio = hoy.getFullYear()
  // Antes de septiembre, el curso en marcha empezó el septiembre anterior.
  const anioInicio = hoy.getMonth() < 8 ? anio - 1 : anio
  return {
    desde: `${anioInicio}-09-01`,
    hasta: `${anioInicio + 1}-08-31`,
  }
}
