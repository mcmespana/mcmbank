"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { BadgeCheck, Link2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { formatCurrency } from "@/lib/utils/format"
import { importePagadoFactura, importePendienteFactura } from "@/lib/utils/facturas"
import { FacturaConciliacionPanel } from "./factura-conciliacion-panel"
import type { FacturaConRelaciones } from "@/lib/types/database"

interface VincularMovimientoDialogProps {
  factura: FacturaConRelaciones | null
  open: boolean
  onOpenChange: (open: boolean) => void
  delegacionId: string
  onLink: (facturaId: string, movimientoId: string, creadoPor?: string) => Promise<void>
  onMarcarPagadaFuera?: (facturaId: string) => Promise<void>
}

/**
 * Envoltorio fino sobre FacturaConciliacionPanel: se conserva porque
 * vincular-factura-dialog.tsx y transaction-files.tsx entran a conciliar
 * desde el lado del movimiento, así que esta pieza sigue siendo el punto de
 * entrada desde el lado factura fuera de factura-detail-sheet.tsx.
 */
export function VincularMovimientoDialog({
  factura,
  open,
  onOpenChange,
  delegacionId,
  onLink,
  onMarcarPagadaFuera,
}: VincularMovimientoDialogProps) {
  const { user } = useAuth()
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const importePendiente = useMemo(() => (factura ? importePendienteFactura(factura) : null), [factura])
  const yaPagado = useMemo(() => (factura ? importePagadoFactura(factura) : 0), [factura])

  useEffect(() => {
    if (open) return
    setSeleccion(null)
  }, [open])

  const handleLink = async () => {
    if (!factura || !seleccion) return
    setBusy(true)
    try {
      await onLink(factura.id, seleccion, user?.id)
      toast.success("Factura vinculada al movimiento")
      onOpenChange(false)
    } catch (err) {
      toast.error("No se pudo vincular: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setBusy(false)
    }
  }

  const handlePagadaFuera = async () => {
    if (!factura || !onMarcarPagadaFuera) return
    setBusy(true)
    try {
      await onMarcarPagadaFuera(factura.id)
      toast.success("Factura marcada como pagada fuera de MCM Bank")
      onOpenChange(false)
    } catch (err) {
      toast.error("No se pudo actualizar: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setBusy(false)
    }
  }

  if (!factura) return null

  const titulo = factura.concepto?.trim() || factura.archivos?.[0]?.nombre_original || "Factura"

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            {yaPagado > 0 ? "Vincular otro pago a la factura" : "Vincular factura a un movimiento"}
          </DialogTitle>
          <DialogDescription>
            {titulo}
            {factura.importe != null && (
              <>
                {" "}· <span className="font-semibold">{formatCurrency(Number(factura.importe))}</span>
              </>
            )}
            {factura.contacto?.nombre && <> · {factura.contacto.nombre}</>}
          </DialogDescription>
        </DialogHeader>

        <FacturaConciliacionPanel
          delegacionId={delegacionId}
          importePendiente={importePendiente}
          importeYaPagado={yaPagado}
          fechaEmision={factura.fecha_emision}
          contactoId={factura.contacto_id}
          seleccion={seleccion}
          onSeleccionChange={setSeleccion}
        />

        <DialogFooter className="gap-2 sm:justify-between">
          {onMarcarPagadaFuera && factura.estado !== "pagada_fuera" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={handlePagadaFuera}
              className="justify-start text-muted-foreground"
              title="La factura está pagada, pero el movimiento no está en MCM Bank"
            >
              <BadgeCheck className="mr-1.5 h-3.5 w-3.5" /> Pagada fuera de MCM Bank
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleLink} disabled={busy || !seleccion}>
              {busy ? "Vinculando…" : "Vincular"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
