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
          <TabsTrigger value="categorias">Analizar una categoría</TabsTrigger>
        </TabsList>

        <TabsContent value="inicio" className="space-y-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-foreground/70 dark:border-white/10 dark:bg-white/10 dark:text-white/80">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />
                Bienvenido de nuevo
              </span>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground dark:text-white">
                Dashboard financiero
              </h1>
              <p className="max-w-xl text-sm text-muted-foreground">
                Visualiza el pulso económico de tu delegación y toma decisiones con confianza.
              </p>
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
