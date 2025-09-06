"use client"

import { useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { FinancialSummary } from "@/components/dashboard/financial-summary"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { RecentTransactions } from "@/components/dashboard/recent-transactions"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { TimeframeFilter, Timeframe, getTimeframeRange } from "@/components/dashboard/timeframe-filter"
import { ActivityBalanceDashboard } from "@/components/dashboard/activity-balance"
import { CategoryAnalysisDashboard } from "@/components/dashboard/category-analysis"

export default function HomePage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("school-year")
  const { from, to } = getTimeframeRange(timeframe)

  return (
    <AppLayout>
      <Tabs defaultValue="inicio" className="space-y-6">
        <TabsList>
          <TabsTrigger value="inicio">Inicio</TabsTrigger>
          <TabsTrigger value="actividad">Balance de actividad</TabsTrigger>
          <TabsTrigger value="categorias">Análisis categorías</TabsTrigger>
        </TabsList>

        <TabsContent value="inicio" className="space-y-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
              <p className="text-muted-foreground">Panel de control financiero de MCM Bank</p>
            </div>
            <TimeframeFilter value={timeframe} onChange={setTimeframe} />
          </div>

          <FinancialSummary from={from} to={to} />

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Acciones Rápidas</h2>
            <QuickActions />
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold">Últimas transacciones</h2>
            <RecentTransactions />
          </div>
        </TabsContent>

        <TabsContent value="actividad" className="space-y-8">
          <ActivityBalanceDashboard />
        </TabsContent>

        <TabsContent value="categorias" className="space-y-8">
          <CategoryAnalysisDashboard />
        </TabsContent>
      </Tabs>
    </AppLayout>
  )
}
