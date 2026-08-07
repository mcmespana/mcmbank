"use client"

import dynamic from "next/dynamic"
import { FinancialSummary } from "./financial-summary"
import { QuickActions } from "./quick-actions"
import { RecentTransactions } from "./recent-transactions"
import { Skeleton } from "@/components/ui/skeleton"

// Carga diferida: MonthlyTrend importa Recharts, que así queda fuera del
// bundle inicial del dashboard (la página que ve todo el mundo al entrar).
const MonthlyTrend = dynamic(() => import("./monthly-trend").then((m) => m.MonthlyTrend), {
  ssr: false,
  loading: () => <Skeleton className="h-[340px] w-full rounded-xl" />,
})

interface Props {
  from: string
  to: string
}

export function OverviewDashboard({ from, to }: Props) {
  return (
    <div className="space-y-8">
      <FinancialSummary from={from} to={to} />

      <MonthlyTrend from={from} to={to} />

      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Actividad reciente</h2>
          <RecentTransactions />
        </div>
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Acciones rápidas</h2>
          <QuickActions />
        </div>
      </div>
    </div>
  )
}
