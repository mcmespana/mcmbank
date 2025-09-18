"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, CheckCircle, Target, Calendar } from "lucide-react"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useMemo } from "react"
import { Badge } from "@/components/ui/badge"

interface Props {
  from: string
  to: string
}

export function FinancialInsights({ from, to }: Props) {
  const { selectedDelegation } = useDelegationContext()
  const { movimientos } = useMovimientos(selectedDelegation, {
    fechaDesde: from,
    fechaHasta: to,
  })

  const insights = useMemo(() => {
    if (!movimientos.length) return []

    const totalIngresos = movimientos.filter((m) => m.importe > 0).reduce((sum, m) => sum + m.importe, 0)
    const totalGastos = movimientos.filter((m) => m.importe < 0).reduce((sum, m) => sum + Math.abs(m.importe), 0)
    const balance = totalIngresos - totalGastos
    const uncategorized = movimientos.filter((m) => !m.categoria_id).length
    const avgTransaction = movimientos.length > 0 ? (totalIngresos + totalGastos) / movimientos.length : 0

    const insights = []

    // Balance insight
    if (balance > 0) {
      insights.push({
        type: "positive" as const,
        icon: CheckCircle,
        title: "Balance Positivo",
        description: `Superávit de €${balance.toFixed(2)}`,
        badge: "Excelente",
      })
    } else if (balance < 0) {
      insights.push({
        type: "warning" as const,
        icon: AlertTriangle,
        title: "Balance Negativo",
        description: `Déficit de €${Math.abs(balance).toFixed(2)}`,
        badge: "Atención",
      })
    }

    // Uncategorized insight
    if (uncategorized > 0) {
      insights.push({
        type: "info" as const,
        icon: Target,
        title: "Transacciones sin categorizar",
        description: `${uncategorized} transacciones pendientes de etiquetar`,
        badge: "Pendiente",
      })
    }

    // Activity insight
    if (movimientos.length > 0) {
      insights.push({
        type: "info" as const,
        icon: Calendar,
        title: "Actividad del período",
        description: `${movimientos.length} transacciones • Promedio €${avgTransaction.toFixed(2)}`,
        badge: "Activo",
      })
    }

    return insights
  }, [movimientos])

  if (insights.length === 0) return null

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <div className="h-6 w-1 bg-gradient-to-b from-orange-500 to-red-500 rounded-full" />
        Datitos de interés
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {insights.map((insight, index) => (
          <Card key={index} className="relative overflow-hidden">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className={`p-2 rounded-lg ${
                      insight.type === "positive"
                        ? "bg-green-100 dark:bg-green-900/20"
                        : insight.type === "warning"
                          ? "bg-orange-100 dark:bg-orange-900/20"
                          : "bg-blue-100 dark:bg-blue-900/20"
                    }`}
                  >
                    <insight.icon
                      className={`h-4 w-4 ${
                        insight.type === "positive"
                          ? "text-green-600 dark:text-green-400"
                          : insight.type === "warning"
                            ? "text-orange-600 dark:text-orange-400"
                            : "text-blue-600 dark:text-blue-400"
                      }`}
                    />
                  </div>
                  <CardTitle className="text-sm font-medium">{insight.title}</CardTitle>
                </div>
                <Badge
                  variant={
                    insight.type === "positive" ? "default" : insight.type === "warning" ? "destructive" : "secondary"
                  }
                >
                  {insight.badge}
                </Badge>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{insight.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
