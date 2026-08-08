import { Skeleton } from "@/components/ui/skeleton"

/**
 * Placeholder con la forma real de una fila de movimiento (avatar redondo,
 * concepto, chip de categoría, importe + fecha). Sustituye al spinner
 * centrado de la carga inicial: ocupa el mismo alto que las filas reales, así
 * que no hay salto de layout cuando llegan los datos.
 */
function TransactionRowSkeleton() {
  return (
    <div className="rounded-lg border border-border/50 bg-card p-3 shadow-sm">
      <div className="flex items-start gap-3">
        <Skeleton className="h-9 w-9 flex-shrink-0 rounded-full" />
        <div className="flex-1 min-w-0 space-y-2">
          <Skeleton className="h-4 w-1/2 max-w-[220px]" />
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <Skeleton className="h-5 w-20" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  )
}

export function TransactionListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-1 p-2 sm:p-4" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando movimientos…</span>
      {Array.from({ length: rows }).map((_, index) => (
        // Lista estática de placeholders: el índice es una key segura aquí.
        <TransactionRowSkeleton key={index} />
      ))}
    </div>
  )
}
