"use client"

import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovimientos } from "@/hooks/use-movimientos"
import { format } from "date-fns"
import { es } from "date-fns/locale"

interface Props {
  limit?: number
}

export function RecentTransactions({ limit = 5 }: Props) {
  const { selectedDelegation } = useDelegationContext()
  const { movimientos } = useMovimientos(selectedDelegation)

  const latest = movimientos.slice(0, limit)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Últimas transacciones</CardTitle>
        <Button variant="ghost" asChild size="sm" className="h-auto p-0">
          <Link href="/transacciones">Ver todas</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {latest.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin movimientos recientes</p>
        ) : (
          <ul className="space-y-2">
            {latest.map((mov) => (
              <li key={mov.id} className="flex items-center justify-between text-sm">
                <div className="flex flex-col">
                  <span>{mov.concepto || "Sin concepto"}</span>
                  <span className="text-muted-foreground">
                    {format(new Date(mov.fecha), "d MMM", { locale: es })}
                    {mov.categoria ? ` • ${mov.categoria.nombre}` : ""}
                  </span>
                </div>
                <span className={mov.importe >= 0 ? "text-green-600" : "text-red-600"}>
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

