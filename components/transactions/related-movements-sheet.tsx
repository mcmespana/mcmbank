"use client"

import { useEffect, useRef } from "react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ErrorMessage } from "@/components/ui/error-message"
import { AmountDisplay } from "@/components/ui/amount-display"
import { BankAvatar } from "./bank-avatar"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useMovimientos } from "@/hooks/use-movimientos"
import { useCategorias } from "@/hooks/use-categorias"
import { useCuentas } from "@/hooks/use-cuentas"
import { formatDate } from "@/lib/utils/format"
import type { Cuenta, Categoria } from "@/lib/types/database"

interface RelatedMovementsSheetProps {
  account?: Cuenta | null
  category?: Categoria | null
  /** Lista de categorías a incluir (p. ej. una categoría y sus subcategorías). */
  categoryIds?: string[]
  /** Mostrar solo movimientos sin categoría asignada. */
  uncategorized?: boolean
  /** Rango de fechas a aplicar (formato ISO yyyy-mm-dd). */
  from?: string
  to?: string
  /** Título personalizado de la ventana. */
  title?: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RelatedMovementsSheet({
  account,
  category,
  categoryIds,
  uncategorized,
  from,
  to,
  title: titleOverride,
  open,
  onOpenChange,
}: RelatedMovementsSheetProps) {
  const { selectedDelegation } = useDelegationContext()
  const resolvedCategoryIds = category ? [category.id] : categoryIds
  const hasCategoryFilter = Boolean(resolvedCategoryIds && resolvedCategoryIds.length > 0)
  const shouldFetch = Boolean(open && (account?.id || hasCategoryFilter || uncategorized))
  useCategorias(shouldFetch ? selectedDelegation : null, {
    includeGlobal: shouldFetch,
  })
  useCuentas(shouldFetch ? selectedDelegation : null)

  const { movimientos, loading, error, loadMore, hasMore } = useMovimientos(
    shouldFetch ? selectedDelegation : null,
    shouldFetch
      ? {
          cuentaId: account?.id,
          categoriaIds: hasCategoryFilter ? resolvedCategoryIds : undefined,
          uncategorized: uncategorized || undefined,
          fechaDesde: from,
          fechaHasta: to,
        }
      : undefined,
    { pageSize: 50 },
  )

  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!shouldFetch || !hasMore) return
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        loadMore()
      }
    })
    const current = loadMoreRef.current
    if (current) observer.observe(current)
    return () => {
      if (current) observer.unobserve(current)
    }
  }, [loadMore, hasMore, shouldFetch])

  const title = account
    ? `Movimientos de ${account.nombre}`
    : titleOverride
      ? `Movimientos de ${titleOverride}`
      : category
        ? `Movimientos de ${category.nombre}`
        : "Movimientos"

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:w-[640px] sm:max-w-[720px] overflow-y-auto">
          <SheetHeader>
            <SheetTitle>{title}</SheetTitle>
          </SheetHeader>
          <div className="py-6">
            {loading && movimientos.length === 0 ? (
              <div className="flex justify-center py-10">
                <LoadingSpinner size="lg" />
              </div>
            ) : error ? (
              <ErrorMessage message={error} />
            ) : movimientos.length === 0 ? (
              <p className="text-sm text-center text-muted-foreground">No hay movimientos</p>
            ) : (
              <div className="divide-y">
                {movimientos.map((mov) => (
                  <div
                    key={mov.id}
                    className="w-full p-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{mov.concepto}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span>{formatDate(mov.fecha)}</span>
                        {account ? (
                          mov.categoria ? (
                            <span className="flex items-center gap-1">
                              {mov.categoria.emoji && <span>{mov.categoria.emoji}</span>}
                              <span className="truncate">{mov.categoria.nombre}</span>
                            </span>
                          ) : (
                            <span>Sin categoría</span>
                          )
                        ) : (
                          <span className="flex items-center gap-1">
                            <BankAvatar account={mov.cuenta} size="sm" />
                            <span className="truncate">{mov.cuenta.nombre}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <AmountDisplay amount={mov.importe} size="sm" />
                  </div>
                ))}
                {hasMore && (
                  <div ref={loadMoreRef} className="py-4 flex justify-center">
                    <LoadingSpinner size="sm" />
                  </div>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
