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
    <div className="space-y-8">
      <FinancialSummary from={from} to={to} />

      <FinancialInsights from={from} to={to} />

      <MonthlyTrend from={from} to={to} />

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <div className="h-6 w-1 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full" />
          Acciones Rápidas
        </h2>
        <QuickActions />
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold flex items-center gap-2">
          <div className="h-6 w-1 bg-gradient-to-b from-green-500 to-blue-500 rounded-full" />
          Actividad Reciente
        </h2>
        <RecentTransactions />
      </div>
    </div>
  )
}
