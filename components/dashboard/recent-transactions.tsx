"use client"

import Link from "next/link"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovimientos } from "@/hooks/use-movimientos"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { ArrowUpRight, ArrowDownRight, Calendar, Tag } from "lucide-react"

interface Props {
  limit?: number
}

export function RecentTransactions({ limit = 5 }: Props) {
  const { selectedDelegation } = useDelegationContext()
  const { movimientos } = useMovimientos(selectedDelegation)

  const latest = movimientos.slice(0, limit)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-xl font-semibold flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Últimas Transacciones
        </CardTitle>
        <Button variant="ghost" asChild size="sm" className="h-auto p-2 hover:bg-primary/10">
          <Link href="/transacciones" className="flex items-center gap-1">
            Ver todas
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {latest.length === 0 ? (
          <div className="text-center py-8">
            <Calendar className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">Sin movimientos recientes</p>
          </div>
        ) : (
          <div className="space-y-3">
            {latest.map((mov) => (
              <div
                key={mov.id}
                className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`p-2 rounded-full ${
                      mov.importe >= 0 ? "bg-green-100 dark:bg-green-900/20" : "bg-red-100 dark:bg-red-900/20"
                    }`}
                  >
                    {mov.importe >= 0 ? (
                      <ArrowUpRight className="h-4 w-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <ArrowDownRight className="h-4 w-4 text-red-600 dark:text-red-400" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-sm">{mov.concepto || "Sin concepto"}</span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{format(new Date(mov.fecha), "d MMM", { locale: es })}</span>
                      {mov.categoria && (
                        <>
                          <span>•</span>
                          <div className="flex items-center gap-1">
                            {mov.categoria.emoji && <span>{mov.categoria.emoji}</span>}
                            <span>{mov.categoria.nombre}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div
                    className={`font-semibold ${
                      mov.importe >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    }`}
                  >
                    {mov.importe >= 0 ? "+" : "-"}€{Math.abs(mov.importe).toFixed(2)}
                  </div>
                  {!mov.categoria && (
                    <Badge variant="outline" className="text-xs mt-1">
                      <Tag className="h-3 w-3 mr-1" />
                      Sin categoría
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
