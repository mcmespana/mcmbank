import { Suspense } from "react"
import { PagosMcmManager } from "@/components/pagos-mcm/pagos-mcm-manager"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function PagosMcmPage() {
  // `PagosMcmManager` lee `?pago=<id>` con `useSearchParams()` para abrir ese
  // pago directamente (es a donde apunta la línea "lo adelantó X" de una
  // factura), y eso obliga a un límite de Suspense: sin él, Next renderiza toda
  // la página en el cliente.
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <LoadingSpinner size="sm" /> Cargando pagos…
        </div>
      }
    >
      <PagosMcmManager />
    </Suspense>
  )
}
