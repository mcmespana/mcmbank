"use client"

import { useMemo } from "react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useCategorias } from "@/hooks/use-categorias"
import { ArrowUpCircle, ArrowDownCircle, Activity, TrendingUp, TrendingDown, BarChart3 } from "lucide-react"

export function CommandCenterDashboard() {
  const { selectedDelegation, getCurrentDelegation } = useDelegationContext()
  const { categorias } = useCategorias(getCurrentDelegation()?.organizacion_id)
  const { movimientos } = useMovimientos(selectedDelegation)

  const stats = useMemo(() => {
    let ingresos = 0
    let gastos = 0
    let mayorIngreso = 0
    let mayorGasto = 0
    const gastoPorCategoria = new Map<string, number>()

    movimientos.forEach(m => {
      if (m.importe > 0) {
        ingresos += m.importe
        if (m.importe > mayorIngreso) mayorIngreso = m.importe
      } else {
        const abs = Math.abs(m.importe)
        gastos += abs
        if (abs > mayorGasto) mayorGasto = abs
        if (m.categoria_id) {
          gastoPorCategoria.set(
            m.categoria_id,
            (gastoPorCategoria.get(m.categoria_id) || 0) + abs,
          )
        }
      }
    })

    let topCategoria: { id: string; total: number } | null = null
    gastoPorCategoria.forEach((total, id) => {
      if (!topCategoria || total > topCategoria.total) topCategoria = { id, total }
    })

    return {
      ingresos,
      gastos,
      mayorIngreso,
      mayorGasto,
      totalMovimientos: movimientos.length,
      topCategoria,
    }
  }, [movimientos])

  const topCategoryName = useMemo(() => {
    if (!stats.topCategoria) return "Sin datos"
    const cat = categorias.find(c => c.id === stats.topCategoria!.id)
    return cat ? cat.nombre : "Sin datos"
  }, [stats.topCategoria, categorias])

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total ingresos</CardTitle>
          <ArrowUpCircle className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">€{stats.ingresos.toFixed(2)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total gastos</CardTitle>
          <ArrowDownCircle className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">€{stats.gastos.toFixed(2)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Movimientos</CardTitle>
          <Activity className="h-4 w-4 text-blue-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.totalMovimientos}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mayor ingreso</CardTitle>
          <TrendingUp className="h-4 w-4 text-green-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">€{stats.mayorIngreso.toFixed(2)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Mayor gasto</CardTitle>
          <TrendingDown className="h-4 w-4 text-red-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">€{stats.mayorGasto.toFixed(2)}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Categoría más gastada</CardTitle>
          <BarChart3 className="h-4 w-4 text-purple-600" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{topCategoryName}</div>
        </CardContent>
      </Card>
    </div>
  )
}

