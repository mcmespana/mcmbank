"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Wallet, Target, Tag, ArrowUpRight, ArrowDownRight } from "lucide-react"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useMemo } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"

interface Props {
  from: string
  to: string
}

export function FinancialSummary({ from, to }: Props) {
  const { selectedDelegation } = useDelegationContext()
  const router = useRouter()

  // Dashboard needs ALL movements for accurate calculations, not just first 100
  const { movimientos } = useMovimientos(
    selectedDelegation,
    {
      fechaDesde: from,
      fechaHasta: to,
    },
    { pageSize: 0 } // Disable pagination to load ALL movements
  )

  const summary = useMemo(() => {
    if (!movimientos.length) return { ingresos: 0, gastos: 0, balance: 0, count: 0, uncategorized: 0 }

    const ingresos = movimientos.filter((m) => m.importe > 0).reduce((sum, m) => sum + m.importe, 0)

    const gastos = movimientos.filter((m) => m.importe < 0).reduce((sum, m) => sum + Math.abs(m.importe), 0)

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
      color: "text-green-600 dark:text-green-400",
      bgColor: "bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50",
      borderColor: "border-green-200 dark:border-green-800",
      trend: ArrowUpRight,
      trendColor: "text-green-500",
    },
    {
      title: "Gastos",
      value: `€${summary.gastos.toFixed(2)}`,
      description: "Total de salidas",
      icon: TrendingDown,
      color: "text-red-600 dark:text-red-400",
      bgColor: "bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50",
      borderColor: "border-red-200 dark:border-red-800",
      trend: ArrowDownRight,
      trendColor: "text-red-500",
    },
    {
      title: "Balance",
      value: `€${summary.balance.toFixed(2)}`,
      description: "Ingresos - Gastos",
      icon: Wallet,
      color: summary.balance >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400",
      bgColor:
        summary.balance >= 0
          ? "bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50"
          : "bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/50 dark:to-amber-950/50",
      borderColor:
        summary.balance >= 0 ? "border-blue-200 dark:border-blue-800" : "border-orange-200 dark:border-orange-800",
      badge: summary.balance >= 0 ? "Positivo" : "Negativo",
      badgeVariant: summary.balance >= 0 ? "default" : "destructive",
    },
    {
      title: "Transacciones",
      value: summary.count.toString(),
      description: "En el periodo",
      icon: Target,
      color: "text-purple-600 dark:text-purple-400",
      bgColor: "bg-gradient-to-br from-purple-50 to-violet-50 dark:from-purple-950/50 dark:to-violet-950/50",
      borderColor: "border-purple-200 dark:border-purple-800",
      action: () => router.push("/transacciones"),
    },
    {
      title: "Sin categorizar",
      value: summary.uncategorized.toString(),
      description: "Transacciones",
      icon: Tag,
      color: "text-amber-600 dark:text-amber-400",
      bgColor: "bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/50 dark:to-yellow-950/50",
      borderColor: "border-amber-200 dark:border-amber-800",
      action: () => router.push("/transacciones?uncategorized=1"),
      badge: summary.uncategorized > 0 ? "Pendiente" : "Completo",
      badgeVariant: summary.uncategorized > 0 ? "secondary" : "default",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-8 w-1.5 bg-gradient-to-b from-primary via-primary/70 to-primary/40 rounded-full shadow-lg shadow-primary/20" />
        <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          Resumen Financiero
        </h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 lg:gap-6">
        {metrics.map((metric, index) => (
          <Card
            key={metric.title}
            className={`${metric.bgColor} ${metric.borderColor} border-2 backdrop-blur-xl transition-all duration-300 ${
              metric.action ? "cursor-pointer hover:shadow-2xl hover:scale-[1.05] hover:-translate-y-1" : "hover:shadow-xl"
            } relative overflow-hidden group`}
            onClick={metric.action}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            {/* Gradient overlay effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3 relative z-10">
              <CardTitle className="text-sm font-semibold truncate pr-2">{metric.title}</CardTitle>
              <div className="flex items-center gap-2 flex-shrink-0">
                {metric.badge && (
                  <Badge variant={metric.badgeVariant as any} className="text-xs hidden sm:inline-flex shadow-sm">
                    {metric.badge}
                  </Badge>
                )}
                <div className="p-2 rounded-xl bg-white/60 dark:bg-black/30 backdrop-blur-sm shadow-md group-hover:scale-110 transition-transform duration-300">
                  <metric.icon className={`h-4 w-4 ${metric.color}`} />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 relative z-10">
              <div className="flex items-end justify-between">
                <div className="min-w-0 flex-1">
                  <div className="text-2xl lg:text-3xl font-extrabold truncate mb-1">{metric.value}</div>
                  <p className="text-xs text-muted-foreground/80 truncate font-medium">{metric.description}</p>
                </div>
                {metric.trend && (
                  <div className="p-1.5 rounded-lg bg-white/50 dark:bg-black/20 backdrop-blur-sm">
                    <metric.trend className={`h-4 w-4 ${metric.trendColor} flex-shrink-0`} />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
