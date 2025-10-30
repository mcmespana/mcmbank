import { AppLayout } from "@/components/app-layout"
import { CuentasManager } from "@/components/cuentas/cuentas-manager"

export default function CuentasPage() {
  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="h-10 w-2 bg-gradient-to-b from-primary via-primary/70 to-primary/40 rounded-full shadow-lg shadow-primary/30" />
            <h1 className="text-4xl font-extrabold bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text">
              Cuentas
            </h1>
          </div>
          <p className="text-muted-foreground text-base ml-6 pl-4">Gestiona tus cuentas bancarias y cajas de ahorro</p>
        </div>
        <CuentasManager />
      </div>
    </AppLayout>
  )
}
