import { AppLayout } from "@/components/app-layout"
import { CuentasManager } from "@/components/cuentas/cuentas-manager"

export default function CuentasPage() {
  return (
    <AppLayout>
      <div className="space-y-4 sm:space-y-6">
        <div className="px-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Cuentas</h1>
          <p className="text-muted-foreground text-sm sm:text-base">Gestiona tus cuentas bancarias y cajas de ahorro</p>
        </div>
        <CuentasManager />
      </div>
    </AppLayout>
  )
}
