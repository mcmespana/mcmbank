"use client"

import { useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Archive } from "lucide-react"
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
import type { Contacto } from "@/lib/types/database"

interface DeleteContactoDialogProps {
  contacto: Contacto | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onDelete: (id: string) => Promise<void>
  onArchive?: (id: string) => Promise<void>
}

export function DeleteContactoDialog({ contacto, open, onOpenChange, onDelete, onArchive }: DeleteContactoDialogProps) {
  const [busy, setBusy] = useState(false)

  if (!contacto) return null

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
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Eliminar contacto
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. Los movimientos vinculados se mantienen pero pierden el contacto.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <AlertDescription>
            <span className="font-semibold tracking-tight">{contacto.nombre}</span>
          </AlertDescription>
        </Alert>

        {onArchive && !contacto.archivado && (
          <Alert className="border-amber-300/50 bg-amber-50/60 dark:bg-amber-950/30">
            <AlertDescription className="text-xs">
              💡 Si quieres conservar el histórico, puedes <strong>archivarlo</strong> en lugar de borrarlo. Dejará de aparecer en listas pero seguirá disponible en los movimientos antiguos.
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          {onArchive && !contacto.archivado && (
            <Button variant="outline" onClick={handleArchive} disabled={busy}>
              <Archive className="mr-2 h-4 w-4" /> Archivar
            </Button>
          )}
          <Button variant="destructive" onClick={handleDelete} disabled={busy}>
            {busy ? "Procesando…" : "Eliminar definitivamente"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
