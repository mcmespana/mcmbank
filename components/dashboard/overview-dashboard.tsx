"use client"

import { FinancialSummary } from "./financial-summary"
import { QuickActions } from "./quick-actions"
import { RecentTransactions } from "./recent-transactions"
import { MonthlyTrend } from "./monthly-trend"

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
