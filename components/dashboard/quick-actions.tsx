"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Upload, Download, TrendingUp, TrendingDown, Wallet, PieChart } from "lucide-react"
import { useRouter } from "next/navigation"

export function QuickActions() {
  const router = useRouter()

  const actions = [
    {
      title: "Nueva Transacción",
      description: "Registrar ingreso o gasto",
      icon: Plus,
      action: () => router.push("/transacciones"),
      variant: "default" as const,
    },
    {
      title: "Importar Movimientos",
      description: "CSV, Excel o conexión bancaria",
      icon: Upload,
      action: () => router.push("/transacciones"),
      variant: "outline" as const,
    },
    {
      title: "Ver Informes",
      description: "Análisis y estadísticas",
      icon: PieChart,
      action: () => router.push("/informes"),
      variant: "outline" as const,
    },
    {
      title: "Gestionar Categorías",
      description: "Organizar y personalizar",
      icon: TrendingUp,
      action: () => router.push("/categorias"),
      variant: "outline" as const,
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((action) => (
        <Card key={action.title} className="hover:shadow-md transition-shadow cursor-pointer" onClick={action.action}>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <action.icon className="h-5 w-5 text-primary" />
              </div>
              <CardTitle className="text-lg">{action.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm">{action.description}</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}