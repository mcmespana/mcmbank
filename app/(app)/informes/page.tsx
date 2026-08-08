import { Suspense } from "react"
import { InformesPage } from "@/components/informes/informes-page"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export default function Page() {
  return (
    // InformesPage lee `useSearchParams()`: sin la barrera, la ruta entera se
    // renderizaría en cliente.
    <Suspense fallback={<PageSkeleton rows={5} tabs={0} />}>
      <InformesPage />
    </Suspense>
  )
}
