"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Wallet, Target, Tag } from "lucide-react"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface Props {
  from: string
  to: string
}

export function FinancialSummary({ from, to }: Props) {
  const { selectedDelegation } = useDelegationContext()
  const router = useRouter()

  const { movimientos } = useMovimientos(selectedDelegation, {
    fechaDesde: from,
    fechaHasta: to,
  })

  const summary = useMemo(() => {
    if (!movimientos.length)
      return { ingresos: 0, gastos: 0, balance: 0, count: 0, uncategorized: 0 }

    const ingresos = movimientos
      .filter((m) => m.importe > 0)
      .reduce((sum, m) => sum + m.importe, 0)

    const gastos = movimientos
      .filter((m) => m.importe < 0)
      .reduce((sum, m) => sum + Math.abs(m.importe), 0)

    const uncategorized = movimientos.filter((m) => !m.categoria_id).length

    const balance = ingresos - gastos

    return {
      ingresos,
      gastos,
      balance,
      count: movimientos.length,
      uncategorized,
    }
  }, [movimientos])

  const metrics = [
    {
      title: "Ingresos",
      value: `€${summary.ingresos.toFixed(2)}`,
      description: "Total de entradas",
      icon: TrendingUp,
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Gastos",
      value: `€${summary.gastos.toFixed(2)}`,
      description: "Total de salidas",
      icon: TrendingDown,
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
    },
    {
      title: "Balance",
      value: `€${summary.balance.toFixed(2)}`,
      description: "Ingresos - Gastos",
      icon: Wallet,
      color: summary.balance >= 0 ? "text-emerald-500" : "text-rose-500",
      bgColor: summary.balance >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10",
    },
    {
      title: "Transacciones",
      value: summary.count.toString(),
      description: "En el periodo",
      icon: Target,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      action: () => router.push("/transacciones"),
    },
    {
      title: "Sin categorizar",
      value: summary.uncategorized.toString(),
      description: "Transacciones",
      icon: Tag,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      action: () => router.push("/transacciones?uncategorized=1"),
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-5">
      {metrics.map((metric) => (
        <Card
          key={metric.title}
          className={cn(
            "transition-all duration-200",
            metric.action && "cursor-pointer hover:border-primary/50 hover:shadow-lg",
          )}
          onClick={metric.action}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{metric.title}</CardTitle>
            <div className={cn("rounded-md p-2", metric.bgColor)}>
              <metric.icon className={cn("h-5 w-5", metric.color)} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metric.value}</div>
            <p className="text-xs text-muted-foreground">{metric.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
