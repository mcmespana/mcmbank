import { Suspense } from "react"
import { FacturasManager } from "@/components/facturas/facturas-manager"
import { LoadingSpinner } from "@/components/ui/loading-spinner"

export default function FacturasPage() {
  // `FacturasManager` lee `?factura=<id>` con `useSearchParams()` para abrir esa
  // factura directamente (es a donde apunta el botón "Ver" de un movimiento
  // conciliado), y eso obliga a un límite de Suspense: sin él, Next renderiza
  // toda la página en el cliente.
  return (
    <Suspense
      fallback={
        <div className="flex items-center gap-2 p-6 text-muted-foreground">
          <LoadingSpinner size="sm" /> Cargando facturas…
        </div>
      }
    >
      <FacturasManager />
    </Suspense>
  )
}
