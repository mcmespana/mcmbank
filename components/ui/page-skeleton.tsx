import { Skeleton } from "@/components/ui/skeleton"

/**
 * Skeleton genérico de página: una barra de acciones y una lista de filas.
 * Sirve para los loading.tsx de rutas tipo tabla/lista (transacciones,
 * cuentas, categorías, contactos, pagos...).
 */
export function PageSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-wrap gap-2">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-10 flex-1 min-w-[160px]" />
        <Skeleton className="h-10 w-10" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          // Lista estática de placeholders: el índice es una key segura aquí.
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton para el panel de inicio/dashboard: tarjetas KPI + dos bloques
 * grandes (gráficas/tablas).
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Skeleton className="h-80 w-full rounded-xl" />
        <Skeleton className="h-80 w-full rounded-xl" />
      </div>
    </div>
  )
}
