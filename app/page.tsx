import { AppLayout } from "@/components/app-layout"
import { FinancialSummary } from "@/components/dashboard/financial-summary"
import { QuickActions } from "@/components/dashboard/quick-actions"

export default function HomePage() {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Panel de control financiero de MCM Bank</p>
        </div>

        {/* Financial Summary */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Resumen Financiero</h2>
          <FinancialSummary />
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Acciones Rápidas</h2>
          <QuickActions />
        </div>

        {/* Recent Activity */}
        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Actividad Reciente</h2>
          <div className="rounded-lg border bg-card p-6">
            <p className="text-muted-foreground text-center py-8">
              Próximamente - Lista de transacciones recientes y notificaciones
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
