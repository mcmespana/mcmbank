"use client"

import { AppLayout } from "@/components/app-layout"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { FinancialSummary } from "@/components/dashboard/financial-summary"
import { ExampleDashboard } from "@/components/dashboards/example-dashboard"

export default function DashboardsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboards</h1>
          <p className="text-muted-foreground">Visualiza diferentes paneles de control</p>
        </div>
        <Tabs defaultValue="general" className="space-y-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="ejemplo">Ejemplo</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="space-y-6">
            <FinancialSummary />
          </TabsContent>
          <TabsContent value="ejemplo" className="space-y-6">
            <ExampleDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}

