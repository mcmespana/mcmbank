"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type React from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { ErrorMessage } from "@/components/ui/error-message"
import { TransactionListRow } from "./transaction-list-row"
import { TransactionListSkeleton } from "./transaction-list-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { MousePointerClick, SearchX } from "lucide-react"
import type {
  Movimiento,
  Cuenta,
  Categoria,
  MovimientoConRelaciones,
} from "@/lib/types/database"

const formatNumber = (n: number) => new Intl.NumberFormat("es-ES").format(n)

/**
 * A partir de este número de filas se monta el virtualizador. Por debajo se
 * renderiza la lista completa, igual que siempre: con pocas filas el ahorro es
 * nulo y el DOM completo conserva ventajas reales (Ctrl+F del navegador,
 * impresión, lectores de pantalla recorriendo todo). Hay delegaciones con
 * cuatro movimientos y delegaciones con más de quinientos: este umbral hace
 * que cada una use la estrategia que le conviene.
 */
const VIRTUALIZATION_THRESHOLD = 60

/**
 * Alto aproximado de una fila (tarjeta de ~84px + 4px de separación). Solo es
 * la estimación inicial: cada fila visible se mide de verdad con
 * `measureElement`, así que los conceptos largos, los chips de contacto que
 * saltan de línea o la edición inline no descuadran el scroll.
 */
const ESTIMATED_ROW_HEIGHT = 92

/** Filas extra renderizadas por encima y por debajo del viewport. */
const OVERSCAN = 8

/**
 * Margen con el que se dispara la carga de la siguiente página: empieza a
 * pedirla ~400px antes de tocar el fondo, así el scroll no se queda seco.
 */
const LOAD_MORE_ROOT_MARGIN = "400px 0px"

/**
 * Cuerpo virtualizado de la lista, aislado a propósito en su propio
 * componente: `useVirtualizer` devuelve funciones que el React Compiler no
 * puede memoizar, así que marca como "no compilable" al componente que lo
 * usa. Manteniéndolo aquí, esa exclusión afecta solo a esta hoja y no a
 * `TransactionList`, que es quien concentra el resto de la lógica.
 */
function VirtualizedRows({
  scrollElement,
  movements,
  renderRow,
}: {
  scrollElement: HTMLDivElement | null
  movements: MovimientoConRelaciones[]
  renderRow: (movement: MovimientoConRelaciones) => React.ReactNode
}) {
  // Clave por id: al añadir una página o borrar en bloque, las medidas ya
  // tomadas siguen asociadas a su movimiento y no a su índice.
  const getItemKey = useCallback((index: number) => movements[index]?.id ?? index, [movements])

  const virtualizer = useVirtualizer({
    count: movements.length,
    getScrollElement: () => scrollElement,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN,
    getItemKey,
  })

  return (
    <div className="relative w-full" style={{ height: `${virtualizer.getTotalSize()}px` }}>
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const movement = movements[virtualRow.index]
        if (!movement) return null

        return (
          <div
            key={virtualRow.key}
            data-index={virtualRow.index}
            ref={virtualizer.measureElement}
            className="absolute left-0 top-0 w-full pb-1"
            style={{ transform: `translateY(${virtualRow.start}px)` }}
          >
            {renderRow(movement)}
          </div>
        )
      })}
    </div>
  )
}

interface TransactionListProps {
  movements: MovimientoConRelaciones[]
  accounts: Cuenta[]
  categories: Categoria[]
  loading: boolean
  error: string | null
  /** Movimientos que cumplen los filtros, no los que hay cargados en pantalla. */
  total: number
  /** Cuántos de esos se han traído ya (paginación). Por defecto, todos. */
  loaded?: number
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
  loaded,
  onMovementClick,
  onMovementUpdate,
  onLoadMore,
  hasMore,
  onOpenFiles,
  selectedMovementIds,
  onMovementSelectionChange,
  onRequestCreateCategory,
}: TransactionListProps) {
  // Refs de callback guardadas en estado (no en useRef): tanto el
  // virtualizador como el IntersectionObserver necesitan re-ejecutarse en
  // cuanto estos nodos existen, y un ref no provoca render.
  const [scrollElement, setScrollElement] = useState<HTMLDivElement | null>(null)
  const [loadMoreElement, setLoadMoreElement] = useState<HTMLDivElement | null>(null)

  // El manager recrea sus handlers en cada render (no son useCallback), así que
  // pasarlos tal cual a las filas anularía el React.memo de TransactionListRow:
  // cada tecla del buscador re-renderizaría todas las filas montadas. Guardamos
  // la última versión en un ref y exponemos wrappers de identidad fija. El
  // espejo se hace en un efecto (no en render) y los wrappers solo se invocan
  // desde eventos, que siempre ocurren después del commit.
  const handlersRef = useRef({
    onMovementClick,
    onMovementUpdate,
    onOpenFiles,
    onMovementSelectionChange,
    onRequestCreateCategory,
  })

  useEffect(() => {
    handlersRef.current = {
      onMovementClick,
      onMovementUpdate,
      onOpenFiles,
      onMovementSelectionChange,
      onRequestCreateCategory,
    }
  }, [
    onMovementClick,
    onMovementUpdate,
    onOpenFiles,
    onMovementSelectionChange,
    onRequestCreateCategory,
  ])

  const handleRowClick = useCallback(
    (movement: MovimientoConRelaciones, event: React.MouseEvent) =>
      handlersRef.current.onMovementClick(movement, event),
    [],
  )

  const handleRowUpdate = useCallback(
    (movementId: string, patch: Partial<Movimiento>) =>
      handlersRef.current.onMovementUpdate(movementId, patch),
    [],
  )

  const handleRowOpenFiles = useCallback(
    (movement: MovimientoConRelaciones) => handlersRef.current.onOpenFiles?.(movement),
    [],
  )

  // Crear una categoría desde el selector de una fila. Estaba declarada en las
  // props pero no llegaba a la fila, así que el botón "+" del mega selector no
  // hacía nada en la lista (en el detalle sí, que era lo que despistaba).
  const handleRowRequestCreateCategory = useCallback(
    (assign: (categoryId: string) => void | Promise<void>) =>
      handlersRef.current.onRequestCreateCategory?.(assign),
    [],
  )

  const handleRowSelectionChange = useCallback(
    (movementId: string, selected: boolean, rangeFromAnchor?: boolean) =>
      handlersRef.current.onMovementSelectionChange(movementId, selected, rangeFromAnchor),
    [],
  )

  useEffect(() => {
    if (!onLoadMore || !hasMore || !loadMoreElement || !scrollElement) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          onLoadMore()
        }
      },
      // El scroll es el del contenedor de la lista, no el de la ventana: hay
      // que declararlo como `root` para que `rootMargin` signifique algo.
      { root: scrollElement, rootMargin: LOAD_MORE_ROOT_MARGIN },
    )

    observer.observe(loadMoreElement)

    return () => {
      observer.disconnect()
    }
  }, [onLoadMore, hasMore, loadMoreElement, scrollElement])

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

  // `includes` por fila sería O(n²) al recorrer la lista completa.
  const selectedIds = useMemo(() => new Set(selectedMovementIds), [selectedMovementIds])

  const shouldVirtualize = movements.length >= VIRTUALIZATION_THRESHOLD

  const selectionActive = selectedMovementIds.length > 0

  const renderRow = useCallback(
    (movement: MovimientoConRelaciones) => (
      <TransactionListRow
        key={movement.id}
        movement={movement}
        account={accountsById[movement.cuenta_id]}
        category={movement.categoria_id ? categoriesById[movement.categoria_id] : undefined}
        categories={categories}
        onMovementUpdate={handleRowUpdate}
        onClick={handleRowClick}
        onOpenFiles={onOpenFiles ? handleRowOpenFiles : undefined}
        isSelected={selectedIds.has(movement.id)}
        selectionActive={selectionActive}
        onSelectionChange={handleRowSelectionChange}
        onRequestCreateCategory={onRequestCreateCategory ? handleRowRequestCreateCategory : undefined}
      />
    ),
    [
      accountsById,
      categoriesById,
      categories,
      handleRowUpdate,
      handleRowClick,
      handleRowRequestCreateCategory,
      onRequestCreateCategory,
      handleRowOpenFiles,
      handleRowSelectionChange,
      onOpenFiles,
      selectedIds,
      selectionActive,
    ],
  )

  // "Mostrando 100 de 956 movimientos": el número cargado por sí solo se leía
  // como si no hubiera más, justo cuando lo que se quiere saber es cuántos
  // dejan fuera los filtros. Cuando ya están todos, sobra la primera mitad.
  const cargados = loaded ?? movements.length
  const textoRecuento =
    cargados < total
      ? `Mostrando ${formatNumber(cargados)} de ${formatNumber(total)} movimientos`
      : `${formatNumber(total)} ${total === 1 ? "movimiento" : "movimientos"}`

  if (loading && movements.length === 0) {
    return (
      <div className="h-full overflow-auto">
        <TransactionListSkeleton />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full overflow-auto">
        <ErrorMessage message={error} />
      </div>
    )
  }

  if (movements.length === 0) {
    return (
      <div className="h-full overflow-auto">
        <EmptyState
          title="No se encontraron transacciones"
          description="Prueba ajustando los filtros o agrega una nueva transacción para comenzar."
          icon={<SearchX className="h-6 w-6" />}
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Cabecera fuera del área de scroll: el virtualizador posiciona las filas
          respecto al scrollTop del contenedor, así que cualquier contenido en
          flujo por encima de ellas desplazaría todas las medidas. */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-2 pt-3 pb-2 sm:px-4">
        <p className="text-sm text-muted-foreground font-medium">{textoRecuento}</p>
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

      {/* En móvil el margen lateral se queda en lo justo para que se vea la
          sombra de la tarjeta, y es el mismo que el de la cabecera de arriba
          para que las tarjetas no bailen respecto al texto. */}
      <div ref={setScrollElement} className="flex-1 min-h-0 overflow-auto px-2 pb-2 sm:px-4 sm:pb-4">
        {shouldVirtualize ? (
          <VirtualizedRows scrollElement={scrollElement} movements={movements} renderRow={renderRow} />
        ) : (
          <div className="space-y-1">{movements.map(renderRow)}</div>
        )}

        {hasMore && (
          <div ref={setLoadMoreElement} className="py-4 flex justify-center">
            <LoadingSpinner size="sm" />
          </div>
        )}
      </div>
    </div>
  )
}
