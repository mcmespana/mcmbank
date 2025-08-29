"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TimeframeFilter, Timeframe, getTimeframeRange } from "./timeframe-filter"
import { CategorySelector } from "@/components/transactions/category-selector"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useCategorias } from "@/hooks/use-categorias"
import { useMovimientos } from "@/hooks/use-movimientos"
import { PieChart, Pie, Cell } from "recharts"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"

export function CategoryAnalysisDashboard() {
  const { selectedDelegation, getCurrentDelegation } = useDelegationContext()
  const [timeframe, setTimeframe] = useState<Timeframe>("month")
  const [categoryIds, setCategoryIds] = useState<string[]>([])

  const { categorias } = useCategorias(getCurrentDelegation()?.organizacion_id)
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

  const renderPie = (data: { id: string; name: string; value: number }[], title: string) => {
    const config = buildConfig(data)
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
              <ChartTooltip content={<ChartTooltipContent />} />
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

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {aggregate.ingresos.length > 0 && renderPie(aggregate.ingresos, "Ingresos por categoría")}
        {aggregate.gastos.length > 0 && renderPie(aggregate.gastos, "Gastos por categoría")}
      </div>
    </div>
  )
}
