"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AlertTriangle } from "lucide-react"
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
import { formatCurrency } from "@/lib/utils/format"
import type { FacturaConRelaciones } from "@/lib/types/database"

interface DeleteFacturaDialogProps {
  factura: FacturaConRelaciones | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (id: string) => Promise<void>
}

export function DeleteFacturaDialog({ factura, open, onOpenChange, onDelete }: DeleteFacturaDialogProps) {
  const [busy, setBusy] = useState(false)

  if (!factura) return null

  const titulo = factura.concepto?.trim() || factura.archivos?.[0]?.nombre_original || "Factura sin título"

  const handleDelete = async () => {
    setBusy(true)
    try {
      await onDelete(factura.id)
    } catch (err) {
      toast.error("No se pudo eliminar: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Eliminar factura
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. La factura y sus archivos adjuntos se eliminarán.
            {factura.movimientos && factura.movimientos.length > 0 && (
              <span className="mt-2 block text-amber-700 dark:text-amber-300">
                Está vinculada a {factura.movimientos.length === 1 ? "un movimiento bancario" : `${factura.movimientos.length} movimientos bancarios`}.
                {factura.movimientos.length === 1 ? " El movimiento NO se eliminará" : " Los movimientos NO se eliminarán"}, solo perderán el vínculo.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-semibold">{titulo}</div>
              <div className="text-sm text-muted-foreground">
                {factura.contacto?.nombre ?? "Sin proveedor"}
                {factura.importe != null && <> · {formatCurrency(Number(factura.importe))}</>}
              </div>
            </div>
          </AlertDescription>
        </Alert>

        <DialogFooter>
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button variant="destructive" disabled={busy} onClick={handleDelete}>
            {busy ? "Eliminando…" : "Eliminar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
