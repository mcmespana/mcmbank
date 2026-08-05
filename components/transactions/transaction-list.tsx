"use client"

import { useEffect, useRef, useMemo } from "react"
import type React from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ErrorMessage } from "@/components/ui/error-message"
import { TransactionListRow } from "./transaction-list-row"
import { EmptyState } from "@/components/ui/empty-state"
import { MousePointerClick, SearchX } from "lucide-react"
import type {
  Movimiento,
  Cuenta,
  Categoria,
  MovimientoConRelaciones,
} from "@/lib/types/database"

interface TransactionListProps {
  movements: MovimientoConRelaciones[]
  accounts: Cuenta[]
  categories: Categoria[]
  loading: boolean
  error: string | null
  total: number
  onMovementClick: (movement: MovimientoConRelaciones, event?: React.MouseEvent) => void
  onMovementUpdate: (movementId: string, patch: Partial<Movimiento>) => Promise<void>
  onLoadMore?: () => void
  hasMore?: boolean
  onOpenFiles?: (movement: MovimientoConRelaciones) => void
  selectedMovementIds: string[]
  onMovementSelectionChange: (movementId: string, selected: boolean, rangeFromAnchor?: boolean) => void
  onRequestCreateCategory?: (assign: (categoryId: string) => void | Promise<void>) => void
}

export function TransactionList({
  movements,
  accounts,
  categories,
  loading,
  error,
  total,
  onMovementClick,
  onMovementUpdate,
  onLoadMore,
  hasMore,
  onOpenFiles,
  selectedMovementIds,
  onMovementSelectionChange,
}: TransactionListProps) {
  const loadMoreRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!onLoadMore || !hasMore) return

    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        onLoadMore()
      }
    })

    const current = loadMoreRef.current
    if (current) {
      observer.observe(current)
    }

    return () => {
      if (current) {
        observer.unobserve(current)
      }
    }
  }, [onLoadMore, hasMore])

  const accountsById = useMemo(() => {
    const map: Record<string, Cuenta> = {}
    for (const acc of accounts) {
      map[acc.id] = acc
    }
    return map
  }, [accounts])

  const categoriesById = useMemo(() => {
    const map: Record<string, Categoria> = {}
    for (const cat of categories) {
      map[cat.id] = cat
    }
    return map
  }, [categories])

  if (loading && movements.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (error) {
    return <ErrorMessage message={error} />
  }

  if (movements.length === 0) {
    return (
      <EmptyState
        title="No se encontraron transacciones"
        description="Prueba ajustando los filtros o agrega una nueva transacción para comenzar."
        icon={<SearchX className="h-6 w-6" />}
      />
    )
  }

  const selectionActive = selectedMovementIds.length > 0

  return (
    <div className="space-y-1 p-2 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3 px-1 sm:px-0">
        <p className="text-sm text-muted-foreground font-medium">{total} transacciones encontradas</p>
        {!selectionActive && movements.length > 1 && (
          <p className="hidden sm:flex items-center gap-1.5 text-xs text-muted-foreground">
            <MousePointerClick className="h-3.5 w-3.5" />
            <span>
              Click sobre el círculo para seleccionar varias ·{" "}
              <kbd className="rounded border bg-muted px-1 py-0.5 font-mono text-[10px]">Shift</kbd>+Click para un
              rango
            </span>
          </p>
        )}
      </div>

      {movements.map((movement) => (
        <TransactionListRow
          key={movement.id}
          movement={movement}
          account={accountsById[movement.cuenta_id]}
          category={movement.categoria_id ? categoriesById[movement.categoria_id] : undefined}
          categories={categories}
          onMovementUpdate={onMovementUpdate}
          onClick={(item, event) => onMovementClick(item, event)}
          onOpenFiles={onOpenFiles}
          isSelected={selectedMovementIds.includes(movement.id)}
          selectionActive={selectionActive}
          onSelectionChange={(selected, rangeFromAnchor) =>
            onMovementSelectionChange(movement.id, selected, rangeFromAnchor)
          }
        />
      ))}
      {hasMore && (
        <div ref={loadMoreRef} className="py-4 flex justify-center">
          <LoadingSpinner size="sm" />
        </div>
      )}
    </div>
  )
}
