import { PageHeader } from "@/components/ui/page-header"
import { CuentasManager } from "@/components/cuentas/cuentas-manager"

export default function CuentasPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Cuentas"
        description="Gestiona tus cuentas bancarias y cajas de ahorro"
      />
      <CuentasManager />
    </div>
  )
}
