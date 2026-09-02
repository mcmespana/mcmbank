import { Skeleton } from "@/components/ui/skeleton"

/**
 * Skeletons de pantalla. Se usan en dos sitios y por eso viven juntos:
 *
 * - En los `loading.tsx` de cada segmento, que ahora renderizan **dentro** del
 *   layout autenticado (`app/(app)/layout.tsx`): la barra lateral y la
 *   superior siguen en pantalla y solo se sustituye el contenido. Por eso
 *   ninguno lleva padding propio — lo pone el `<main>` del layout.
 * - Como `fallback` de los `<Suspense>` que envuelven a los componentes que
 *   leen `useSearchParams()`, para que la parte estática de la página pueda
 *   pintarse sin esperar al cliente.
 *
 * La regla que siguen todos: ocupar aproximadamente el mismo sitio que el
 * contenido real, para que al llegar los datos no salte el layout.
 */

/** Cabecera de pantalla; tiene que ocupar lo mismo que `PageHeader`. */
function HeaderSkeleton({ actions = 1 }: { actions?: number }) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-1 rounded-full" />
        <Skeleton className="h-8 w-52" />
      </div>
      {actions > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {Array.from({ length: actions }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-28" />
          ))}
        </div>
      )}
    </div>
  )
}

/** Fila de pestañas/filtros horizontales (patrón `FilterTabs`). */
function FilterTabsSkeleton({ tabs = 3 }: { tabs?: number }) {
  return (
    <div className="flex flex-wrap gap-2">
      {Array.from({ length: tabs }).map((_, i) => (
        <Skeleton key={i} className="h-9 w-28 rounded-full" />
      ))}
    </div>
  )
}

/** Lista de tarjetas/filas, la forma dominante en las pantallas de gestión. */
function RowsSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        // Lista estática de placeholders: el índice es una key segura aquí.
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  )
}

/**
 * Skeleton genérico de página tipo lista: cabecera, barra de filtros y filas.
 * Sirve para categorías, contactos, facturas, pagos, propuestas…
 */
export function PageSkeleton({ rows = 8, tabs = 3 }: { rows?: number; tabs?: number }) {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando…</span>
      <HeaderSkeleton />
      <FilterTabsSkeleton tabs={tabs} />
      <RowsSkeleton rows={rows} />
    </div>
  )
}

/**
 * Skeleton del dashboard (`/`, `/resumen`, `/balance`, `/analisis`): cabecera
 * con filtro de periodo, las tres pestañas y el contenido en dos bloques.
 */
export function DashboardSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-live="polite">
      <span className="sr-only">Cargando el panel…</span>
      <HeaderSkeleton actions={2} />

      {/* Las tres pestañas: Resumen / Balance / Análisis */}
      <div className="grid w-full grid-cols-3 gap-1 rounded-lg bg-muted p-1 sm:mx-auto sm:w-fit">
        <Skeleton className="h-9 w-full sm:w-32" />
        <Skeleton className="h-9 w-full sm:w-32" />
        <Skeleton className="h-9 w-full sm:w-32" />
      </div>

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

/**
 * Skeleton de `/transacciones`. Esa pantalla no es una lista suelta: es una
 * columna de filtros a la izquierda (solo en `lg`), una barra de acciones
 * pegada arriba y la lista ocupando el resto del alto. El skeleton reproduce
 * esa caja de alto fijo para que al montar el manager no se mueva nada.
 */
export function TransactionsSkeleton({ rows = 9 }: { rows?: number }) {
  return (
    <div
      className="flex h-[calc(100vh-5rem)] overflow-hidden sm:h-[calc(100vh-6rem)] md:h-[calc(100vh-7rem)] lg:h-[calc(100vh-8rem)]"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Cargando movimientos…</span>

      <div className="hidden w-80 shrink-0 space-y-6 border-r bg-card p-6 lg:block">
        <Skeleton className="h-7 w-28" />
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-40 w-full rounded-lg" />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-2 border-b p-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <Skeleton className="h-9 w-[200px] shrink-0 sm:w-[240px] md:w-[260px]" />
            <Skeleton className="hidden h-9 max-w-xs flex-1 md:block" />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Skeleton className="h-9 w-9 sm:w-24" />
            <Skeleton className="h-9 w-9 sm:w-24" />
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-hidden px-2 pt-3 sm:px-4">
          <Skeleton className="mb-3 h-4 w-44" />
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} className="h-[84px] w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
