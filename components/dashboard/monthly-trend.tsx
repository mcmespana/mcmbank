"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useMonthlyTrendData } from "@/hooks/use-monthly-trend-data"
import { memo, useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { parse, format } from "date-fns"
import { es } from "date-fns/locale"

interface Props {
  from: string
  to: string
}

// from/to son primitivos: memo evita recalcular el gráfico cuando el
// dashboard padre re-renderiza por otro motivo.
export const MonthlyTrend = memo(function MonthlyTrend({ from, to }: Props) {
  const { trend } = useMonthlyTrendData(from, to)

  const chartData = useMemo(() => {
    return trend.map((row) => ({
      // Convert YYYY-MM to display format (e.g. "ene 2025")
      month: format(parse(row.mes, "yyyy-MM", new Date()), "MMM yyyy", { locale: es }),
      ingresos: row.ingresos,
      gastos: row.gastos,
      balance: row.ingresos - row.gastos,
    }))
  }, [trend])

  const chartConfig = {
    ingresos: { label: "Ingresos", color: "hsl(var(--chart-1))" },
    gastos: { label: "Gastos", color: "hsl(var(--chart-2))" },
    balance: { label: "Balance", color: "hsl(var(--chart-3))" },
  } satisfies ChartConfig

  if (chartData.length === 0) return null

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Tendencia mensual</h2>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Ingresos, gastos y balance por mes</CardTitle>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month" />
                <YAxis />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Line
                  type="monotone"
                  dataKey="ingresos"
                  stroke="var(--color-ingresos)"
                  strokeWidth={2}
                  dot={{ fill: "var(--color-ingresos)" }}
                />
                <Line
                  type="monotone"
                  dataKey="gastos"
                  stroke="var(--color-gastos)"
                  strokeWidth={2}
                  dot={{ fill: "var(--color-gastos)" }}
                />
                <Line
                  type="monotone"
                  dataKey="balance"
                  stroke="var(--color-balance)"
                  strokeWidth={3}
                  dot={{ fill: "var(--color-balance)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>
    </div>
  )
})
