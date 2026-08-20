"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { describirError } from "@/lib/utils/describir-error"
import { ArrowUpRight, EyeOff, Link2Off, Loader2, ShieldAlert, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { DatabaseService } from "@/lib/services/database"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { Categoria } from "@/lib/types/database"

type Usos = Awaited<ReturnType<typeof DatabaseService.getUsosCategoria>>

interface DeleteCategoryDialogProps {
  categoria: Categoria
  onConfirm: () => void | Promise<void>
  onCancel: () => void
  /** Se avisa tras desvincular para que la lista vuelva a leer los datos. */
  onUnlinked?: () => void
  /** Alternativa no destructiva: desactivar la categoría en vez de borrarla. */
  onDeactivate?: () => void | Promise<void>
}

/**
 * Borrar una categoría, sabiendo antes qué lo impide.
 *
 * Este diálogo prometía que "las transacciones no se eliminarán, pero perderán
 * su asignación de categoría". No era verdad: `movimiento.categoria_id` es
 * `NO ACTION`, así que con un solo movimiento detrás el borrado **falla**, y lo
 * único que se veía era un "Error al eliminar la categoría". Lo mismo con las
 * subcategorías y con las reglas.
 *
 * Así que primero se mira quién la usa, se enseña, y se ofrece lo que de verdad
 * describía aquel texto: quitarla de sus movimientos sin borrar ninguno.
 */
export function DeleteCategoryDialog({
  categoria,
  onConfirm,
  onCancel,
  onUnlinked,
  onDeactivate,
}: DeleteCategoryDialogProps) {
  const [busy, setBusy] = useState(false)
  const [usos, setUsos] = useState<Usos | null>(null)
  const [cargando, setCargando] = useState(false)

  const categoriaId = categoria.id

  const cargarUsos = useCallback(
    async (señal: { cancelado: boolean }) => {
      setCargando(true)
      try {
        const datos = await DatabaseService.getUsosCategoria(categoriaId)
        if (!señal.cancelado) setUsos(datos)
      } catch (error) {
        console.error("Error consultando los usos de la categoría:", error)
        if (!señal.cancelado) setUsos(null)
      } finally {
        if (!señal.cancelado) setCargando(false)
      }
    },
    [categoriaId],
  )

  useEffect(() => {
    const señal = { cancelado: false }
    void cargarUsos(señal)
    return () => {
      señal.cancelado = true
    }
  }, [cargarUsos])

  const subcategorias = usos?.subcategorias ?? []
  const totalMovimientos = usos?.totalMovimientos ?? 0
  const totalFacturas = usos?.totalFacturas ?? 0
  const reglas = usos?.reglas ?? 0

  // Lo que impide el borrado a nivel de base de datos (FKs `NO ACTION`).
  const bloqueadoPorSubcategorias = subcategorias.length > 0
  const bloqueadoPorMovimientos = totalMovimientos > 0
  const bloqueadoPorReglas = reglas > 0
  const bloqueado = bloqueadoPorSubcategorias || bloqueadoPorMovimientos || bloqueadoPorReglas

  // Desvincular resuelve movimientos y facturas, pero no las subcategorías ni
  // las reglas: esas hay que moverlas o borrarlas a mano.
  const puedeDesvincular = totalMovimientos > 0 || totalFacturas > 0

  const handleDelete = async () => {
    setBusy(true)
    try {
      await onConfirm()
    } finally {
      setBusy(false)
    }
  }

  const handleDesvincular = async () => {
    setBusy(true)
    try {
      const { movimientos, facturas } = await DatabaseService.desvincularCategoria(categoriaId)
      const partes = [
        movimientos > 0 ? `${movimientos} ${movimientos === 1 ? "movimiento" : "movimientos"}` : null,
        facturas > 0 ? `${facturas} ${facturas === 1 ? "factura" : "facturas"}` : null,
      ].filter(Boolean)
      toast.success(
        partes.length > 0
          ? `${categoria.nombre} quitada de ${partes.join(" y ")}. No se ha borrado nada.`
          : `${categoria.nombre} ya no estaba en uso.`,
      )
      onUnlinked?.()
      await cargarUsos({ cancelado: false })
    } catch (err) {
      toast.error(describirError(err, "No se ha podido desvincular"))
    } finally {
      setBusy(false)
    }
  }

  const handleDeactivate = async () => {
    if (!onDeactivate) return
    setBusy(true)
    try {
      await onDeactivate()
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !busy && !v && onCancel()}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5 shrink-0" />
            Eliminar <span className="truncate">{categoria.nombre}</span>
          </DialogTitle>
          <DialogDescription>
            {cargando
              ? "Comprobando qué está usando esta categoría…"
              : bloqueado
                ? "No se puede borrar todavía. Esto es lo que lo impide."
                : "No la usa nada. Se puede borrar sin consecuencias."}
          </DialogDescription>
        </DialogHeader>

        {cargando && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        )}

        {!cargando && usos && (
          <div className="space-y-3 overflow-y-auto">
            {bloqueadoPorSubcategorias && (
              <Alert className="border-red-300/60 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/30">
                <AlertDescription className="flex gap-2 text-xs">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <span>
                    Tiene <strong>{subcategorias.length}</strong>{" "}
                    {subcategorias.length === 1 ? "subcategoría" : "subcategorías"} (
                    {subcategorias.map((s) => s.nombre).join(", ")}). Sácalas de aquí arrastrándolas, o bórralas antes.
                  </span>
                </AlertDescription>
              </Alert>
            )}

            {bloqueadoPorReglas && (
              <Alert className="border-red-300/60 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/30">
                <AlertDescription className="text-xs">
                  Hay <strong>{reglas}</strong> {reglas === 1 ? "regla" : "reglas"} de auto-categorización apuntando a
                  esta categoría. Hay que quitarlas antes de poder borrarla.
                </AlertDescription>
              </Alert>
            )}

            {(totalMovimientos > 0 || totalFacturas > 0) && (
              <div className="rounded-lg border border-border/60">
                <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
                  <span className="text-xs font-semibold">
                    {totalMovimientos > 0 && (
                      <>
                        {totalMovimientos} {totalMovimientos === 1 ? "movimiento" : "movimientos"}
                      </>
                    )}
                    {totalMovimientos > 0 && totalFacturas > 0 && " · "}
                    {totalFacturas > 0 && (
                      <>
                        {totalFacturas} {totalFacturas === 1 ? "factura" : "facturas"}
                      </>
                    )}
                  </span>
                  <span className="text-[11px] text-muted-foreground">no se borran</span>
                </div>

                <ScrollArea className="max-h-52">
                  <div className="divide-y divide-border/40">
                    {usos.movimientos.map((movimiento) => (
                      <div key={movimiento.id} className="flex items-center gap-2 px-3 py-1.5">
                        <span className="w-[68px] shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {formatDate(movimiento.fecha)}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs">{movimiento.concepto}</span>
                        <span
                          className={cn(
                            "shrink-0 text-xs font-semibold tabular-nums",
                            movimiento.importe < 0
                              ? "text-red-600 dark:text-red-400"
                              : "text-emerald-600 dark:text-emerald-400",
                          )}
                        >
                          {formatCurrency(movimiento.importe)}
                        </span>
                        <a
                          href={`/transacciones?mov=${movimiento.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="Abrir en una ventana nueva"
                          className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                        >
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {totalMovimientos > usos.movimientos.length && (
                  <p className="border-t border-border/40 px-3 py-1.5 text-[11px] text-muted-foreground">
                    y {totalMovimientos - usos.movimientos.length} movimientos más
                  </p>
                )}
              </div>
            )}

            {onDeactivate && (
              <Alert className="border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/30">
                <AlertDescription className="text-xs">
                  💡 Si solo quieres dejar de verla al categorizar, <strong>desactívala</strong>. Desaparece de las
                  listas y el histórico se queda intacto.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            Cancelar
          </Button>

          {puedeDesvincular && (
            <Button variant="outline" onClick={handleDesvincular} disabled={busy}>
              <Link2Off className="mr-2 h-4 w-4" />
              Solo desvincular
            </Button>
          )}

          {onDeactivate && (
            <Button variant="outline" onClick={handleDeactivate} disabled={busy}>
              <EyeOff className="mr-2 h-4 w-4" /> Desactivar
            </Button>
          )}

          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={busy || cargando || bloqueado}
            title={bloqueado ? "Todavía hay cosas que dependen de esta categoría" : undefined}
          >
            {busy ? "Procesando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
