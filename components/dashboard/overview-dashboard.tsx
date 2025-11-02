"use client"

import { FinancialSummary } from "./financial-summary"
import { QuickActions } from "./quick-actions"
import { RecentTransactions } from "./recent-transactions"
import { FinancialInsights } from "./financial-insights"
import { MonthlyTrend } from "./monthly-trend"

interface Props {
  from: string
  to: string
}

export function OverviewDashboard({ from, to }: Props) {
  return (
    <div className="space-y-12">
      <FinancialSummary from={from} to={to} />

      <FinancialInsights from={from} to={to} />

      <MonthlyTrend from={from} to={to} />

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1.5 bg-gradient-to-b from-primary via-primary/70 to-primary/40 rounded-full shadow-lg shadow-primary/20" />
          <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Acciones Rápidas
          </h2>
        </div>
        <QuickActions />
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1.5 bg-gradient-to-b from-emerald-500 via-emerald-500/70 to-emerald-500/40 rounded-full shadow-lg shadow-emerald-500/20" />
          <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
            Actividad Reciente
          </h2>
        </div>
        <RecentTransactions />
      </div>
    </div>
  )
}
