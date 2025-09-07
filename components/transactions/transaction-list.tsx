"use client"

import { useEffect, useRef, useMemo } from "react"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ErrorMessage } from "@/components/ui/error-message"
import { TransactionListSkeleton } from "./transaction-list-skeleton"
import { TransactionListRow } from "./transaction-list-row"
import { EmptyState } from "@/components/ui/empty-state"
import { SearchX } from "lucide-react"
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
  onMovementClick: (movement: MovimientoConRelaciones) => void
  onMovementUpdate: (movementId: string, patch: Partial<Movimiento>) => Promise<void>
  onLoadMore?: () => void
  hasMore?: boolean
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
    return <TransactionListSkeleton />
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

  return (
    <div className="space-y-1 p-2 sm:p-4">
      <div className="flex items-center justify-between mb-3 px-1 sm:px-0">
        <p className="text-sm text-muted-foreground font-medium">{total} transacciones encontradas</p>
      </div>

      {movements.map((movement) => (
        <TransactionListRow
          key={movement.id}
          movement={movement}
          account={accountsById[movement.cuenta_id]}
          category={movement.categoria_id ? categoriesById[movement.categoria_id] : undefined}
          categories={categories}
          onMovementUpdate={onMovementUpdate}
          onClick={onMovementClick}
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
