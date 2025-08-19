"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Wallet, Target } from "lucide-react"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useMemo } from "react"

export function FinancialSummary() {
  const { selectedDelegation } = useDelegationContext()
  
  const { movimientos } = useMovimientos(selectedDelegation, {
    fechaDesde: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    fechaHasta: new Date().toISOString().split('T')[0],
  })

  const summary = useMemo(() => {
    if (!movimientos.length) return { ingresos: 0, gastos: 0, balance: 0, count: 0 }

    const ingresos = movimientos
      .filter(m => m.importe > 0)
      .reduce((sum, m) => sum + m.importe, 0)
    
    const gastos = movimientos
      .filter(m => m.importe < 0)
      .reduce((sum, m) => sum + Math.abs(m.importe), 0)
    
    const balance = ingresos - gastos

    return {
      ingresos,
      gastos,
      balance,
      count: movimientos.length
    }
  }, [movimientos])

  const metrics = [
    {
      title: "Ingresos del mes",
      value: `€${summary.ingresos.toFixed(2)}`,
      description: "Total de entradas",
      icon: TrendingUp,
      color: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      title: "Gastos del mes",
      value: `€${summary.gastos.toFixed(2)}`,
      description: "Total de salidas",
      icon: TrendingDown,
      color: "text-red-600",
      bgColor: "bg-red-50",
    },
    {
      title: "Balance",
      value: `€${summary.balance.toFixed(2)}`,
      description: "Ingresos - Gastos",
      icon: Wallet,
      color: summary.balance >= 0 ? "text-green-600" : "text-red-600",
      bgColor: summary.balance >= 0 ? "bg-green-50" : "bg-red-50",
    },
    {
      title: "Transacciones",
      value: summary.count.toString(),
      description: "Este mes",
      icon: Target,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {metrics.map((metric) => (
        <Card key={metric.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{metric.title}</CardTitle>
            <div className={`p-2 rounded-lg ${metric.bgColor}`}>
              <metric.icon className={`h-4 w-4 ${metric.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metric.value}</div>
            <p className="text-xs text-muted-foreground">{metric.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
