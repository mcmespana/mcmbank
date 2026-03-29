"use client"

import { FinancialSummary } from "./financial-summary"
import { QuickActions } from "./quick-actions"
import { RecentTransactions } from "./recent-transactions"
import { FinancialInsights } from "./financial-insights"
import { MonthlyTrend } from "./monthly-trend"
import { GridStackDashboard } from "./gridstack-dashboard"
import { GridStackWidget } from "./gridstack-widget"
import { OVERVIEW_DEFAULT_LAYOUT } from "@/lib/config/dashboard-layouts"

interface Props {
  from: string
  to: string
  locked: boolean
}

function getWidgetConfig(id: string) {
  return OVERVIEW_DEFAULT_LAYOUT.find((w) => w.id === id)!
}

export function OverviewDashboard({ from, to, locked }: Props) {
  return (
    <GridStackDashboard tabId="overview" locked={locked}>
      <GridStackWidget config={getWidgetConfig("financial-summary")} locked={locked}>
        <FinancialSummary from={from} to={to} />
      </GridStackWidget>

      <GridStackWidget config={getWidgetConfig("financial-insights")} locked={locked}>
        <FinancialInsights from={from} to={to} />
      </GridStackWidget>

      <GridStackWidget config={getWidgetConfig("monthly-trend")} locked={locked}>
        <MonthlyTrend from={from} to={to} />
      </GridStackWidget>

      <GridStackWidget config={getWidgetConfig("quick-actions")} locked={locked}>
        <div className="space-y-6 p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 bg-gradient-to-b from-primary via-primary/70 to-primary/40 rounded-full shadow-lg shadow-primary/20" />
            <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Acciones Rápidas
            </h2>
          </div>
          <QuickActions />
        </div>
      </GridStackWidget>

      <GridStackWidget config={getWidgetConfig("recent-transactions")} locked={locked}>
        <div className="space-y-6 p-4">
          <div className="flex items-center gap-3">
            <div className="h-8 w-1.5 bg-gradient-to-b from-emerald-500 via-emerald-500/70 to-emerald-500/40 rounded-full shadow-lg shadow-emerald-500/20" />
            <h2 className="text-xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
              Actividad Reciente
            </h2>
          </div>
          <RecentTransactions />
        </div>
      </GridStackWidget>
    </GridStackDashboard>
  )
}
