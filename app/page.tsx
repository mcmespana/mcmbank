import { AppLayout } from "@/components/app-layout"

export default function HomePage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Próximamente - Panel de control financiero</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium">Ingresos del mes</h3>
            </div>
            <div className="text-2xl font-bold text-green-600">€12,345.67</div>
            <p className="text-xs text-muted-foreground">+20.1% respecto al mes anterior</p>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium">Gastos del mes</h3>
            </div>
            <div className="text-2xl font-bold text-red-600">€8,234.12</div>
            <p className="text-xs text-muted-foreground">+4.3% respecto al mes anterior</p>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium">Balance</h3>
            </div>
            <div className="text-2xl font-bold">€4,111.55</div>
            <p className="text-xs text-muted-foreground">Saldo actual</p>
          </div>

          <div className="rounded-lg border bg-card p-6">
            <div className="flex items-center justify-between space-y-0 pb-2">
              <h3 className="text-sm font-medium">Transacciones</h3>
            </div>
            <div className="text-2xl font-bold">1,308</div>
            <p className="text-xs text-muted-foreground">Este mes</p>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
