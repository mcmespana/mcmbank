import { AppLayout } from "@/components/app-layout"
import { CategoryList } from "@/components/categories/category-list"

export default function CategoriasPage() {
  return (
    <AppLayout>
      <div className="space-y-6">
        <CategoryList />
      </div>
    </AppLayout>
  )
}
