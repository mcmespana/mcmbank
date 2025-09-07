"use client"

import { useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { FinancialSummary } from "@/components/dashboard/financial-summary"
import { QuickActions } from "@/components/dashboard/quick-actions"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { TimeframeFilter, Timeframe, getTimeframeRange } from "@/components/dashboard/timeframe-filter"
import { ActivityBalanceDashboard } from "@/components/dashboard/activity-balance"
import { CategoryAnalysisDashboard } from "@/components/dashboard/category-analysis"

export default function HomePage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("school-year")
  const { from, to } = getTimeframeRange(timeframe)

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Bienvenido de nuevo</h1>
            <p className="text-muted-foreground">Aquí tienes un resumen de la actividad financiera.</p>
          </div>
          <TimeframeFilter value={timeframe} onChange={setTimeframe} />
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-1 sm:w-auto sm:inline-flex">
            <TabsTrigger value="overview">Resumen</TabsTrigger>
            <TabsTrigger value="activity">Balance de Actividad</TabsTrigger>
            <TabsTrigger value="categories">Análisis de Categorías</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              <div className="lg:col-span-3">
                <FinancialSummary from={from} to={to} />
              </div>
              <div className="lg:col-span-3">
                <h2 className="mb-4 text-2xl font-semibold">Acciones Rápidas</h2>
                <QuickActions />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="activity">
            <ActivityBalanceDashboard />
          </TabsContent>

          <TabsContent value="categories">
            <CategoryAnalysisDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
