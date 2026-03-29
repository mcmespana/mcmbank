"use client"

import { useMemo, useState, useCallback } from "react"
import { AppLayout } from "@/components/app-layout"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { TimeframeFilter, type Timeframe, getTimeframeRange } from "@/components/dashboard/timeframe-filter"
import { ActivityBalanceDashboard } from "@/components/dashboard/activity-balance"
import { CategoryAnalysisDashboard } from "@/components/dashboard/category-analysis"
import { OverviewDashboard } from "@/components/dashboard/overview-dashboard"
import { Button } from "@/components/ui/button"
import { useLocalStorageState } from "@/hooks/use-local-storage"
import { TrendingUp, PieChart, Home, RotateCcw, Lock, Unlock, LayoutGrid } from "lucide-react"
import { clearSavedLayout } from "@/lib/config/dashboard-layouts"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

type DashboardTab = "overview" | "actividad" | "categorias"

const DEFAULT_TIMEFRAME: Timeframe = "school-year"

export default function HomePage() {
  const [activeTab, setActiveTab] = useLocalStorageState<DashboardTab>("mcmbank-dashboard-tab", "overview")
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
  const [layoutLocked, setLayoutLocked] = useLocalStorageState<boolean>("mcmbank-dashboard-layout-locked", true)

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
    setActiveTab("overview")
    setOverviewTimeframe(DEFAULT_TIMEFRAME)
    setBalanceTimeframe(DEFAULT_TIMEFRAME)
    setAnalysisTimeframe(DEFAULT_TIMEFRAME)
    setResetToken((prev) => prev + 1)
  }

  const handleResetLayout = useCallback(() => {
    clearSavedLayout(activeTab)
    // Force re-mount of the grid by bumping reset token
    setResetToken((prev) => prev + 1)
  }, [activeTab])

  const handleToggleLock = useCallback(() => {
    setLayoutLocked(!layoutLocked)
  }, [layoutLocked, setLayoutLocked])

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

            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={layoutLocked ? "outline" : "default"}
                    size="icon"
                    onClick={handleToggleLock}
                    className="h-9 w-9"
                  >
                    {layoutLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {layoutLocked ? "Desbloquear layout para mover y redimensionar paneles" : "Bloquear layout"}
                </TooltipContent>
              </Tooltip>

              {!layoutLocked && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="outline" size="icon" onClick={handleResetLayout} className="h-9 w-9">
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Restaurar layout por defecto</TooltipContent>
                </Tooltip>
              )}
            </TooltipProvider>

            <Button variant="outline" onClick={handleResetAll} className="gap-2">
              <RotateCcw className="h-4 w-4" />
              <span className="hidden sm:inline">Eliminar todos los filtros</span>
            </Button>
          </div>
        </div>

        {!layoutLocked && (
          <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2 text-sm text-muted-foreground">
            <Unlock className="h-4 w-4 text-primary" />
            <span>
              Modo edición activo: arrastra los paneles por el icono <strong>&#8942;&#8942;</strong> superior y
              redimensiona desde la esquina inferior derecha.
            </span>
          </div>
        )}

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DashboardTab)} className="space-y-8">
          <TabsList className="grid w-full grid-cols-3 lg:w-auto lg:inline-flex">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <Home className="h-4 w-4" />
              <span className="data-[state=inactive]:hidden">Resumen</span>
            </TabsTrigger>
            <TabsTrigger value="actividad" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="data-[state=inactive]:hidden">Balance</span>
            </TabsTrigger>
            <TabsTrigger value="categorias" className="flex items-center gap-2">
              <PieChart className="h-4 w-4" />
              <span className="data-[state=inactive]:hidden">Análisis</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <OverviewDashboard from={overviewRange.from} to={overviewRange.to} locked={layoutLocked} />
          </TabsContent>

          <TabsContent value="actividad" className="space-y-8">
            <ActivityBalanceDashboard
              from={balanceRange.from}
              to={balanceRange.to}
              resetToken={resetToken}
              locked={layoutLocked}
            />
          </TabsContent>

          <TabsContent value="categorias" className="space-y-8">
            <CategoryAnalysisDashboard
              from={analysisRange.from}
              to={analysisRange.to}
              resetToken={resetToken}
              locked={layoutLocked}
            />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
