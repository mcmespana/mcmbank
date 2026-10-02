import { Suspense } from "react"
import { SubvencionesManager } from "@/components/subvenciones/subvenciones-manager"
import { PageSkeleton } from "@/components/ui/page-skeleton"

// El manager lee `useSearchParams()` (`?anio=` y la ficha abierta en `?s=`):
// sin esta barrera Next obligaría a renderizar toda la ruta en cliente.
export default function SubvencionesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SubvencionesManager />
    </Suspense>
  )
}
