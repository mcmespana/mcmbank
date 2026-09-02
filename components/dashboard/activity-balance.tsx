"use client"

import { memo, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { DashboardFilters } from "@/components/dashboard/dashboard-filters"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useCategorias } from "@/hooks/use-categorias"
import { useContactos } from "@/hooks/use-contactos"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useDebouncedCategoryFilter } from "@/hooks/use-debounced-state"
import {
  TrendingUp,
  TrendingDown,
  Scale,
  SearchX,
  LineChart as LineChartIcon,
  ListOrdered,
  ArrowUpRight,
} from "lucide-react"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  LineChart,
  Line,
} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { EmptyState } from "@/components/ui/empty-state"
import {
  format,
  eachWeekOfInterval,
  eachMonthOfInterval,
  eachYearOfInterval,
  parseISO,
  differenceInMonths,
  differenceInYears,
} from "date-fns"
import { es } from "date-fns/locale"
import { formatCurrency, toLocalDateString } from "@/lib/utils/format"
import { Table, TableHeader, TableHead, TableRow, TableCell, TableBody } from "@/components/ui/table"
import { buildExpandedCategoryIds } from "@/lib/utils/category-utils"
import { cn } from "@/lib/utils"

interface Props {
  from: string
  to: string
  resetToken?: number
}

const MOVEMENTS_PREVIEW_LIMIT = 30

// from/to/resetToken son primitivos: memo evita recalcular esta vista pesada
// cuando el dashboard padre re-renderiza por otro motivo.
export const ActivityBalanceDashboard = memo(function ActivityBalanceDashboard({
  from,
  to,
  resetToken,
}: Props) {
  const { selectedDelegation } = useDelegationContext()
  const [isLoaded, setIsLoaded] = useState(false)

  const { categoryIds, selectedCategories, setCategoryIds, isPending } = useDebouncedCategoryFilter([])
  const [contactoId, setContactoId] = useState<string | null>(null)

  const { categorias } = useCategorias(selectedDelegation)
  const { contactos } = useContactos(selectedDelegation)
  const expandedCategoryIds = useMemo(
    () => buildExpandedCategoryIds(categoryIds, categorias),
    [categoryIds, categorias],
  )

  // Todos los movimientos del periodo (con filtro de categorías a nivel de DB)
  const { movimientos } = useMovimientos(
    selectedDelegation,
    {
      fechaDesde: from,
      fechaHasta: to,
      categoriaIds: expandedCategoryIds.length > 0 ? expandedCategoryIds : undefined,
      contactoIds: contactoId ? [contactoId] : undefined,
    },
    { pageSize: 0 },
  )

  // Persistencia del filtro
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("mcmbank-dashboard-balance-categories")
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          setCategoryIds(parsed)
        }
      }
    } catch (error) {
      console.warn("Error loading categories from local storage", error)
    } finally {
      setIsLoaded(true)
    }
  }, [setCategoryIds])

  useEffect(() => {
    if (!isLoaded) return
    try {
      window.localStorage.setItem("mcmbank-dashboard-balance-categories", JSON.stringify(selectedCategories))
    } catch (error) {
      console.warn("Error saving categories to local storage", error)
    }
  }, [selectedCategories, isLoaded])

  useEffect(() => {
    if (!resetToken) return
    setCategoryIds([])
    setContactoId(null)
  }, [resetToken, setCategoryIds])

  const summary = useMemo(() => {
    let ingresos = 0
    let gastos = 0
    for (const m of movimientos) {
      if (m.importe > 0) ingresos += m.importe
      else gastos += Math.abs(m.importe)
    }
    return { ingresos, gastos, balance: ingresos - gastos }
  }, [movimientos])

  // Evolución temporal con saldo acumulado de la selección
  const timelineData = useMemo(() => {
    if (movimientos.length === 0) return []

    const firstTransaction = movimientos.reduce((earliest, current) =>
      current.fecha < earliest.fecha ? current : earliest,
    )
    const lastTransaction = movimientos.reduce((latest, current) =>
      current.fecha > latest.fecha ? current : latest,
    )

    const startDate = parseISO(firstTransaction.fecha)
    const endDate = parseISO(lastTransaction.fecha)

    const monthsDiff = differenceInMonths(endDate, startDate)
    const yearsDiff = differenceInYears(endDate, startDate)

    let intervals: Date[]
    let formatPattern: string

    if (yearsDiff > 5) {
      intervals = eachYearOfInterval({ start: startDate, end: endDate })
      formatPattern = "yyyy"
    } else if (monthsDiff > 6) {
      intervals = eachMonthOfInterval({ start: startDate, end: endDate })
      formatPattern = "MMM yyyy"
    } else if (monthsDiff > 2) {
      intervals = eachWeekOfInterval({ start: startDate, end: endDate }, { step: 2 })
      formatPattern = "dd MMM"
    } else {
      intervals = eachWeekOfInterval({ start: startDate, end: endDate })
      formatPattern = "dd MMM"
    }

    let acumulado = 0
    return intervals.map((interval, index) => {
      const intervalStart = toLocalDateString(interval)
      const nextInterval = intervals[index + 1]
      // El último intervalo incluye hasta el final (<=), los demás hasta el siguiente (<)
      const intervalMovimientos = movimientos.filter((m) =>
        nextInterval
          ? m.fecha >= intervalStart && m.fecha < toLocalDateString(nextInterval)
          : m.fecha >= intervalStart,
      )

      let ingresos = 0
      let gastos = 0
      intervalMovimientos.forEach((m) => {
        if (m.importe > 0) ingresos += m.importe
        else gastos += Math.abs(m.importe)
      })
      acumulado += ingresos - gastos

      return {
        period: format(interval, formatPattern, { locale: es }),
        ingresos,
        gastos,
        acumulado,
      }
    })
  }, [movimientos])

  const chartConfig = {
    ingresos: { label: "Ingresos", color: "#10b981" },
    gastos: { label: "Gastos", color: "#ef4444" },
    acumulado: { label: "Saldo acumulado", color: "oklch(var(--primary))" },
  } satisfies ChartConfig

  const clearFilters = () => {
    setCategoryIds([])
    setContactoId(null)
  }

  const latestMovements = useMemo(
    () => [...movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, MOVEMENTS_PREVIEW_LIMIT),
    [movimientos],
  )

  const hasFilteredMovements = movimientos.length > 0
  const hasFilter = selectedCategories.length > 0 || Boolean(contactoId)

  return (
    <div className="space-y-6">
      <DashboardFilters
        categorias={categorias}
        selectedCategories={selectedCategories}
        onCategoriesChange={setCategoryIds}
        contactos={contactos}
        selectedContacto={contactoId}
        onContactoChange={setContactoId}
        isPending={isPending}
        hint="Sin filtro se muestra todo el periodo. Elige una actividad o un contacto para cuadrarlo."
      />

      {!hasFilteredMovements ? (
        <EmptyState
          title="No se han encontrado movimientos"
          description="Prueba con otro periodo de tiempo o limpia los filtros de categorías."
          icon={<SearchX className="h-6 w-6" />}
        >
          <Button variant="outline" onClick={clearFilters}>
            Limpiar filtros
          </Button>
        </EmptyState>
      ) : (
        <>
          {/* KPIs de la selección */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-full bg-green-100 p-2 dark:bg-green-900/40">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Ingresos</p>
                  <p className="whitespace-nowrap text-xl font-bold tabular-nums text-green-600 dark:text-green-400">
                    {formatCurrency(summary.ingresos)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/40">
                  <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Gastos</p>
                  <p className="whitespace-nowrap text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
                    {formatCurrency(summary.gastos)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="rounded-full bg-muted p-2">
                  <Scale className="h-5 w-5 text-foreground" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">
                    {hasFilter ? "Balance de la selección" : "Balance"}
                  </p>
                  <p
                    className={cn(
                      "whitespace-nowrap text-xl font-bold tabular-nums",
                      summary.balance >= 0
                        ? "text-green-600 dark:text-green-400"
                        : "text-red-600 dark:text-red-400",
                    )}
                  >
                    {summary.balance >= 0 ? "+" : ""}
                    {formatCurrency(summary.balance)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Evolución con saldo acumulado */}
          {timelineData.length > 1 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <LineChartIcon className="h-4 w-4" />
                  Evolución{hasFilter ? " de la selección" : ""}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    con saldo acumulado
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer config={chartConfig} className="h-[320px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={timelineData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="ingresos" stroke="var(--color-ingresos)" strokeWidth={1.5} dot={false} />
                      <Line type="monotone" dataKey="gastos" stroke="var(--color-gastos)" strokeWidth={1.5} dot={false} />
                      <Line
                        type="monotone"
                        dataKey="acumulado"
                        stroke="var(--color-acumulado)"
                        strokeWidth={2.5}
                        dot={{ r: 2 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              </CardContent>
            </Card>
          )}

          {/* Movimientos que componen la selección */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <ListOrdered className="h-4 w-4" />
                  Movimientos{hasFilter ? " de la selección" : ""}
                  <span className="ml-1 text-sm font-normal text-muted-foreground">
                    ({movimientos.length})
                  </span>
                </CardTitle>
                <Button variant="ghost" size="sm" asChild className="gap-1 text-muted-foreground">
                  <Link
                    href={
                      hasFilter
                        ? `/transacciones?categorias=${selectedCategories.join(",")}`
                        : "/transacciones"
                    }
                  >
                    Ver en transacciones
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[64px] sm:w-[90px]">Fecha</TableHead>
                    <TableHead>Concepto</TableHead>
                    <TableHead className="hidden sm:table-cell">Categoría</TableHead>
                    <TableHead className="text-right">Importe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {latestMovements.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground tabular-nums">
                        {/* Sin año en móvil: "dd MMM yy" no cabía junto al importe y
                            empujaba "Importe" fuera de la vista, sin ninguna pista
                            visual de que la tabla se podía desplazar. */}
                        <span className="sm:hidden">{format(parseISO(m.fecha), "dd MMM", { locale: es })}</span>
                        <span className="hidden sm:inline">{format(parseISO(m.fecha), "dd MMM yy", { locale: es })}</span>
                      </TableCell>
                      {/* max-w más ajustado en móvil (antes 320px fijo, más que el
                          ancho total disponible): dejaba "Importe" fuera de pantalla. */}
                      <TableCell className="max-w-[110px] sm:max-w-[320px]">
                        <span className="block truncate font-medium" title={m.concepto}>
                          {m.concepto}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {m.categoria ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                            {m.categoria.emoji && <span>{m.categoria.emoji}</span>}
                            {m.categoria.nombre}
                          </span>
                        ) : (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                            Sin categoría
                          </Badge>
                        )}
                      </TableCell>
                      {/* whitespace-nowrap: sin ella, en tablet (con Categoría ya
                          visible compitiendo por espacio) el importe partía en dos
                          líneas ("-16.200,00" / "€"). Concepto ya trunca con "…", así
                          que es la columna correcta a la que quitarle espacio, no Importe. */}
                      <TableCell
                        className={cn(
                          "whitespace-nowrap text-right font-semibold tabular-nums",
                          m.importe >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400",
                        )}
                      >
                        {m.importe >= 0 ? "+" : ""}
                        {formatCurrency(m.importe)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {movimientos.length > MOVEMENTS_PREVIEW_LIMIT && (
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Mostrando los {MOVEMENTS_PREVIEW_LIMIT} más recientes de {movimientos.length}. Usa &quot;Ver en
                  transacciones&quot; para el listado completo.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
})
