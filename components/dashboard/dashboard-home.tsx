"use client"

import { useEffect, useMemo, useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { TimeframeFilter, type Timeframe, getTimeframeRange } from "@/components/dashboard/timeframe-filter"
import { ActivityBalanceDashboard } from "@/components/dashboard/activity-balance"
import { CategoryAnalysisDashboard } from "@/components/dashboard/category-analysis"
import { OverviewDashboard } from "@/components/dashboard/overview-dashboard"
import { Button } from "@/components/ui/button"
import { useLocalStorageState } from "@/hooks/use-local-storage"
import { TrendingUp, PieChart, Home, RotateCcw } from "lucide-react"

export type DashboardTab = "overview" | "actividad" | "categorias"

const DEFAULT_TIMEFRAME: Timeframe = "school-year"

const TAB_ROUTES: Record<DashboardTab, string> = {
  overview: "/resumen",
  actividad: "/balance",
  categorias: "/analisis",
}

interface Props {
  /** Tab forzada por la ruta (/resumen, /balance, /analisis). Sin ella se usa la última guardada. */
  initialTab?: DashboardTab
}

export function DashboardHome({ initialTab }: Props) {
  const [activeTab, setActiveTab] = useLocalStorageState<DashboardTab>("mcmbank-dashboard-tab", initialTab ?? "overview")
  const [overviewTimeframe, setOverviewTimeframe] = useLocalStorageState<Timeframe>(
    "mcmbank-dashboard-timeframe-overview",
    DEFAULT_TIMEFRAME,
  )
  const [balanceTimeframe, setBalanceTimeframe] = useLocalStorageState<Timeframe>(
    "mcmbank-dashboard-timeframe-balance",
    DEFAULT_TIMEFRAME,
  )
  const [analysisTimeframe, setAnalysisTimeframe] = useLocalStorageState<Timeframe>(
    "mcmbank-dashboard-timeframe-analysis",
    DEFAULT_TIMEFRAME,
  )
  const [resetToken, setResetToken] = useState(0)

  // La ruta tiene prioridad sobre la tab guardada en localStorage
  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialTab])

  const handleTabChange = (value: string) => {
    const tab = value as DashboardTab
    setActiveTab(tab)
    // Mantiene la URL sincronizada con la tab activa sin remontar la página
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", TAB_ROUTES[tab])
    }
  }

  const overviewRange = useMemo(() => getTimeframeRange(overviewTimeframe), [overviewTimeframe])
  const balanceRange = useMemo(() => getTimeframeRange(balanceTimeframe), [balanceTimeframe])
  const analysisRange = useMemo(() => getTimeframeRange(analysisTimeframe), [analysisTimeframe])

  const activeTimeframe = useMemo(() => {
    if (activeTab === "actividad") return balanceTimeframe
    if (activeTab === "categorias") return analysisTimeframe
    return overviewTimeframe
  }, [activeTab, analysisTimeframe, balanceTimeframe, overviewTimeframe])

  const handleTimeframeChange = (value: Timeframe) => {
    if (activeTab === "actividad") {
      setBalanceTimeframe(value)
    } else if (activeTab === "categorias") {
      setAnalysisTimeframe(value)
    } else {
      setOverviewTimeframe(value)
    }
  }

  const handleResetAll = () => {
    handleTabChange("overview")
    setOverviewTimeframe(DEFAULT_TIMEFRAME)
    setBalanceTimeframe(DEFAULT_TIMEFRAME)
    setAnalysisTimeframe(DEFAULT_TIMEFRAME)
    setResetToken((prev) => prev + 1)
  }

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
          <div className="flex flex-wrap items-center gap-2">
            <TimeframeFilter value={activeTimeframe} onChange={handleTimeframeChange} />
            <Button variant="outline" onClick={handleResetAll} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              Eliminar todos los filtros
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 sm:mx-auto sm:flex sm:w-fit">
            <TabsTrigger value="overview" className="flex items-center justify-center gap-2">
              <Home className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="actividad" className="flex items-center justify-center gap-2">
              <TrendingUp className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Balance</span>
            </TabsTrigger>
            <TabsTrigger value="categorias" className="flex items-center justify-center gap-2">
              <PieChart className="h-4 w-4 shrink-0" />
              <span className="hidden sm:inline">Análisis</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <OverviewDashboard from={overviewRange.from} to={overviewRange.to} />
          </TabsContent>

          <TabsContent value="actividad" className="space-y-8">
            <ActivityBalanceDashboard
              from={balanceRange.from}
              to={balanceRange.to}
              resetToken={resetToken}
            />
          </TabsContent>

          <TabsContent value="categorias" className="space-y-8">
            <CategoryAnalysisDashboard
              from={analysisRange.from}
              to={analysisRange.to}
              resetToken={resetToken}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
