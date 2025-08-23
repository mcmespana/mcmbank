import { AppLayout } from "@/components/app-layout"
import { FinancialSummary } from "@/components/dashboard/financial-summary"
import { QuickActions } from "@/components/dashboard/quick-actions"
import ExampleDashboard from "@/components/dashboard/example-dashboard"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export default function DashboardsPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboards</h1>
          <p className="text-muted-foreground">Paneles personalizables</p>
        </div>
        <Tabs defaultValue="general" className="w-full space-y-6">
          <TabsList>
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="finanzas">Finanzas</TabsTrigger>
          </TabsList>
          <TabsContent value="general" className="space-y-8">
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Resumen Financiero</h2>
              <FinancialSummary />
            </div>
            <div className="space-y-4">
              <h2 className="text-xl font-semibold">Acciones Rápidas</h2>
              <QuickActions />
            </div>
          </TabsContent>
          <TabsContent value="finanzas">
            <ExampleDashboard />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  )
}
