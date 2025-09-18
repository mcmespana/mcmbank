"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CategorySelector } from "@/components/transactions/category-selector"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useCategorias } from "@/hooks/use-categorias"
import { useMovimientos } from "@/hooks/use-movimientos"
import { TrendingUp, TrendingDown, Wallet, BarChart3, PieChart } from "lucide-react"
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
  type TooltipProps,
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
  differenceInDays,
  differenceInMonths,
  differenceInYears,
} from "date-fns"
import { es } from "date-fns/locale"
import type { Timeframe } from "./timeframe-filter"
import { formatCurrency } from "@/lib/utils/format"
import { Badge } from "@/components/ui/badge"

interface Props {
  timeframe: Timeframe
  from: string
  to: string
}

export function ActivityBalanceDashboard({ timeframe, from, to }: Props) {
  const { selectedDelegation } = useDelegationContext()
  const [categoryIds, setCategoryIds] = useState<string[]>([])

  const { categorias } = useCategorias(selectedDelegation)
  const { movimientos } = useMovimientos(selectedDelegation, {
    fechaDesde: from,
    fechaHasta: to,
    categoriaIds: categoryIds.length ? categoryIds : undefined,
  })

  const { movimientos: allMovimientos } = useMovimientos(selectedDelegation)

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

  const DonutTooltip = ({ active, payload }: TooltipProps<number, string>) => {
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
    if (allMovimientos.length === 0) return []

    const firstTransaction = allMovimientos.reduce((earliest, current) =>
      current.fecha < earliest.fecha ? current : earliest,
    )
    const lastTransaction = allMovimientos.reduce((latest, current) =>
      current.fecha > latest.fecha ? current : latest,
    )

    const startDate = parseISO(firstTransaction.fecha)
    const endDate = parseISO(lastTransaction.fecha)

    const daysDiff = differenceInDays(endDate, startDate)
    const monthsDiff = differenceInMonths(endDate, startDate)
    const yearsDiff = differenceInYears(endDate, startDate)

    let intervals: Date[]
    let formatPattern: string

    if (yearsDiff > 5) {
      // Más de 5 años: cada año
      intervals = eachYearOfInterval({ start: startDate, end: endDate })
      formatPattern = "yyyy"
    } else if (monthsDiff > 6) {
      // Más de 6 meses: cada mes
      intervals = eachMonthOfInterval({ start: startDate, end: endDate })
      formatPattern = "MMM yyyy"
    } else if (monthsDiff > 2) {
      // Más de 2 meses: cada 15 días
      intervals = eachWeekOfInterval({ start: startDate, end: endDate }, { step: 2 })
      formatPattern = "dd MMM"
    } else {
      // Menos de 2 meses: cada 7 días
      intervals = eachWeekOfInterval({ start: startDate, end: endDate })
      formatPattern = "dd MMM"
    }

    return intervals.map((interval) => {
      const intervalStart = interval.toISOString().split("T")[0]
      const nextInterval = intervals[intervals.indexOf(interval) + 1]
      const intervalEnd = nextInterval ? nextInterval.toISOString().split("T")[0] : endDate.toISOString().split("T")[0]

      const intervalMovimientos = allMovimientos.filter((m) => m.fecha >= intervalStart && m.fecha < intervalEnd)

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
  }, [allMovimientos])

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
    <div className="space-y-6">
      <div className="text-sm text-muted-foreground">
        Haz un balance entre ingresos y gastos de una actividad concreta
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <Card className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50 border-green-200 dark:border-green-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-700 dark:text-green-300">€{summary.ingresos.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 border-red-200 dark:border-red-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-700 dark:text-red-300">€{summary.gastos.toFixed(2)}</div>
          </CardContent>
        </Card>

        <Card
          className={`${
            summary.balance >= 0
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
              €{summary.balance.toFixed(2)}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
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
              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value">
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

        <Card>
          <CardHeader>
            <CardTitle>Filtrar por Categorías</CardTitle>
          </CardHeader>
          <CardContent>
            <CategorySelector
              categories={categorias}
              selectedCategories={categoryIds}
              onSelectionChange={setCategoryIds}
              allowMultiple
              placeholder="Seleccionar categorías..."
            />
            {categoryIds.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {categoryIds.map((id) => {
                  const categoria = categorias.find((c) => c.id === id)
                  return (
                    <div key={id} className="flex items-center gap-1 bg-secondary px-2 py-1 rounded-md text-sm">
                      {categoria?.emoji && <span>{categoria.emoji}</span>}
                      {categoria?.nombre || "Sin categoría"}
                    </div>
                  )
                })}
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Limpiar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {monthlyData.length > 0 && hasFilteredMovements && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              Evolución Histórica
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[400px]">
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
          </CardContent>
        </Card>
      )}
    </div>
  )
}
