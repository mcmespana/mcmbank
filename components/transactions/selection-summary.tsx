"use client"

import { useMemo } from "react"
import { ArrowDownRight, ArrowUpRight, Check, Copy } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { formatCurrency } from "@/lib/utils/format"
import { useClipboard } from "@/hooks/use-clipboard"
import type { MovimientoConRelaciones } from "@/lib/types/database"

interface SelectionSummaryProps {
  movements: MovimientoConRelaciones[]
  className?: string
}

/**
 * Cuánto dinero es lo que has seleccionado, al estilo de la barra de estado de
 * Excel: marcas varias filas y ves el total sin salir de donde estabas.
 *
 * El neto es el titular. El desglose ingresos/gastos solo se pinta cuando la
 * selección mezcla los dos signos: si has marcado catorce gastos, repetir la
 * misma cifra en dos sitios no informa de nada.
 */
export function SelectionSummary({ movements, className }: SelectionSummaryProps) {
  const { copy, isCopied } = useClipboard()

  const { ingresos, gastos, neto, mezclaSignos } = useMemo(() => {
    let ingresos = 0
    let gastos = 0
    for (const movement of movements) {
      if (movement.importe >= 0) ingresos += movement.importe
      else gastos += movement.importe
    }
    return { ingresos, gastos, neto: ingresos + gastos, mezclaSignos: ingresos > 0 && gastos < 0 }
  }, [movements])

  // Se copia en crudo ("1234,56"), sin separador de miles ni símbolo: así se
  // pega directo en una celda de Excel y suma, que es para lo que se recuenta.
  const netoPlano = neto.toFixed(2).replace(".", ",")

  const handleCopy = async () => {
    if (await copy(netoPlano)) toast.success(`${formatCurrency(neto)} copiado`)
  }

  const copiado = isCopied(netoPlano)

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <button
        type="button"
        onClick={handleCopy}
        title="Click para copiar el total"
        className={cn(
          "group -ml-1 flex w-fit items-baseline gap-2 rounded-md px-1 py-0.5 text-left",
          "transition-colors duration-150 hover:bg-primary/10",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
        )}
      >
        <span
          className={cn(
            "text-xl font-bold tabular-nums tracking-tight sm:text-2xl",
            neto === 0
              ? "text-muted-foreground"
              : neto > 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-red-600 dark:text-red-400",
          )}
        >
          {formatCurrency(neto)}
        </span>
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          en {movements.length} {movements.length === 1 ? "movimiento" : "movimientos"}
        </span>
        {copiado ? (
          <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <Copy className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
        )}
      </button>

      {mezclaSignos && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200/70 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300">
            <ArrowUpRight className="h-3 w-3" aria-hidden />
            {formatCurrency(ingresos)}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-red-200/70 bg-red-50 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300">
            <ArrowDownRight className="h-3 w-3" aria-hidden />
            {formatCurrency(Math.abs(gastos))}
          </span>
        </div>
      )}
    </div>
  )
}
