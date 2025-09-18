"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useMemo } from "react"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart"
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, parseISO } from "date-fns"
import { es } from "date-fns/locale"

interface Props {
  from: string
  to: string
}

export function MonthlyTrend({ from, to }: Props) {
  const { selectedDelegation } = useDelegationContext()
  const { movimientos } = useMovimientos(selectedDelegation, {
    fechaDesde: from,
    fechaHasta: to,
  })

  const chartData = useMemo(() => {
    if (!movimientos.length) return []

    const months = eachMonthOfInterval({
      start: parseISO(from),
      end: parseISO(to),
    })

    return months.map((month) => {
      const monthStart = startOfMonth(month)
      const monthEnd = endOfMonth(month)

      const monthMovimientos = movimientos.filter((m) => {
        const fecha = parseISO(m.fecha)
        return fecha >= monthStart && fecha <= monthEnd
      })

      const ingresos = monthMovimientos.filter((m) => m.importe > 0).reduce((sum, m) => sum + m.importe, 0)

      const gastos = monthMovimientos.filter((m) => m.importe < 0).reduce((sum, m) => sum + Math.abs(m.importe), 0)

      return {
        month: format(month, "MMM yyyy", { locale: es }),
        ingresos,
        gastos,
        balance: ingresos - gastos,
      }
    })
  }, [movimientos, from, to])

  const chartConfig = {
    ingresos: { label: "Ingresos", color: "hsl(var(--chart-1))" },
    gastos: { label: "Gastos", color: "hsl(var(--chart-2))" },
    balance: { label: "Balance", color: "hsl(var(--chart-3))" },
  } satisfies ChartConfig

  if (chartData.length === 0) return null

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <div className="h-6 w-1 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full" />
        Tendencia Mensual
      </h2>
      <Card>
        <CardHeader>
          <CardTitle>Evolución Financiera</CardTitle>
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
}
