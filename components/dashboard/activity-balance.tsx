"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TimeframeFilter, Timeframe, getTimeframeRange } from "./timeframe-filter"
import { CategorySelector } from "@/components/transactions/category-selector"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useCategorias } from "@/hooks/use-categorias"
import { useMovimientos } from "@/hooks/use-movimientos"
import { TrendingUp, TrendingDown, Wallet } from "lucide-react"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchX } from "lucide-react"
import { format } from "date-fns"
import { es } from "date-fns/locale"

export function ActivityBalanceDashboard() {
  const { selectedDelegation, getCurrentDelegation } = useDelegationContext()
  const [timeframe, setTimeframe] = useState<Timeframe>("month")
  const [categoryIds, setCategoryIds] = useState<string[]>([])

  const { categorias } = useCategorias(selectedDelegation)
  const { from, to } = getTimeframeRange(timeframe)
  const { movimientos } = useMovimientos(selectedDelegation, {
    fechaDesde: from,
    fechaHasta: to,
    categoriaIds: categoryIds.length ? categoryIds : undefined,
  })

  const summary = useMemo(() => {
    let ingresos = 0
    let gastos = 0
    for (const m of movimientos) {
      if (m.importe > 0) ingresos += m.importe
      else gastos += Math.abs(m.importe)
    }
    return { ingresos, gastos, balance: ingresos - gastos }
  }, [movimientos])

  const chartData = useMemo(() => {
    const map = new Map<string, { date: string; ingresos: number; gastos: number }>()
    movimientos.forEach((m) => {
      const date = m.fecha
      const entry = map.get(date) || { date, ingresos: 0, gastos: 0 }
      if (m.importe > 0) entry.ingresos += m.importe
      else entry.gastos += Math.abs(m.importe)
      map.set(date, entry)
    })
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [movimientos])

  const chartConfig = {
    ingresos: { label: "Ingresos", color: "hsl(var(--chart-1))" },
    gastos: { label: "Gastos", color: "hsl(var(--chart-2))" },
  } satisfies ChartConfig

  const clearFilters = () => {
    setTimeframe("month")
    setCategoryIds([])
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row">
        <TimeframeFilter value={timeframe} onChange={setTimeframe} />
        <div className="md:flex-1">
          <CategorySelector
            categories={categorias}
            selectedCategories={categoryIds}
            onSelectionChange={setCategoryIds}
            allowMultiple
            placeholder="Filtrar categorías..."
          />
        </div>
        <Button variant="outline" onClick={clearFilters} className="md:self-start">
          Borrar filtros
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="relative overflow-hidden border border-white/20 bg-white/70 text-foreground dark:border-white/10 dark:bg-white/5">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent dark:from-emerald-500/15" aria-hidden />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-foreground/80 dark:text-white/90">Ingresos</CardTitle>
            <div className="rounded-xl bg-emerald-500/15 p-2 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
              <TrendingUp className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-2xl font-bold">€{summary.ingresos.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border border-white/20 bg-white/70 text-foreground dark:border-white/10 dark:bg-white/5">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-rose-500/20 via-rose-500/5 to-transparent dark:from-rose-500/15" aria-hidden />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-foreground/80 dark:text-white/90">Gastos</CardTitle>
            <div className="rounded-xl bg-rose-500/15 p-2 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300">
              <TrendingDown className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-2xl font-bold">€{summary.gastos.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden border border-white/20 bg-white/70 text-foreground shadow-[0_18px_60px_-30px_rgba(37,99,235,0.45)] dark:border-white/10 dark:bg-white/5 md:col-span-3">
          <div
            className={`absolute inset-0 -z-10 bg-gradient-to-br ${
              summary.balance >= 0
                ? "from-emerald-500/15 via-emerald-500/5 to-transparent"
                : "from-rose-500/15 via-rose-500/5 to-transparent"
            }`}
            aria-hidden
          />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-foreground/80 dark:text-white/90">Balance</CardTitle>
            <div
              className={`rounded-xl p-2 ${
                summary.balance >= 0
                  ? "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : "bg-rose-500/15 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300"
              }`}
            >
              <Wallet className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-3xl font-bold">€{summary.balance.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {movimientos.length === 0 ? (
        <EmptyState
          title="No se han encontrado movimientos"
          description="Prueba con otro periodo de tiempo o limpia los filtros de categorías."
          icon={<SearchX className="h-6 w-6" />}
        >
          <Button variant="outline" onClick={clearFilters}>Borrar filtros</Button>
        </EmptyState>
      ) : (
        <Card className="relative overflow-hidden border border-white/20 bg-white/70 text-foreground shadow-[0_18px_60px_-30px_rgba(37,99,235,0.45)] dark:border-white/10 dark:bg-white/5">
          <div className="absolute inset-0 -z-10 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent dark:from-primary/10" aria-hidden />
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-foreground/85 dark:text-white">Ingresos vs Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[300px]">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    format(new Date(value), "d MMM", { locale: es })
                  }
                />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="ingresos" fill="var(--color-ingresos)" />
                <Bar dataKey="gastos" fill="var(--color-gastos)" />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
