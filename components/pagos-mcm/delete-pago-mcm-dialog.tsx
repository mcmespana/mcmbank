"use client"

import { useState } from "react"
import { toast } from "sonner"
import { describirError } from "@/lib/utils/describir-error"
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
import type { PagoMcmConRelaciones } from "@/lib/types/database"

interface DeletePagoMcmDialogProps {
  pago: PagoMcmConRelaciones | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (id: string) => Promise<void>
}

export function DeletePagoMcmDialog({ pago, open, onOpenChange, onDelete }: DeletePagoMcmDialogProps) {
  const [busy, setBusy] = useState(false)

  if (!pago) return null

  const handleDelete = async () => {
    setBusy(true)
    try {
      await onDelete(pago.id)
    } catch (err) {
      toast.error(describirError(err, "No se ha podido eliminar el pago"))
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
            Eliminar pago MCM
          </DialogTitle>
          <DialogDescription>
            El pago se eliminará. Tendrás unos segundos para deshacerlo desde el aviso.
            {pago.movimiento && (
              <span className="mt-2 block text-amber-700 dark:text-amber-300">
                Este pago está vinculado a un movimiento bancario. El movimiento NO se eliminará, solo perderá el
                vínculo (que se recupera si deshaces).
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertDescription>
            <div className="space-y-1">
              <div className="font-semibold">{pago.concepto}</div>
              <div className="text-sm text-muted-foreground">
                {pago.contacto?.nombre ?? "Sin contacto"} · {formatCurrency(Number(pago.importe))}
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
