"use client"

import { useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovimientos } from "@/hooks/use-movimientos"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { LineChart, Line, XAxis, YAxis, CartesianGrid } from "recharts"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Props {
  from: string
  to: string
}

export function CashFlowTrend({ from, to }: Props) {
  const { selectedDelegation } = useDelegationContext()
  const { movimientos } = useMovimientos(selectedDelegation, {
    fechaDesde: from,
    fechaHasta: to,
  })

  const data = useMemo(() => {
    const sorted = [...movimientos].sort((a, b) => a.fecha.localeCompare(b.fecha))
    let balance = 0
    return sorted.map((m) => {
      balance += m.importe
      return { date: m.fecha, balance }
    })
  }, [movimientos])

  const chartConfig = {
    balance: { label: "Saldo acumulado", color: "hsl(var(--chart-3))" },
  } satisfies ChartConfig

  if (!data.length) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Evolución de saldo</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="h-[300px]">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="date"
              tickFormatter={(value) =>
                format(new Date(value), "d MMM", { locale: es })
              }
            />
            <YAxis />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="balance" stroke="var(--color-balance)" />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

