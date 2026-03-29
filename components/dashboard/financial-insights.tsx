"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertTriangle, CheckCircle, Target, Calendar } from "lucide-react"
import { useFinancialSummary } from "@/hooks/use-financial-summary"
import { Badge } from "@/components/ui/badge"

interface Props {
  from: string
  to: string
}

export function FinancialInsights({ from, to }: Props) {
  const { summary } = useFinancialSummary(from, to)

  const { ingresos, gastos, balance, total_movimientos, sin_categoria } = summary
  const avgTransaction = total_movimientos > 0 ? (ingresos + gastos) / total_movimientos : 0

  const insights = []

  if (total_movimientos === 0) return null

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
  if (sin_categoria > 0) {
    insights.push({
      type: "info" as const,
      icon: Target,
      title: "Transacciones sin categorizar",
      description: `${sin_categoria} transacciones pendientes de etiquetar`,
      badge: "Pendiente",
    })
  }

  // Activity insight
  insights.push({
    type: "info" as const,
    icon: Calendar,
    title: "Actividad del período",
    description: `${total_movimientos} transacciones • Promedio €${avgTransaction.toFixed(2)}`,
    badge: "Activo",
  })

  if (insights.length === 0) return null

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-semibold flex items-center gap-2">
        <div className="h-6 w-1 bg-gradient-to-b from-orange-500 to-red-500 rounded-full" />
        Datitos de interés
      </h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
