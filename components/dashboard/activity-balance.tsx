"use client"

import { useEffect, useMemo, useState } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CategoryMegaSelector } from "@/components/transactions/category-mega-selector"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useCategorias } from "@/hooks/use-categorias"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useDebouncedCategoryFilter } from "@/hooks/use-debounced-state"
import { TrendingUp, TrendingDown, Wallet, BarChart3, PieChart, Filter } from "lucide-react"
import {
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Cell,
  LineChart,
  Line,
  Pie,
  Tooltip as RechartsTooltip,

} from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchX } from "lucide-react"
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
import { formatCurrency } from "@/lib/utils/format"
import { Badge } from "@/components/ui/badge"
import { buildExpandedCategoryIds } from "@/lib/utils/category-utils"
import { GridStackDashboard } from "./gridstack-dashboard"
import { GridStackWidget } from "./gridstack-widget"
import { ACTIVITY_DEFAULT_LAYOUT } from "@/lib/config/dashboard-layouts"

interface Props {
  from: string
  to: string
  resetToken?: number
  locked: boolean
}

function getWidgetConfig(id: string) {
  return ACTIVITY_DEFAULT_LAYOUT.find((w) => w.id === id)!
}

export function ActivityBalanceDashboard({ from, to, resetToken, locked }: Props) {
  const { selectedDelegation } = useDelegationContext()
  const [isLoaded, setIsLoaded] = useState(false)

  const { categoryIds, selectedCategories, setCategoryIds, isPending } = useDebouncedCategoryFilter([])
  const [selectorOpen, setSelectorOpen] = useState(false)

  const { categorias } = useCategorias(selectedDelegation)
  const expandedCategoryIds = useMemo(
    () => buildExpandedCategoryIds(categoryIds, categorias),
    [categoryIds, categorias],
  )

  const { movimientos } = useMovimientos(
    selectedDelegation,
    {
      fechaDesde: from,
      fechaHasta: to,
      categoriaIds: expandedCategoryIds.length > 0 ? expandedCategoryIds : undefined,
    },
    { pageSize: 0 }
  )

  useEffect(() => {
    const loadFromStorage = () => {
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
    }

    loadFromStorage()
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

  const donutData = [
    { name: "Ingresos", value: summary.ingresos, fill: "#10b981" },
    { name: "Gastos", value: summary.gastos, fill: "#ef4444" },
  ]

  const DonutTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
    if (!active || !payload?.length) return null
    const data = payload[0].payload as { name: string; value: number; fill: string }
    const total = summary.ingresos + summary.gastos
    const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : "0.0"

    return (
      <div className="grid gap-2 rounded-md border bg-background p-3 text-sm shadow-lg">
        <div className="font-medium flex items-center gap-2">
          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: data.fill }} />
          {data.name}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          {formatCurrency(data.value)}
          <Badge variant="secondary" className="text-xs">
            {percentage}%
          </Badge>
        </div>
      </div>
    )
  }

  const monthlyData = useMemo(() => {
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

    return intervals.map((interval) => {
      const intervalStart = interval.toISOString().split("T")[0]
      const nextInterval = intervals[intervals.indexOf(interval) + 1]
      const intervalEnd = nextInterval ? nextInterval.toISOString().split("T")[0] : endDate.toISOString().split("T")[0]

      const intervalMovimientos = movimientos.filter((m) => m.fecha >= intervalStart && m.fecha < intervalEnd)

      let ingresos = 0
      let gastos = 0

      intervalMovimientos.forEach((m) => {
        if (m.importe > 0) ingresos += m.importe
        else gastos += Math.abs(m.importe)
      })

      return {
        period: format(interval, formatPattern, { locale: es }),
        ingresos,
        gastos,
        balance: ingresos - gastos,
      }
    })
  }, [movimientos])

  const chartConfig = {
    ingresos: { label: "Ingresos", color: "hsl(var(--chart-1))" },
    gastos: { label: "Gastos", color: "hsl(var(--chart-2))" },
    balance: { label: "Balance", color: "hsl(var(--chart-3))" },
  } satisfies ChartConfig

  const clearFilters = () => {
    setCategoryIds([])
  }

  const hasFilteredMovements = movimientos.length > 0

  return (
    <>
      <div className="text-sm text-muted-foreground">
        Haz un balance entre ingresos y gastos de una actividad concreta
      </div>

      <GridStackDashboard tabId="actividad" locked={locked}>
        <GridStackWidget config={getWidgetConfig("summary-cards")} locked={locked}>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 p-4">
            <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border-green-200 dark:border-green-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-700 dark:text-green-300">{formatCurrency(summary.ingresos)}</div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 border-red-200 dark:border-red-800">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gastos</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-700 dark:text-red-300">{formatCurrency(summary.gastos)}</div>
              </CardContent>
            </Card>

            <Card
              className={`${summary.balance >= 0
                ? "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-blue-200 dark:border-blue-800"
                : "bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/50 border-orange-200 dark:border-orange-800"
                }`}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Balance</CardTitle>
                <Wallet className={`h-4 w-4 ${summary.balance >= 0 ? "text-blue-600" : "text-orange-600"}`} />
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${summary.balance >= 0 ? "text-blue-700 dark:text-blue-300" : "text-orange-700 dark:text-orange-300"}`}
                >
                  {formatCurrency(summary.balance)}
                </div>
              </CardContent>
            </Card>
          </div>
        </GridStackWidget>

        <GridStackWidget config={getWidgetConfig("distribution-chart")} locked={locked}>
          <Card className="h-full border-0 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PieChart className="h-5 w-5" />
                Distribución Ingresos vs Gastos
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                <ChartContainer config={chartConfig} className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie data={donutData} cx="50%" cy="50%" innerRadius={50} outerRadius={90} dataKey="value">
                        {donutData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                      <RechartsTooltip content={<DonutTooltip />} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </GridStackWidget>

        <GridStackWidget config={getWidgetConfig("category-filter")} locked={locked}>
          <Card className="h-full border-0 shadow-none">
            <CardHeader>
              <CardTitle>Filtrar por Categorías</CardTitle>
            </CardHeader>
            <CardContent>
              <Button
                variant="outline"
                className="w-full justify-start gap-2"
                onClick={() => setSelectorOpen(true)}
              >
                <Filter className="h-4 w-4" />
                {selectedCategories.length === 0
                  ? "Seleccionar categorías..."
                  : `${selectedCategories.length} categoría${selectedCategories.length !== 1 ? "s" : ""} seleccionada${selectedCategories.length !== 1 ? "s" : ""}`}
              </Button>
              {isPending && (
                <p className="text-xs text-muted-foreground mt-2">Aplicando filtros...</p>
              )}
            </CardContent>
          </Card>
        </GridStackWidget>

        <GridStackWidget config={getWidgetConfig("evolution-chart")} locked={locked}>
          <Card className="h-full border-0 shadow-none">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Evolución Histórica
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthlyData.length > 0 && hasFilteredMovements ? (
                <ChartContainer config={chartConfig} className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthlyData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="period" />
                      <YAxis />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Line type="monotone" dataKey="ingresos" stroke="var(--color-ingresos)" strokeWidth={2} />
                      <Line type="monotone" dataKey="gastos" stroke="var(--color-gastos)" strokeWidth={2} />
                      <Line type="monotone" dataKey="balance" stroke="var(--color-balance)" strokeWidth={2} />
                    </LineChart>
                  </ResponsiveContainer>
                </ChartContainer>
              ) : (
                <EmptyState
                  title="Sin datos de evolución"
                  description="No hay suficientes movimientos para mostrar la evolución histórica."
                  icon={<BarChart3 className="h-6 w-6" />}
                />
              )}
            </CardContent>
          </Card>
        </GridStackWidget>
      </GridStackDashboard>

      {selectorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <CategoryMegaSelector
            categories={categorias}
            selectedCategories={selectedCategories}
            onSelectionChange={setCategoryIds}
            onClose={() => setSelectorOpen(false)}
            allowMultiple
            title="Filtrar por Categorías"
          />
        </div>
      )}
    </>
  )
}
