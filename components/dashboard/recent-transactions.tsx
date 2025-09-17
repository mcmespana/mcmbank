"use client"

import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovimientos } from "@/hooks/use-movimientos"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { cn } from "@/lib/utils"

interface Props {
  limit?: number
}

export function RecentTransactions({ limit = 5 }: Props) {
  const { selectedDelegation } = useDelegationContext()
  const { movimientos } = useMovimientos(selectedDelegation)

  const latest = movimientos.slice(0, limit)

  return (
    <Card className="relative overflow-hidden border border-white/20 bg-white/70 text-foreground dark:border-white/10 dark:bg-white/5">
      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-white/70 via-primary/5 to-transparent dark:from-white/5" aria-hidden />
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base font-semibold text-foreground/80 dark:text-white/90">
          Últimas transacciones
        </CardTitle>
        <Button
          variant="ghost"
          asChild
          size="sm"
          className="rounded-full border border-white/30 bg-white/50 px-3 py-1 text-xs font-semibold text-foreground/80 hover:bg-white/70 hover:text-foreground dark:border-white/10 dark:bg-white/5 dark:text-white"
        >
          <Link href="/transacciones">Ver todas</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {latest.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos recientes</p>
        ) : (
          <ul className="space-y-3">
            {latest.map((mov) => (
              <li
                key={mov.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-white/20 bg-white/60 px-3 py-2 text-sm shadow-sm transition-colors hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:hover:bg-white/10"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-foreground dark:text-white">
                    {mov.concepto || "Sin concepto"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(mov.fecha), "d MMM", { locale: es })}
                    {mov.categoria ? ` • ${mov.categoria.nombre}` : ""}
                  </span>
                </div>
                <span
                  className={cn(
                    "text-sm font-semibold",
                    mov.importe >= 0 ? "text-emerald-500" : "text-rose-500",
                  )}
                >
                  {mov.importe >= 0 ? "+" : "-"}€{Math.abs(mov.importe).toFixed(2)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

