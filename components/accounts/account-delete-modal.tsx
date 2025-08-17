"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle } from "lucide-react"
import { DatabaseService } from "@/lib/services/database"
import type { CuentaConDelegacion } from "@/lib/types/database"

interface AccountDeleteModalProps {
  account: CuentaConDelegacion
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function AccountDeleteModal({ account, open, onOpenChange, onSuccess }: AccountDeleteModalProps) {
  const [confirmationText, setConfirmationText] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isConfirmationValid = confirmationText === "ELIMINAR"

  const handleDelete = async () => {
    if (!isConfirmationValid) return

    setLoading(true)
    setError(null)

    try {
      await DatabaseService.deleteAccount(account.id)
      onSuccess()
      handleClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar la cuenta")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    setConfirmationText("")
    setError(null)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertTriangle className="h-5 w-5" />
            Eliminar Cuenta
          </DialogTitle>
          <DialogDescription className="text-left space-y-3">
            <p>
              <strong>¿Estás seguro de que quieres eliminar la cuenta "{account.nombre}"?</strong>
            </p>
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <p className="text-red-800 text-sm font-medium mb-2">
                ⚠️ Esta acción no se puede deshacer
              </p>
              <ul className="text-red-700 text-sm space-y-1">
                <li>• Se eliminará la cuenta permanentemente</li>
                <li>• Se eliminarán todas las transacciones asociadas a esta cuenta</li>
                <li>• Los datos no se podrán recuperar</li>
              </ul>
            </div>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="confirmation" className="text-sm font-medium">
              Para confirmar, escribe <span className="font-mono bg-muted px-1 rounded">ELIMINAR</span> en mayúsculas:
            </Label>
            <Input
              id="confirmation"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="Escribe ELIMINAR"
              className={confirmationText && !isConfirmationValid ? "border-red-300 focus:border-red-300" : ""}
            />
            {confirmationText && !isConfirmationValid && (
              <p className="text-xs text-red-600">
                Debes escribir exactamente "ELIMINAR" en mayúsculas
              </p>
            )}
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={!isConfirmationValid || loading}
              className="flex-1"
            >
              {loading ? "Eliminando..." : "Eliminar Cuenta"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}