"use client"

import { useState, useMemo } from "react"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AmountDisplay } from "@/components/amount-display"
import { DateRangeFilter } from "@/components/transactions/date-range-filter"
import { CategorySelector } from "@/components/transactions/category-selector"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useCategorias } from "@/hooks/use-categorias"

export function ExampleDashboard() {
  const { selectedDelegation, getCurrentDelegation } = useDelegationContext()
  const currentDelegation = getCurrentDelegation()

  const [dateFrom, setDateFrom] = useState<string | undefined>()
  const [dateTo, setDateTo] = useState<string | undefined>()
  const [categoryIds, setCategoryIds] = useState<string[]>([])

  const { categorias } = useCategorias(currentDelegation?.organizacion_id)

  const { movimientos } = useMovimientos(selectedDelegation, {
    fechaDesde: dateFrom,
    fechaHasta: dateTo,
    categoriaIds: categoryIds.length ? categoryIds : undefined,
  })

  const { ingresos, gastos, balance, chartData, balanceData } = useMemo(() => {
    let ingresos = 0
    let gastos = 0
    const map: Record<string, { date: string; ingresos: number; gastos: number }> = {}

    movimientos.forEach((m) => {
      const date = m.fecha
      if (!map[date]) map[date] = { date, ingresos: 0, gastos: 0 }
      if (m.importe > 0) {
        ingresos += m.importe
        map[date].ingresos += m.importe
      } else {
        gastos += Math.abs(m.importe)
        map[date].gastos += Math.abs(m.importe)
      }
    })

    const data = Object.values(map).sort((a, b) => a.date.localeCompare(b.date))

    let running = 0
    const balanceData = data.map((d) => {
      running += d.ingresos - d.gastos
      return { date: d.date, balance: running }
    })

    return { ingresos, gastos, balance: ingresos - gastos, chartData: data, balanceData }
  }, [movimientos])

  const handleClearFilters = () => {
    setDateFrom(undefined)
    setDateTo(undefined)
    setCategoryIds([])
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 md:items-end">
        <div className="md:w-1/3">
          <DateRangeFilter
            dateFrom={dateFrom}
            dateTo={dateTo}
            onDateRangeChange={(from, to) => {
              setDateFrom(from)
              setDateTo(to)
            }}
          />
        </div>
        <div className="md:w-1/3">
          <CategorySelector
            categories={categorias}
            selectedCategories={categoryIds}
            onSelectionChange={setCategoryIds}
            allowMultiple
            placeholder="Todas las categorías"
          />
        </div>
        <Button variant="outline" onClick={handleClearFilters} className="md:self-start">
          Limpiar filtros
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Ingresos</CardTitle>
          </CardHeader>
          <CardContent>
            <AmountDisplay amount={ingresos} size="lg" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gastos</CardTitle>
          </CardHeader>
          <CardContent>
            <AmountDisplay amount={-gastos} size="lg" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <AmountDisplay amount={balance} size="lg" />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Ingresos vs Gastos</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => format(new Date(d), "dd/MM", { locale: es })}
                />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => `€${value.toFixed(2)}`}
                  labelFormatter={(d) => format(new Date(d), "PPP", { locale: es })}
                />
                <Legend />
                <Area type="monotone" dataKey="ingresos" stroke="#16a34a" fill="#86efac" />
                <Area type="monotone" dataKey="gastos" stroke="#dc2626" fill="#fca5a5" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Balance acumulado</CardTitle>
          </CardHeader>
          <CardContent className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={balanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d) => format(new Date(d), "dd/MM", { locale: es })}
                />
                <YAxis />
                <Tooltip
                  formatter={(value: number) => `€${value.toFixed(2)}`}
                  labelFormatter={(d) => format(new Date(d), "PPP", { locale: es })}
                />
                <Area type="monotone" dataKey="balance" stroke="#6366f1" fill="#a5b4fc" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default ExampleDashboard

