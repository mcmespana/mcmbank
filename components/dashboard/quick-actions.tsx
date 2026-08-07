"use client"

import { memo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Upload, List, Tag, ArrowRight } from "lucide-react"
import { useRouter } from "next/navigation"

// Sin props: memo evita que re-renderice solo porque el padre (dashboard) lo
// hace por otro motivo (cambio de timeframe, resetToken, etc.).
export const QuickActions = memo(function QuickActions() {
  const router = useRouter()

  const actions = [
    {
      title: "Ver Transacciones",
      description: "Listado completo y filtros",
      icon: List,
      action: () => router.push("/transacciones"),
      gradient: "from-blue-500 to-cyan-500",
      bgGradient: "from-blue-50 to-cyan-50 dark:from-blue-950/50 dark:to-cyan-950/50",
    },
    {
      title: "Nueva Transacción",
      description: "Registrar ingreso o gasto",
      icon: Plus,
      action: () => router.push("/transacciones?panel=create"),
      gradient: "from-green-500 to-emerald-500",
      bgGradient: "from-green-50 to-emerald-50 dark:from-green-950/50 dark:to-emerald-950/50",
    },
    {
      title: "Importar Datos",
      description: "CSV, Excel o conexión bancaria",
      icon: Upload,
      action: () => router.push("/transacciones?panel=import"),
      gradient: "from-purple-500 to-violet-500",
      bgGradient: "from-purple-50 to-violet-50 dark:from-purple-950/50 dark:to-violet-950/50",
    },
    {
      title: "Gestionar Categorías",
      description: "Organizar y personalizar",
      icon: Tag,
      action: () => router.push("/categorias?panel=create"),
      gradient: "from-orange-500 to-red-500",
      bgGradient: "from-orange-50 to-red-50 dark:from-orange-950/50 dark:to-red-950/50",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4">
      {actions.map((action) => (
        <Card
          key={action.title}
          className={`bg-gradient-to-br ${action.bgGradient} border-2 border-transparent hover:border-current transition-[transform,box-shadow,border-color] duration-300 cursor-pointer group hover:shadow-lg hover:scale-105 active:scale-[0.98]`}
          onClick={action.action}
        >
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className={`p-3 rounded-xl bg-gradient-to-r ${action.gradient} text-white shadow-lg`}>
                <action.icon className="h-5 w-5" />
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </div>
            <CardTitle className="text-lg group-hover:text-foreground transition-colors">{action.title}</CardTitle>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm group-hover:text-muted-foreground transition-colors">
              {action.description}
            </CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  )
})
