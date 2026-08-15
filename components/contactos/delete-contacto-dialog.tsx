"use client"

import { useCallback, useEffect, useState } from "react"
import { toast } from "sonner"
import { Archive, ArrowUpRight, Loader2, Link2Off, ShieldAlert, TriangleAlert } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { DatabaseService } from "@/lib/services/database"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type { Contacto } from "@/lib/types/database"

type Usos = Awaited<ReturnType<typeof DatabaseService.getUsosContacto>>

interface DeleteContactoDialogProps {
  contacto: Contacto | null
  delegacionId?: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (id: string) => Promise<void>
  onArchive?: (id: string) => Promise<void>
  /** Se avisa tras desvincular para que la pantalla vuelva a leer los datos. */
  onUnlinked?: () => void
}

/**
 * Borrar un contacto, sabiendo antes qué se lleva por delante.
 *
 * Antes este diálogo solo preguntaba "¿seguro?". El problema es que las
 * consecuencias son distintas en cada caso y ninguna se veía: con movimientos,
 * el borrado sale bien y les quita el proveedor en silencio; con un pago MCM,
 * falla con un error de base de datos que no explica qué lo impide.
 *
 * Así que primero se mira quién lo usa, se enseña, y se ofrece lo que casi
 * siempre se quería de verdad: desvincularlo sin borrar ningún movimiento.
 */
export function DeleteContactoDialog({
  contacto,
  delegacionId,
  open,
  onOpenChange,
  onDelete,
  onArchive,
  onUnlinked,
}: DeleteContactoDialogProps) {
  const [busy, setBusy] = useState(false)
  const [usos, setUsos] = useState<Usos | null>(null)
  const [cargando, setCargando] = useState(false)

  const contactoId = contacto?.id ?? null

  const cargarUsos = useCallback(
    async (señal: { cancelado: boolean }) => {
      if (!contactoId) return
      setCargando(true)
      try {
        const datos = await DatabaseService.getUsosContacto(contactoId, delegacionId)
        if (!señal.cancelado) setUsos(datos)
      } catch (error) {
        console.error("Error consultando los usos del contacto:", error)
        if (!señal.cancelado) setUsos(null)
      } finally {
        if (!señal.cancelado) setCargando(false)
      }
    },
    [contactoId, delegacionId],
  )

  useEffect(() => {
    if (!open || !contactoId) return
    const señal = { cancelado: false }
    setUsos(null)
    void cargarUsos(señal)
    return () => {
      señal.cancelado = true
    }
  }, [open, contactoId, cargarUsos])

  if (!contacto) return null

  const totalVinculos = (usos?.totalMovimientos ?? 0) + (usos?.totalFacturas ?? 0)
  const bloqueadoPorPagos = (usos?.pagosMcm ?? 0) > 0
  const compartido = (usos?.otrasDelegaciones ?? 0) > 0

  const handleDelete = async () => {
    setBusy(true)
    try {
      await onDelete(contacto.id)
      toast.success("Contacto eliminado")
      onOpenChange(false)
    } catch (err) {
      toast.error("No se pudo eliminar: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setBusy(false)
    }
  }

  const handleDesvincular = async () => {
    setBusy(true)
    try {
      const { movimientos, facturas } = await DatabaseService.desvincularContacto(contacto.id, delegacionId)
      const partes = [
        movimientos > 0 ? `${movimientos} ${movimientos === 1 ? "movimiento" : "movimientos"}` : null,
        facturas > 0 ? `${facturas} ${facturas === 1 ? "factura" : "facturas"}` : null,
      ].filter(Boolean)
      toast.success(`${contacto.nombre} desvinculado de ${partes.join(" y ")}. No se ha borrado nada.`)
      onUnlinked?.()
      onOpenChange(false)
    } catch (err) {
      toast.error("No se pudo desvincular: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setBusy(false)
    }
  }

  const handleArchive = async () => {
    if (!onArchive) return
    setBusy(true)
    try {
      await onArchive(contacto.id)
      toast.success("Contacto archivado")
      onOpenChange(false)
    } catch (err) {
      toast.error("No se pudo archivar: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[90vh] overflow-hidden sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TriangleAlert className="h-5 w-5 text-red-600" />
            Eliminar <span className="truncate">{contacto.nombre}</span>
          </DialogTitle>
          <DialogDescription>
            {cargando
              ? "Comprobando qué está usando este contacto…"
              : totalVinculos === 0 && !bloqueadoPorPagos
                ? "No lo usa ningún movimiento ni factura. Se puede borrar sin consecuencias."
                : "Mira lo que lo está usando antes de decidir."}
          </DialogDescription>
        </DialogHeader>

        {cargando && (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando…
          </div>
        )}

        {!cargando && usos && (
          <div className="space-y-3 overflow-y-auto">
            {bloqueadoPorPagos && (
              <Alert className="border-red-300/60 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/30">
                <AlertDescription className="flex gap-2 text-xs">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-400" />
                  <span>
                    <strong>No se puede borrar.</strong> Tiene {usos.pagosMcm}{" "}
                    {usos.pagosMcm === 1 ? "pago MCM asociado" : "pagos MCM asociados"}, y un pago no puede quedarse sin
                    la persona a la que se le paga. Quita el contacto de esos pagos, o archívalo.
                  </span>
                </AlertDescription>
              </Alert>
            )}

            {compartido && (
              <Alert className="border-amber-300/60 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/30">
                <AlertDescription className="text-xs">
                  Lo usan <strong>{usos.otrasDelegaciones}</strong>{" "}
                  {usos.otrasDelegaciones === 1 ? "delegación más" : "delegaciones más"}. Archívalo en la tuya en lugar
                  de borrarlo: dejarás de verlo sin quitárselo a nadie.
                </AlertDescription>
              </Alert>
            )}

            {totalVinculos > 0 && (
              <div className="rounded-lg border border-border/60">
                <div className="flex items-center justify-between gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
                  <span className="text-xs font-semibold">
                    {usos.totalMovimientos > 0 && (
                      <>
                        {usos.totalMovimientos} {usos.totalMovimientos === 1 ? "movimiento" : "movimientos"}
                      </>
                    )}
                    {usos.totalMovimientos > 0 && usos.totalFacturas > 0 && " · "}
                    {usos.totalFacturas > 0 && (
                      <>
                        {usos.totalFacturas} {usos.totalFacturas === 1 ? "factura" : "facturas"}
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

                    {usos.facturas.map((factura) => (
                      <div key={factura.id} className="flex items-center gap-2 px-3 py-1.5">
                        <span className="w-[68px] shrink-0 text-[11px] tabular-nums text-muted-foreground">
                          {factura.fecha_emision ? formatDate(factura.fecha_emision) : "—"}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs">
                          Factura {factura.numero ?? "sin número"}
                        </span>
                        <span className="shrink-0 text-xs font-semibold tabular-nums">
                          {formatCurrency(factura.importe ?? 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                </ScrollArea>

                {usos.totalMovimientos > usos.movimientos.length && (
                  <p className="border-t border-border/40 px-3 py-1.5 text-[11px] text-muted-foreground">
                    y {usos.totalMovimientos - usos.movimientos.length} movimientos más
                  </p>
                )}
              </div>
            )}

            {onArchive && !contacto.archivado && (
              <Alert className="border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/30">
                <AlertDescription className="text-xs">
                  💡 Si solo quieres dejar de verlo, <strong>archívalo</strong>. Desaparece de las listas y el histórico
                  se queda intacto.
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>

          {totalVinculos > 0 && (
            <Button variant="outline" onClick={handleDesvincular} disabled={busy}>
              <Link2Off className="mr-2 h-4 w-4" />
              Solo desvincular
            </Button>
          )}

          {onArchive && !contacto.archivado && (
            <Button variant="outline" onClick={handleArchive} disabled={busy}>
              <Archive className="mr-2 h-4 w-4" /> Archivar
            </Button>
          )}

          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={busy || cargando || bloqueadoPorPagos}
            title={bloqueadoPorPagos ? "Tiene pagos MCM asociados" : undefined}
          >
            {busy ? "Procesando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
