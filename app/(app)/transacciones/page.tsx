import { Suspense } from "react"
import { TransactionManager } from "@/components/transactions/transaction-manager"
import { TransactionsSkeleton } from "@/components/ui/page-skeleton"

// La página deja de ser cliente: el manager ya lo es. Así el segmento tiene
// una parte servidor que puede enviarse en streaming, y el `<Suspense>` acota
// la espera al propio manager, que lee `useSearchParams()` (llegar desde el
// dashboard con `?categorias=` o `?desde=`) y sin barrera obligaría a
// renderizar toda la ruta en cliente.
export default function TransaccionesPage() {
  return (
    <Suspense fallback={<TransactionsSkeleton />}>
      <TransactionManager />
    </Suspense>
  )
}
