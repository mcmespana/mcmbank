"use client"

import { Plus, Upload, List, Tag } from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

export function QuickActions() {
  const router = useRouter()

  const actions = [
    {
      title: "Ver movimientos",
      description: "Listado completo",
      icon: List,
      action: () => router.push("/transacciones"),
      color: "text-sky-500",
      bgColor: "bg-sky-500/10",
    },
    {
      title: "Crear movimiento",
      description: "Registrar ingreso o gasto",
      icon: Plus,
      action: () => router.push("/transacciones?panel=create"),
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      title: "Importar movimientos",
      description: "CSV, Excel o conexión bancaria",
      icon: Upload,
      action: () => router.push("/transacciones?panel=import"),
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
    },
    {
      title: "Crear categoría",
      description: "Organizar y personalizar",
      icon: Tag,
      action: () => router.push("/categorias?panel=create"),
      color: "text-violet-500",
      bgColor: "bg-violet-500/10",
    },
  ]

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {actions.map((action) => (
        <div
          key={action.title}
          onClick={action.action}
          className="group cursor-pointer rounded-xl border bg-card p-4 text-card-foreground shadow-sm transition-all duration-200 hover:border-primary/50 hover:shadow-lg"
        >
          <div className="flex flex-col items-start gap-4">
            <div className={cn("rounded-lg p-3", action.bgColor)}>
              <action.icon className={cn("h-6 w-6", action.color)} />
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-semibold">{action.title}</h3>
              <p className="text-sm text-muted-foreground">{action.description}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
