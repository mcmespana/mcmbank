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
      iconTint: "text-emerald-200",
      glow: "from-emerald-500/30 via-emerald-500/10 to-transparent",
    },
    {
      title: "Gastos",
      value: `€${summary.gastos.toFixed(2)}`,
      description: "Total de salidas",
      icon: TrendingDown,
      iconTint: "text-rose-200",
      glow: "from-rose-500/30 via-rose-500/10 to-transparent",
    },
    {
      title: "Balance",
      value: `€${summary.balance.toFixed(2)}`,
      description: "Ingresos - Gastos",
      icon: Wallet,
      iconTint: summary.balance >= 0 ? "text-sky-200" : "text-amber-200",
      glow: summary.balance >= 0 ? "from-sky-500/30 via-sky-500/10 to-transparent" : "from-amber-500/30 via-amber-500/10 to-transparent",
    },
    {
      title: "Transacciones",
      value: summary.count.toString(),
      description: "En el periodo",
      icon: Target,
      iconTint: "text-indigo-200",
      glow: "from-indigo-500/30 via-indigo-500/10 to-transparent",
      action: () => router.push("/transacciones"),
    },
    {
      title: "Sin categorizar",
      value: summary.uncategorized.toString(),
      description: "Transacciones",
      icon: Tag,
      iconTint: "text-amber-200",
      glow: "from-amber-500/30 via-amber-500/10 to-transparent",
      action: () => router.push("/transacciones?uncategorized=1"),
    },
  ] as const

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
      {metrics.map((metric) => (
        <Card
          key={metric.title}
          className={cn(
            "group relative overflow-hidden border border-white/10 bg-slate-900/70 p-6 text-slate-200 shadow-[0_20px_45px_-35px_rgba(24,90,182,0.9)] transition-all hover:border-white/20 hover:shadow-[0_30px_60px_-35px_rgba(24,90,182,1)]",
            metric.action && "cursor-pointer",
          )}
          onClick={metric.action}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-0 opacity-40 transition-opacity duration-300 group-hover:opacity-100",
              `bg-gradient-to-br ${metric.glow}`,
            )}
          />
          <CardHeader className="relative flex flex-row items-center justify-between space-y-0 pb-4">
            <div className="space-y-1">
              <CardTitle className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-300">
                {metric.title}
              </CardTitle>
              <p className="text-xs text-slate-400">{metric.description}</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-lg transition-all group-hover:border-white/30 group-hover:bg-white/10">
              <metric.icon className={cn("h-5 w-5", metric.iconTint)} />
            </div>
          </CardHeader>
          <CardContent className="relative pt-0">
            <div className="text-3xl font-semibold text-white">{metric.value}</div>
            <p className="text-xs text-slate-400">{metric.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
