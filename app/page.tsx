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
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-10 w-2 bg-gradient-to-b from-primary via-primary/70 to-primary/40 rounded-full shadow-lg shadow-primary/30" />
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
              Dashboard
            </h1>
          </div>
          <TimeframeFilter value={timeframe} onChange={setTimeframe} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview" className="flex items-center gap-2 data-[state=active]:gap-2">
              <Home className="h-4 w-4" />
              <span className="hidden data-[state=active]:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="actividad" className="flex items-center gap-2 data-[state=active]:gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden data-[state=active]:inline">Balance</span>
            </TabsTrigger>
            <TabsTrigger value="categorias" className="flex items-center gap-2 data-[state=active]:gap-2">
              <PieChart className="h-4 w-4" />
              <span className="hidden data-[state=active]:inline">Análisis</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <OverviewDashboard from={from} to={to} />
          </TabsContent>

          <TabsContent value="actividad" className="space-y-8">
            <ActivityBalanceDashboard from={from} to={to} />
          </TabsContent>

          <TabsContent value="categorias" className="space-y-8">
            <CategoryAnalysisDashboard from={from} to={to} />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
