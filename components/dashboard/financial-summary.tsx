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
      iconWrapper: "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
      accent: "from-emerald-500/20 via-emerald-500/5 to-transparent dark:from-emerald-500/10 dark:via-emerald-500/5",
    },
    {
      title: "Gastos",
      value: `€${summary.gastos.toFixed(2)}`,
      description: "Total de salidas",
      icon: TrendingDown,
      iconWrapper: "bg-rose-500/15 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
      accent: "from-rose-500/20 via-rose-500/5 to-transparent dark:from-rose-500/10 dark:via-rose-500/5",
    },
    {
      title: "Balance",
      value: `€${summary.balance.toFixed(2)}`,
      description: "Ingresos - Gastos",
      icon: Wallet,
      iconWrapper:
        summary.balance >= 0
          ? "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-rose-500/15 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
      accent:
        summary.balance >= 0
          ? "from-emerald-500/20 via-emerald-500/5 to-transparent dark:from-emerald-500/10 dark:via-emerald-500/5"
          : "from-rose-500/20 via-rose-500/5 to-transparent dark:from-rose-500/10 dark:via-rose-500/5",
    },
    {
      title: "Transacciones",
      value: summary.count.toString(),
      description: "En el periodo",
      icon: Target,
      iconWrapper: "bg-sky-500/15 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
      accent: "from-sky-500/20 via-sky-500/5 to-transparent dark:from-sky-500/10 dark:via-sky-500/5",
      action: () => router.push("/transacciones"),
    },
    {
      title: "Sin categorizar",
      value: summary.uncategorized.toString(),
      description: "Transacciones",
      icon: Tag,
      iconWrapper: "bg-amber-400/20 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
      accent: "from-amber-400/25 via-amber-400/5 to-transparent dark:from-amber-400/15 dark:via-amber-400/5",
      action: () => router.push("/transacciones?uncategorized=1"),
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
      {metrics.map((metric) => (
        <Card
          key={metric.title}
          className={cn(
            "relative overflow-hidden border border-white/20 bg-white/70 text-foreground dark:border-white/10 dark:bg-white/5",
            metric.action && "cursor-pointer",
          )}
          onClick={metric.action}
        >
          <div className={cn("absolute inset-0 -z-10 bg-gradient-to-br", metric.accent)} aria-hidden />
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
            <CardTitle className="text-sm font-semibold text-foreground/80 dark:text-white/90">
              {metric.title}
            </CardTitle>
            <div className={cn("rounded-xl p-2 shadow-inner shadow-black/5", metric.iconWrapper)}>
              <metric.icon className="h-4 w-4" />
            </div>
          </CardHeader>
          <CardContent className="pt-1">
            <div className="text-2xl font-bold tracking-tight">{metric.value}</div>
            <p className="text-xs font-medium text-muted-foreground">{metric.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
