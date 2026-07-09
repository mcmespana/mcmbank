"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Loader2, ReceiptText } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { DatabaseService } from "@/lib/services/database"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { FACTURA_ESTADO_INFO } from "@/lib/utils/facturas"
import type { FacturaConRelaciones } from "@/lib/types/database"

interface VincularFacturaDialogProps {
  movimientoId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onLinked?: () => void | Promise<void>
}

/**
 * Desde el lado movimiento: elegir una factura existente (sin movimiento
 * vinculado) para conciliarla con este movimiento.
 */
export function VincularFacturaDialog({
  movimientoId,
  open,
  onOpenChange,
  onLinked,
}: VincularFacturaDialogProps) {
  const { user } = useAuth()
  const [candidatas, setCandidatas] = useState<FacturaConRelaciones[]>([])
  const [loading, setLoading] = useState(false)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!open || !movimientoId) return
    setLoading(true)
    DatabaseService.findCandidatosFacturaParaMovimiento(movimientoId, { limit: 40 })
      .then((list) => setCandidatas(list))
      .catch(() => setCandidatas([]))
      .finally(() => setLoading(false))
  }, [open, movimientoId])

  useEffect(() => {
    if (open) return
    setCandidatas([])
    setSeleccion(null)
  }, [open])

  const handleLink = async () => {
    if (!movimientoId || !seleccion) return
    setBusy(true)
    try {
      await DatabaseService.linkFacturaToMovimiento(seleccion, movimientoId, user?.id)
      toast.success("Factura vinculada al movimiento")
      onOpenChange(false)
      await onLinked?.()
    } catch (err) {
      toast.error("No se pudo vincular: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ReceiptText className="h-5 w-5 text-primary" />
            Vincular una factura existente
          </DialogTitle>
          <DialogDescription>
            Facturas de la bandeja sin movimiento vinculado, con importe compatible, ordenadas por
            afinidad.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando facturas…
          </div>
        ) : candidatas.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
            No hay facturas compatibles en la bandeja. Sube la factura desde la pestaña de archivos y
            quedará vinculada automáticamente.
          </div>
        ) : (
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {candidatas.map((f) => {
              const selected = seleccion === f.id
              const estadoInfo = FACTURA_ESTADO_INFO[f.estado]
              const titulo = f.concepto?.trim() || f.archivos?.[0]?.nombre_original || "Factura sin título"
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSeleccion(f.id)}
                  className={cn(
                    "w-full rounded-lg border p-2.5 text-left text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-background hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{titulo}</span>
                    <span className="shrink-0 font-mono text-xs">
                      {f.importe != null ? formatCurrency(Number(f.importe)) : "—"}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span className={cn("h-1.5 w-1.5 rounded-full", estadoInfo.dotClass)} aria-hidden />
                    <span>{estadoInfo.label}</span>
                    {f.fecha_emision && <span>· {formatDate(f.fecha_emision)}</span>}
                    {f.contacto?.nombre && <span>· {f.contacto.nombre}</span>}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleLink} disabled={busy || !seleccion}>
            {busy ? "Vinculando…" : "Vincular factura"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
