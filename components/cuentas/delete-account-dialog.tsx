"use client"

import { useState } from "react"
import { AlertTriangle, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Cuenta } from "@/lib/types/database"

interface DeleteAccountDialogProps {
  cuenta: Cuenta
  onConfirm: () => void
  onCancel: () => void
}

export function DeleteAccountDialog({ cuenta, onConfirm, onCancel }: DeleteAccountDialogProps) {
  const [confirmationText, setConfirmationText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    if (confirmationText !== "ELIMINAR") {
      return
    }

    setIsDeleting(true)
    try {
      await onConfirm()
    } finally {
      setIsDeleting(false)
    }
  }

  const isConfirmationValid = confirmationText === "ELIMINAR"

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Eliminar Cuenta
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. Se eliminará permanentemente la cuenta y todas sus transacciones asociadas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Warning Alert */}
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertDescription className="text-red-800">
              <strong>Cuenta a eliminar:</strong> {cuenta.nombre}
              {cuenta.tipo === "banco" && cuenta.banco_nombre && (
                <span className="block text-sm text-red-700 mt-1">
                  Banco: {cuenta.banco_nombre}
                </span>
              )}
            </AlertDescription>
          </Alert>

          {/* Confirmation Text Input */}
          <div className="space-y-2">
            <Label htmlFor="confirmation">
              Para confirmar, escribe <strong>ELIMINAR</strong> en mayúsculas:
            </Label>
            <Input
              id="confirmation"
              value={confirmationText}
              onChange={(e) => setConfirmationText(e.target.value)}
              placeholder="ELIMINAR"
              className={isConfirmationValid ? "border-green-500 focus:border-green-500" : ""}
            />
            {isConfirmationValid && (
              <p className="text-sm text-green-600">✓ Confirmación válida</p>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              variant="destructive"
              onClick={handleConfirm}
              disabled={!isConfirmationValid || isDeleting}
              className="flex-1"
            >
              {isDeleting ? "Eliminando..." : "Eliminar Cuenta"}
            </Button>
            <Button
              variant="outline"
              onClick={onCancel}
              disabled={isDeleting}
              className="flex-1 bg-transparent"
            >
              Cancelar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
