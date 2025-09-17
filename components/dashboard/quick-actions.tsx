"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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
      accent: "from-sky-500/15 via-sky-500/5 to-transparent dark:from-sky-500/10 dark:via-sky-500/5",
      iconWrapper: "bg-sky-500/15 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
      action: () => router.push("/transacciones"),
    },
    {
      title: "Crear movimiento",
      description: "Registrar ingreso o gasto",
      icon: Plus,
      accent: "from-emerald-500/15 via-emerald-500/5 to-transparent dark:from-emerald-500/10 dark:via-emerald-500/5",
      iconWrapper: "bg-emerald-500/15 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
      action: () => router.push("/transacciones?panel=create"),
    },
    {
      title: "Importar movimientos",
      description: "CSV, Excel o conexión bancaria",
      icon: Upload,
      accent: "from-indigo-500/15 via-indigo-500/5 to-transparent dark:from-indigo-500/10 dark:via-indigo-500/5",
      iconWrapper: "bg-indigo-500/15 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300",
      action: () => router.push("/transacciones?panel=import"),
    },
    {
      title: "Crear categoría",
      description: "Organizar y personalizar",
      icon: Tag,
      accent: "from-amber-400/20 via-amber-400/5 to-transparent dark:from-amber-400/15 dark:via-amber-400/5",
      iconWrapper: "bg-amber-400/20 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300",
      action: () => router.push("/categorias?panel=create"),
    },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {actions.map((action) => (
        <Card
          key={action.title}
          className="relative cursor-pointer border border-white/20 bg-white/70 text-foreground shadow-[0_18px_50px_-30px_rgba(37,99,235,0.45)] transition-transform duration-300 hover:-translate-y-1 dark:border-white/10 dark:bg-white/5"
          onClick={action.action}
        >
          <div className={cn("absolute inset-0 -z-10 bg-gradient-to-br", action.accent)} aria-hidden />
          <CardHeader className="pb-2">
            <div className="flex items-center gap-3">
              <div className={cn("rounded-xl p-2 shadow-inner shadow-black/5", action.iconWrapper)}>
                <action.icon className="h-5 w-5" />
              </div>
              <CardTitle className="text-base font-semibold text-foreground/90 dark:text-white">
                {action.title}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <CardDescription className="text-sm text-foreground/70 dark:text-white/70">
              {action.description}
            </CardDescription>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
