"use client"

import { useState, useEffect, useRef } from "react"
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
import { TransactionDetail } from "./transaction-detail"
import type { Cuenta, Categoria, MovimientoConRelaciones, Movimiento } from "@/lib/types/database"

interface RelatedMovementsSheetProps {
  account?: Cuenta | null
  category?: Categoria | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function RelatedMovementsSheet({ account, category, open, onOpenChange }: RelatedMovementsSheetProps) {
  const { selectedDelegation, getCurrentDelegation } = useDelegationContext()
  const { categorias: categories } = useCategorias(getCurrentDelegation()?.organizacion_id)
  const { cuentas: accounts } = useCuentas(selectedDelegation)

  const { movimientos, loading, error, loadMore, hasMore, updateMovimiento } = useMovimientos(
    selectedDelegation,
    {
      cuentaId: account?.id,
      categoriaIds: category ? [category.id] : undefined,
    },
    { pageSize: 50 },
  )

  const [selectedMovement, setSelectedMovement] = useState<MovimientoConRelaciones | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!hasMore) return
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
  }, [loadMore, hasMore])

  const title = account ? `Movimientos de ${account.nombre}` : category ? `Movimientos de ${category.nombre}` : "Movimientos"

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:w-[540px] overflow-y-auto">
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
                  <button
                    key={mov.id}
                    onClick={() => {
                      setSelectedMovement(mov)
                      setDetailOpen(true)
                    }}
                    className="w-full text-left p-4 hover:bg-muted flex items-center justify-between gap-4"
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
                        ) : category ? (
                          <span className="flex items-center gap-1">
                            <BankAvatar account={mov.cuenta} size="sm" />
                            <span className="truncate">{mov.cuenta.nombre}</span>
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <AmountDisplay amount={mov.importe} size="sm" />
                  </button>
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
      <TransactionDetail
        movement={selectedMovement as unknown as Movimiento}
        accounts={accounts as unknown as Cuenta[]}
        categories={categories as unknown as Categoria[]}
        open={detailOpen}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setSelectedMovement(null)
        }}
        onUpdate={async (id, patch) => {
          await updateMovimiento(id, patch)
        }}
        onBack={() => {
          setDetailOpen(false)
          setSelectedMovement(null)
        }}
      />
    </>
  )
}
