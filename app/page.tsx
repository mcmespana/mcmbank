"use client"

import { useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { TimeframeFilter, type Timeframe, getTimeframeRange } from "@/components/dashboard/timeframe-filter"
import { ActivityBalanceDashboard } from "@/components/dashboard/activity-balance"
import { CategoryAnalysisDashboard } from "@/components/dashboard/category-analysis"
import { OverviewDashboard } from "@/components/dashboard/overview-dashboard"
import { TrendingUp, PieChart, Home } from "lucide-react"

export default function HomePage() {
  const [timeframe, setTimeframe] = useState<Timeframe>("school-year")
  const { from, to } = getTimeframeRange(timeframe)

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <TimeframeFilter value={timeframe} onChange={setTimeframe} />
        </div>

        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3 h-12">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              <span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="actividad" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Balance</span>
            </TabsTrigger>
            <TabsTrigger value="categorias" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              <span className="hidden sm:inline">Análisis ingresos y gastos</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <OverviewDashboard from={from} to={to} />
          </TabsContent>

          <TabsContent value="actividad" className="space-y-6">
            <ActivityBalanceDashboard timeframe={timeframe} from={from} to={to} />
          </TabsContent>

          <TabsContent value="categorias" className="space-y-6">
            <CategoryAnalysisDashboard timeframe={timeframe} from={from} to={to} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
