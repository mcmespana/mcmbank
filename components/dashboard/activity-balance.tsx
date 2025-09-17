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
  const { selectedDelegation } = useDelegationContext()
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
    <div className="space-y-10">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_auto]">
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 shadow-inner">
          <div className="flex flex-col gap-3">
            <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
              Periodo
            </span>
            <TimeframeFilter value={timeframe} onChange={setTimeframe} className="w-full" />
          </div>
        </div>
        <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-5 shadow-inner">
          <span className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">Categorías</span>
          <div className="mt-3">
            <CategorySelector
              categories={categorias}
              selectedCategories={categoryIds}
              onSelectionChange={setCategoryIds}
              allowMultiple
              placeholder="Filtrar categorías..."
            />
          </div>
        </div>
        <Button
          variant="outline"
          onClick={clearFilters}
          className="h-full min-h-[60px] rounded-3xl border-white/20 bg-white/5 px-5 font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:bg-white/10"
        >
          Borrar filtros
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="border border-white/10 bg-slate-900/70 text-slate-200 shadow-[0_20px_45px_-35px_rgba(16,76,140,0.9)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Ingresos
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-emerald-200" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-white">€{summary.ingresos.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-slate-900/70 text-slate-200 shadow-[0_20px_45px_-35px_rgba(16,76,140,0.9)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Gastos
            </CardTitle>
            <TrendingDown className="h-5 w-5 text-rose-200" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-white">€{summary.gastos.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card className="border border-white/10 bg-slate-900/70 text-slate-200 shadow-[0_20px_45px_-35px_rgba(16,76,140,0.9)]">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <CardTitle className="text-sm font-semibold uppercase tracking-[0.3em] text-slate-400">
              Balance
            </CardTitle>
            <Wallet
              className={`h-5 w-5 ${summary.balance >= 0 ? "text-sky-200" : "text-amber-200"}`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-semibold text-white">€{summary.balance.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {movimientos.length === 0 ? (
        <EmptyState
          title="No se han encontrado movimientos"
          description="Prueba con otro periodo de tiempo o limpia los filtros de categorías."
          icon={<SearchX className="h-6 w-6" />}
          className="border-white/10 bg-slate-900/70 text-slate-200"
        >
          <Button
            variant="outline"
            onClick={clearFilters}
            className="rounded-xl border-white/20 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 hover:bg-white/10"
          >
            Borrar filtros
          </Button>
        </EmptyState>
      ) : (
        <Card className="border border-white/10 bg-slate-900/70 text-slate-200 shadow-[0_30px_60px_-40px_rgba(16,76,140,0.9)]">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Ingresos vs Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="h-[320px]">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.2)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "rgba(226, 232, 240, 0.7)", fontSize: 12 }}
                  tickFormatter={(value) =>
                    format(new Date(value), "d MMM", { locale: es })
                  }
                />
                <YAxis tick={{ fill: "rgba(226, 232, 240, 0.7)", fontSize: 12 }} axisLine={{ stroke: "rgba(148, 163, 184, 0.2)" }} tickLine={{ stroke: "rgba(148, 163, 184, 0.2)" }} />
                <ChartTooltip content={<ChartTooltipContent />} cursor={{ fill: "rgba(37, 99, 235, 0.08)" }} />
                <Bar dataKey="ingresos" fill="var(--color-ingresos)" radius={[8, 8, 8, 8]} />
                <Bar dataKey="gastos" fill="var(--color-gastos)" radius={[8, 8, 8, 8]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
