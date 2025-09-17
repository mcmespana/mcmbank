"use client"

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
  ] as const

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {actions.map((action) => (
        <Card
          key={action.title}
          className="group relative cursor-pointer overflow-hidden border border-white/10 bg-gradient-to-br from-slate-900/80 via-slate-900/60 to-slate-900/30 p-6 text-slate-200 shadow-[0_20px_45px_-35px_rgba(16,76,140,0.9)] transition-all hover:border-white/20 hover:shadow-[0_35px_70px_-40px_rgba(16,76,140,1)]"
          onClick={action.action}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_80%_0%,rgba(46,106,234,0.25),transparent_65%)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
          <CardHeader className="relative pb-4">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-primary">
                <action.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-lg font-semibold text-white">{action.title}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="relative pt-0">
            <CardDescription className="text-sm text-slate-300">{action.description}</CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
