"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Scale, Wallet, Tag, CheckCircle2 } from "lucide-react"
import { useFinancialSummary } from "@/hooks/use-financial-summary"
import { useRouter } from "next/navigation"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface Props {
  from: string
  to: string
}

export function FinancialSummary({ from, to }: Props) {
  const router = useRouter()
  const { summary } = useFinancialSummary(from, to)
  // Saldo real: balance de TODA la historia (cuentas activas, sin ignorados).
  // No depende del periodo seleccionado — es el dinero que hay ahora.
  const today = new Date().toISOString().slice(0, 10)
  const { summary: allTime } = useFinancialSummary("1970-01-01", today)

  const pendientes = summary.sin_categoria

  return (
    <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 xl:grid-cols-5">
      {/* Saldo actual en cuentas — independiente del periodo */}
      <Card className="border-primary/30">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-full bg-primary/10 p-2">
            <Wallet className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Saldo en cuentas</p>
            <p className="truncate text-xl font-bold tabular-nums">{formatCurrency(allTime.balance)}</p>
            <p className="text-[11px] text-muted-foreground">total actual</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-full bg-green-100 p-2 dark:bg-green-900/40">
            <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Ingresos</p>
            <p className="truncate text-xl font-bold tabular-nums text-green-600 dark:text-green-400">
              {formatCurrency(summary.ingresos)}
            </p>
            <p className="text-[11px] text-muted-foreground">en el periodo</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-full bg-red-100 p-2 dark:bg-red-900/40">
            <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Gastos</p>
            <p className="truncate text-xl font-bold tabular-nums text-red-600 dark:text-red-400">
              {formatCurrency(summary.gastos)}
            </p>
            <p className="text-[11px] text-muted-foreground">en el periodo</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-full bg-muted p-2">
            <Scale className="h-5 w-5 text-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Balance</p>
            <p
              className={cn(
                "truncate text-xl font-bold tabular-nums",
                summary.balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400",
              )}
            >
              {summary.balance >= 0 ? "+" : ""}
              {formatCurrency(summary.balance)}
            </p>
            <p className="text-[11px] text-muted-foreground">{summary.total_movimientos} transacciones</p>
          </div>
        </CardContent>
      </Card>

      {/* Pendientes de categorizar — accionable */}
      <Card
        className={cn(
          "cursor-pointer transition-colors",
          pendientes > 0
            ? "border-amber-300 bg-amber-50/50 hover:bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 dark:hover:bg-amber-950/30"
            : "hover:bg-muted/40",
        )}
        onClick={() => router.push("/transacciones?uncategorized=1")}
        role="button"
        title="Ver transacciones sin categorizar"
      >
        <CardContent className="flex items-center gap-3 p-4">
          <div
            className={cn(
              "rounded-full p-2",
              pendientes > 0 ? "bg-amber-100 dark:bg-amber-900/40" : "bg-green-100 dark:bg-green-900/40",
            )}
          >
            {pendientes > 0 ? (
              <Tag className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            ) : (
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Sin categorizar</p>
            <p className="truncate text-xl font-bold tabular-nums">{pendientes}</p>
            <p className="text-[11px] text-muted-foreground">{pendientes > 0 ? "click para etiquetar" : "todo al día"}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
