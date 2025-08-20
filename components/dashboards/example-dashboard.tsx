"use client"

import { useState, useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { DateRangeFilter } from "@/components/transactions/date-range-filter"
import { CategorySelector } from "@/components/transactions/category-selector"
import { Button } from "@/components/ui/button"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useCategorias } from "@/hooks/use-categorias"
import { useMovimientos } from "@/hooks/use-movimientos"
import { TrendingUp, TrendingDown, Wallet } from "lucide-react"
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
} from "recharts"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Filters {
  dateFrom?: string
  dateTo?: string
  categoryIds?: string[]
}

export function ExampleDashboard() {
  const { selectedDelegation, getCurrentDelegation } = useDelegationContext()
  const [filters, setFilters] = useState<Filters>({})

  const { categorias } = useCategorias(getCurrentDelegation()?.organizacion_id)
  const { movimientos } = useMovimientos(selectedDelegation, {
    fechaDesde: filters.dateFrom,
    fechaHasta: filters.dateTo,
    categoriaIds: filters.categoryIds,
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
      const month = m.fecha.slice(0, 7)
      const entry = map.get(month) || { date: month, ingresos: 0, gastos: 0 }
      if (m.importe > 0) entry.ingresos += m.importe
      else entry.gastos += Math.abs(m.importe)
      map.set(month, entry)
    })
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [movimientos])

  const updateFilter = (patch: Partial<Filters>) => setFilters((prev) => ({ ...prev, ...patch }))
  const clearFilters = () => setFilters({})

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row">
        <DateRangeFilter
          dateFrom={filters.dateFrom}
          dateTo={filters.dateTo}
          onDateRangeChange={(from, to) => updateFilter({ dateFrom: from, dateTo: to })}
        />
        <div className="md:flex-1">
          <CategorySelector
            categories={categorias}
            selectedCategories={filters.categoryIds || []}
            onSelectionChange={(ids) => updateFilter({ categoryIds: ids.length ? ids : undefined })}
            allowMultiple
            placeholder="Filtrar por categoría..."
          />
        </div>
        <Button variant="outline" onClick={clearFilters} className="md:self-start">
          Borrar filtros
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{summary.ingresos.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{summary.gastos.toFixed(2)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Balance</CardTitle>
            <Wallet
              className={`h-4 w-4 ${summary.balance >= 0 ? "text-green-600" : "text-red-600"}`}
            />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{summary.balance.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Evolución mensual</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    format(new Date(value + "-01"), "MMM yy", { locale: es })
                  }
                />
                <YAxis />
                <RechartsTooltip />
                <Bar dataKey="ingresos" fill="#16a34a" />
                <Bar dataKey="gastos" fill="#dc2626" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tendencia</CardTitle>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(value) =>
                    format(new Date(value + "-01"), "MMM yy", { locale: es })
                  }
                />
                <YAxis />
                <RechartsTooltip />
                <Line
                  type="monotone"
                  dataKey="ingresos"
                  stroke="#16a34a"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="gastos"
                  stroke="#dc2626"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

