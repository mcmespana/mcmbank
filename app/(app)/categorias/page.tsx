import { Suspense } from "react"
import { CategoryList } from "@/components/categories/category-list"
import { PageSkeleton } from "@/components/ui/page-skeleton"

export default function CategoriasPage() {
  return (
    <div className="space-y-6">
      {/* CategoryList lee `useSearchParams()`; la barrera evita que eso
          arrastre a toda la ruta a renderizarse en cliente. */}
      <Suspense fallback={<PageSkeleton rows={10} tabs={2} />}>
        <CategoryList />
      </Suspense>
    </div>
  )
}
