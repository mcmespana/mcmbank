"use client"

import { useState } from "react"
import { AppLayout } from "@/components/app-layout"
import { CategoryList } from "@/components/categories/category-list"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useCategorias } from "@/hooks/use-categorias"

export default function CategoriasPage() {
  const { selectedDelegation, getCurrentDelegation } = useDelegationContext()
  const currentDelegation = getCurrentDelegation()
  const { movimientos: movements } = useMovimientos(selectedDelegation)
  const { categorias: categories } = useCategorias(currentDelegation?.organizacion_id)
  
  const [dateFrom, setDateFrom] = useState<string>()
  const [dateTo, setDateTo] = useState<string>()

  const handleDateRangeChange = (from?: string, to?: string) => {
    setDateFrom(from)
    setDateTo(to)
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <CategoryList 
          categories={categories || []}
          movements={movements || []}
          dateFrom={dateFrom}
          dateTo={dateTo}
          onDateRangeChange={handleDateRangeChange}
        />
      </div>
    </AppLayout>
  )
}
