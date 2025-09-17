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
      <Tabs defaultValue="inicio" className="space-y-8">
        <TabsList className="relative inline-flex h-auto items-center justify-start gap-2 rounded-full border border-white/10 bg-slate-900/60 p-2 text-slate-300 shadow-[0_15px_40px_-30px_rgba(24,90,182,0.9)]">
          <TabsTrigger value="inicio" className="rounded-full px-5 py-2 text-sm font-semibold data-[state=active]:bg-primary/20 data-[state=active]:text-white">
            Inicio
          </TabsTrigger>
          <TabsTrigger value="actividad" className="rounded-full px-5 py-2 text-sm font-semibold data-[state=active]:bg-primary/20 data-[state=active]:text-white">
            Balance de actividad
          </TabsTrigger>
          <TabsTrigger value="categorias" className="rounded-full px-5 py-2 text-sm font-semibold data-[state=active]:bg-primary/20 data-[state=active]:text-white">
            Analizar una categoría
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inicio" className="space-y-10">
          <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-slate-900/60 p-6 shadow-[0_30px_60px_-40px_rgba(16,76,140,0.9)] sm:p-10">
            <div className="pointer-events-none absolute -right-20 top-0 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
            <div className="pointer-events-none absolute -left-16 bottom-0 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-2xl space-y-4">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200">
                  Bienvenido de nuevo
                </span>
                <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Todo listo para gestionar la tesorería con calma
                </h1>
                <p className="text-base text-slate-300 sm:text-lg">
                  Visualiza el pulso financiero de tu delegación, detecta oportunidades y actúa en segundos con un entorno que te acompaña en cada decisión.
                </p>
              </div>
              <div className="flex flex-col items-end gap-4 rounded-2xl border border-white/10 bg-slate-900/70 p-4 shadow-inner">
                <span className="text-xs uppercase tracking-[0.3em] text-slate-400">Periodo de análisis</span>
                <TimeframeFilter value={timeframe} onChange={setTimeframe} />
              </div>
            </div>
          </div>

          <FinancialSummary from={from} to={to} />

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Acciones Rápidas</h2>
            <QuickActions />
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-white">Últimas transacciones</h2>
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
