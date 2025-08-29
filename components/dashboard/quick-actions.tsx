"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Upload, List, Tag } from "lucide-react"
import { useRouter } from "next/navigation"

export function QuickActions() {
  const router = useRouter()

  const actions = [
    {
      title: "Ver movimientos",
      description: "Listado completo",
      icon: List,
      action: () => router.push("/transacciones"),
      variant: "default" as const,
    },
    {
      title: "Crear movimiento",
      description: "Registrar ingreso o gasto",
      icon: Plus,
      action: () => router.push("/transacciones?panel=create"),
      variant: "outline" as const,
    },
    {
      title: "Importar movimientos",
      description: "CSV, Excel o conexión bancaria",
      icon: Upload,
      action: () => router.push("/transacciones?panel=import"),
      variant: "outline" as const,
    },
    {
      title: "Crear categoría",
      description: "Organizar y personalizar",
      icon: Tag,
      action: () => router.push("/categorias?panel=create"),
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
