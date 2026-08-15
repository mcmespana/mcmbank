"use client"

import { useCallback, useEffect, useState } from "react"
import dynamic from "next/dynamic"
import { ArrowUpRight, ExternalLink, Loader2, SearchX } from "lucide-react"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { EmptyState } from "@/components/ui/empty-state"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { DatabaseService } from "@/lib/services/database"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { CONTACTO_TIPO_DEFAULT_EMOJIS } from "@/lib/utils/contacto-tipos"
import type { ContactoConCategoriaPredeterminada, MovimientoConRelaciones } from "@/lib/types/database"
import { nombreEfectivoContacto } from "@/lib/types/database"
import { useCuentas } from "@/hooks/use-cuentas"
import { useCategorias } from "@/hooks/use-categorias"
import type { Cuenta, Categoria } from "@/lib/types/database"

// El detalle arrastra medio Movimientos (adjuntos, facturas, historial); que no
// entre en el bundle de Contactos hasta que alguien abre un movimiento.
const TransactionDetail = dynamic(
  () => import("@/components/transactions/transaction-detail").then((m) => m.TransactionDetail),
  { ssr: false },
)

interface ProveedorMovimientosSheetProps {
  contacto: ContactoConCategoriaPredeterminada | null
  delegacionId: string | null
  desde?: string
  hasta?: string
  categorias?: string[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Los movimientos que suman el importe de una fila de la tabla de saldos.
 *
 * Lleva los MISMOS filtros de periodo y actividad que la tabla: si la fila dice
 * 2.417,80 €, lo que se ve aquí tiene que sumar eso. Un desglose que no cuadra
 * con su total es peor que no tener desglose.
 */
export function ProveedorMovimientosSheet({
  contacto,
  delegacionId,
  desde,
  hasta,
  categorias,
  open,
  onOpenChange,
}: ProveedorMovimientosSheetProps) {
  const [movimientos, setMovimientos] = useState<MovimientoConRelaciones[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // El movimiento cuyo detalle se está mirando. Se abre encima de esta lista y
  // `onBack` devuelve aquí, que es lo que hace que ir y volver sea un gesto.
  const [detalle, setDetalle] = useState<MovimientoConRelaciones | null>(null)

  const { cuentas } = useCuentas(delegacionId)
  // Ojo con el nombre: la prop `categorias` son los ids del filtro, no las fichas.
  const { categorias: fichasCategorias } = useCategorias(delegacionId)

  const categoriasClave = (categorias ?? []).slice().sort().join(",")
  const contactoId = contacto?.id ?? null

  // La carga vive en un callback y no en el cuerpo del efecto: llamar a setState
  // directamente ahí dispara renders en cascada (y el linter lo rechaza).
  const cargar = useCallback(
    async (señal: { cancelado: boolean }) => {
      if (!contactoId) return

      setLoading(true)
      setError(null)
      try {
        const data = await DatabaseService.getMovimientosByContacto(contactoId, {
          delegacionId,
          desde,
          hasta,
          categorias: categoriasClave ? categoriasClave.split(",") : undefined,
          limite: 300,
        })
        if (!señal.cancelado) setMovimientos(data)
      } catch (err) {
        if (!señal.cancelado) {
          setError(err instanceof Error ? err.message : "No se pudieron cargar los movimientos")
        }
      } finally {
        if (!señal.cancelado) setLoading(false)
      }
    },
    [contactoId, delegacionId, desde, hasta, categoriasClave],
  )

  useEffect(() => {
    if (!open || !contactoId) return

    const señal = { cancelado: false }
    void cargar(señal)
    return () => {
      señal.cancelado = true
    }
  }, [open, contactoId, cargar])

  /** Enlace a Transacciones con este proveedor y el mismo periodo ya filtrados. */
  const urlEnTransacciones = () => {
    const params = new URLSearchParams()
    if (contactoId) params.set("contacto", contactoId)
    if (desde) params.set("desde", desde)
    if (hasta) params.set("hasta", hasta)
    if (categoriasClave) params.set("categorias", categoriasClave)
    return `/transacciones?${params.toString()}`
  }

  const total = movimientos.reduce((suma, m) => suma + m.importe, 0)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-xl">
        <SheetHeader className="space-y-3 border-b border-border/30 p-6 pb-4">
          <div className="flex items-start gap-3">
            <EntityAvatar
              name={contacto?.nombre}
              emoji={contacto?.emoji}
              defaultEmojis={CONTACTO_TIPO_DEFAULT_EMOJIS}
              colorHex={contacto?.color}
              logoUrl={contacto?.logo_url}
              size="lg"
              seed={contacto ? `contacto:${contacto.id}` : null}
              className="h-12 w-12 text-sm"
            />
            <div className="min-w-0 flex-1 pr-8">
              <SheetTitle className="truncate text-xl tracking-tight">
                {contacto ? nombreEfectivoContacto(contacto) : "Proveedor"}
              </SheetTitle>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {movimientos.length} {movimientos.length === 1 ? "movimiento" : "movimientos"} ·{" "}
                <span className={cn("font-semibold tabular-nums", total < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                  {formatCurrency(total)}
                </span>
              </p>
            </div>
          </div>

          <Button variant="outline" size="sm" asChild className="w-fit">
            <a href={urlEnTransacciones()} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Verlos en Transacciones
            </a>
          </Button>
        </SheetHeader>

        <ScrollArea className="flex-1">
          <div className="space-y-1.5 p-4">
            {loading && movimientos.length === 0 ? (
              <div className="flex items-center gap-2 p-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando movimientos…
              </div>
            ) : error ? (
              <EmptyState title="No se pudieron cargar los movimientos" description={error} />
            ) : movimientos.length === 0 ? (
              <EmptyState
                icon={<SearchX className="h-6 w-6" />}
                title="Sin movimientos en este periodo"
                description="Prueba a ampliar las fechas o a quitar el filtro de actividad."
              />
            ) : (
              movimientos.map((movimiento) => (
                <div
                  key={movimiento.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDetalle(movimiento)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      setDetalle(movimiento)
                    }
                  }}
                  className="group flex cursor-pointer items-center gap-3 rounded-lg border border-border/50 bg-card p-3 transition-colors hover:border-border hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium leading-tight">{movimiento.concepto}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                      <span>{formatDate(movimiento.fecha)}</span>
                      {movimiento.categoria && (
                        <>
                          <span aria-hidden>·</span>
                          <span className="inline-flex items-center gap-1">
                            <span aria-hidden>{movimiento.categoria.emoji ?? "🏷️"}</span>
                            {movimiento.categoria.nombre}
                          </span>
                        </>
                      )}
                    </p>
                  </div>

                  <span
                    className={cn(
                      "shrink-0 text-sm font-semibold tabular-nums",
                      movimiento.importe < 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400",
                    )}
                  >
                    {formatCurrency(movimiento.importe)}
                  </span>

                  {/* Ventana nueva a propósito: se consulta el movimiento sin
                      perder la tabla de saldos que se estaba leyendo. */}
                  <Button
                    variant="ghost"
                    size="icon"
                    asChild
                    className="h-8 w-8 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 focus-visible:opacity-100"
                  >
                    <a
                      href={`/transacciones?mov=${movimiento.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(event) => event.stopPropagation()}
                      title="Abrir este movimiento en una ventana nueva"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                      <span className="sr-only">Abrir en una ventana nueva</span>
                    </a>
                  </Button>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </SheetContent>

      {/* Sin capa propia: se abre sobre este panel, que ya oscurece el fondo. */}
      <TransactionDetail
        movement={detalle}
        accounts={cuentas as unknown as Cuenta[]}
        categories={fichasCategorias as unknown as Categoria[]}
        open={Boolean(detalle)}
        onOpenChange={(abierto) => !abierto && setDetalle(null)}
        onBack={() => setDetalle(null)}
        onUpdate={async (movimientoId, patch) => {
          await DatabaseService.updateMovimiento(movimientoId, patch)
          // Se refleja en la lista de detrás sin volver a pedirla al servidor.
          setMovimientos((prev) =>
            prev.map((m) => (m.id === movimientoId ? { ...m, ...(patch as Partial<MovimientoConRelaciones>) } : m)),
          )
          setDetalle((prev) => (prev && prev.id === movimientoId ? { ...prev, ...(patch as Partial<MovimientoConRelaciones>) } : prev))
        }}
      />
    </Sheet>
  )
}
