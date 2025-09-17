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
    <Card className="overflow-hidden border border-white/10 bg-slate-900/70 text-slate-200 shadow-[0_20px_45px_-35px_rgba(16,76,140,0.9)]">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div>
          <CardTitle className="text-lg font-semibold text-white">Últimas transacciones</CardTitle>
          <p className="text-xs text-slate-400">Una mirada rápida a tus últimos movimientos registrados.</p>
        </div>
        <Button
          variant="ghost"
          asChild
          size="sm"
          className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.3em] text-slate-200 transition hover:bg-white/10"
        >
          <Link href="/transacciones">Ver todas</Link>
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        {latest.length === 0 ? (
          <p className="text-sm text-slate-400">Sin movimientos recientes</p>
        ) : (
          <ul className="space-y-3">
            {latest.map((mov) => (
              <li
                key={mov.id}
                className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/5 px-4 py-3 text-sm transition hover:border-white/15 hover:bg-white/10"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-white">{mov.concepto || "Sin concepto"}</span>
                  <span className="text-xs text-slate-300">
                    {format(new Date(mov.fecha), "d MMM", { locale: es })}
                    {mov.categoria ? ` • ${mov.categoria.nombre}` : ""}
                  </span>
                </div>
                <span
                  className={
                    mov.importe >= 0
                      ? "font-semibold text-emerald-300"
                      : "font-semibold text-rose-300"
                  }
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

