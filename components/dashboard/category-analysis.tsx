"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchX } from "lucide-react"
import { TimeframeFilter, Timeframe, getTimeframeRange } from "./timeframe-filter"
import { CategorySelector } from "@/components/transactions/category-selector"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useCategorias } from "@/hooks/use-categorias"
import { useMovimientos } from "@/hooks/use-movimientos"
import { PieChart, Pie, Cell, Tooltip as RechartsTooltip, TooltipProps } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart"
import { formatCurrency } from "@/lib/utils/format"
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
} from "@/components/ui/table"

export function CategoryAnalysisDashboard() {
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

  const aggregate = useMemo(() => {
    const ingresoMap = new Map<string, { id: string; name: string; value: number }>()
    const gastoMap = new Map<string, { id: string; name: string; value: number }>()

    movimientos.forEach((m) => {
      const id = m.categoria_id || "uncategorized"
      const name = m.categoria?.nombre || "Sin etiqueta"
      const map = m.importe > 0 ? ingresoMap : gastoMap
      const entry = map.get(id) || { id, name, value: 0 }
      entry.value += Math.abs(m.importe)
      map.set(id, entry)
    })

    return {
      ingresos: Array.from(ingresoMap.values()),
      gastos: Array.from(gastoMap.values()),
    }
  }, [movimientos])

  const summary = useMemo(() => {
    const map = new Map<
      string,
      { id: string; name: string; income: number; expense: number }
    >()

    aggregate.ingresos.forEach((i) => {
      map.set(i.id, { id: i.id, name: i.name, income: i.value, expense: 0 })
    })
    aggregate.gastos.forEach((g) => {
      const existing = map.get(g.id)
      if (existing) {
        existing.expense = g.value
      } else {
        map.set(g.id, { id: g.id, name: g.name, income: 0, expense: g.value })
      }
    })
    return Array.from(map.values())
  }, [aggregate])

  const buildConfig = (data: { id: string; name: string; value: number }[]): ChartConfig => {
    const colors = [1, 2, 3, 4, 5]
    return Object.fromEntries(
      data.map((d, i) => [d.id, { label: d.name, color: `hsl(var(--chart-${colors[i % colors.length]}))` }])
    )
  }

  const clearFilters = () => {
    setTimeframe("month")
    setCategoryIds([])
  }

  const PieTooltip = (
    { active, payload, total }: TooltipProps<number, string> & { total: number }
  ) => {
    if (!active || !payload?.length) return null
    const d = payload[0].payload as { name: string; value: number; id: string }
    const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
    return (
      <div className="grid gap-2 rounded-md border bg-background p-2 text-xs shadow-md">
        <div className="font-medium">{d.name}</div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: `var(--color-${d.id})` }} />
          {formatCurrency(d.value)}
          <span className="ml-1">({pct}%)</span>
        </div>
      </div>
    )
  }

  const renderPie = (data: { id: string; name: string; value: number }[], title: string) => {
    const config = buildConfig(data)
    const total = data.reduce((sum, d) => sum + d.value, 0)
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={config} className="h-[300px]">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={120}>
                {data.map((d) => (
                  <Cell key={d.id} fill={`var(--color-${d.id})`} />
                ))}
              </Pie>
              <RechartsTooltip content={<PieTooltip total={total} />} />
            </PieChart>
          </ChartContainer>
        </CardContent>
      </Card>
    )
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

      {movimientos.length === 0 ? (
        <EmptyState
          title="No se han encontrado movimientos"
          description="Prueba con otro periodo de tiempo o limpia los filtros de categorías."
          icon={<SearchX className="h-6 w-6" />}
        >
          <Button variant="outline" onClick={clearFilters}>Borrar filtros</Button>
        </EmptyState>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {aggregate.ingresos.length > 0 && renderPie(aggregate.ingresos, "Ingresos por categoría")}
            {aggregate.gastos.length > 0 && renderPie(aggregate.gastos, "Gastos por categoría")}
          </div>

          {summary.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Resumen por categoría</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="text-right">Ingresos</TableHead>
                      <TableHead className="text-right">Gastos</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {summary.map((s) => (
                      <TableRow key={s.id}>
                        <TableCell>{s.name}</TableCell>
                        <TableCell className="text-right">
                          {s.income ? formatCurrency(s.income) : "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          {s.expense ? formatCurrency(s.expense) : "-"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
