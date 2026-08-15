"use client"

import { useEffect, useState } from "react"
import { AlertTriangle, Trash2, ArrowRightLeft, Loader2 } from "lucide-react"
import { DatabaseService } from "@/lib/services/database"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Cuenta } from "@/lib/types/database"

interface DeleteAccountDialogProps {
  cuenta: Cuenta
  /** Otras cuentas de la misma delegación a las que se podrían migrar los movimientos. */
  otherCuentas: Cuenta[]
  /** Si migrateToCuentaId viene, primero se reasignan los movimientos y luego se borra la cuenta. */
  onConfirm: (opts: { migrateToCuentaId?: string }) => void | Promise<void>
  onCancel: () => void
}

type Mode = "delete" | "migrate"

export function DeleteAccountDialog({ cuenta, otherCuentas, onConfirm, onCancel }: DeleteAccountDialogProps) {
  const [confirmationText, setConfirmationText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)
  const [mode, setMode] = useState<Mode>("delete")
  const [targetCuentaId, setTargetCuentaId] = useState<string>("")
  // `movimiento.cuenta_id` es ON DELETE CASCADE: aquí no falla nada, se borra
  // de verdad. Una cuenta puede llevar años de histórico, así que el número
  // tiene que estar delante de quien escribe "ELIMINAR", no detrás.
  const [totalMovimientos, setTotalMovimientos] = useState<number | null>(null)

  useEffect(() => {
    let cancelado = false
    DatabaseService.getConteoMovimientosCuenta(cuenta.id)
      .then((total) => {
        if (!cancelado) setTotalMovimientos(total)
      })
      .catch((error) => {
        console.error("Error contando los movimientos de la cuenta:", error)
        if (!cancelado) setTotalMovimientos(null)
      })
    return () => {
      cancelado = true
    }
  }, [cuenta.id])

  const canMigrate = otherCuentas.length > 0
  const isConfirmationValid = confirmationText === "ELIMINAR"
  const isMigrateReady = mode !== "migrate" || !!targetCuentaId
  const canConfirm = isConfirmationValid && isMigrateReady && !isDeleting

  const handleConfirm = async () => {
    if (!canConfirm) return
    setIsDeleting(true)
    try {
      await onConfirm(mode === "migrate" ? { migrateToCuentaId: targetCuentaId } : {})
    } finally {
      setIsDeleting(false)
    }
  }

  const targetNombre = otherCuentas.find((c) => c.id === targetCuentaId)?.nombre

  return (
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="h-5 w-5" />
            Eliminar Cuenta
          </DialogTitle>
          <DialogDescription>
            Esta acción no se puede deshacer. Elige qué hacer con los movimientos de la cuenta antes de eliminarla.
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

          {/* Cuántos movimientos hay detrás. Sin este número, "eliminarlos
              junto con la cuenta" es una abstracción: son años de histórico. */}
          {totalMovimientos === null ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Comprobando cuántos movimientos tiene…
            </p>
          ) : totalMovimientos === 0 ? (
            <p className="text-sm text-muted-foreground">
              No tiene ningún movimiento. Se puede borrar sin consecuencias.
            </p>
          ) : (
            <Alert className="border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800 text-sm dark:text-amber-200">
                Tiene <strong>{totalMovimientos.toLocaleString("es-ES")}</strong>{" "}
                {totalMovimientos === 1 ? "movimiento" : "movimientos"}
                {mode === "migrate" ? " que se migrarán a la cuenta destino." : ", y se borrarán con ella."}
                {mode !== "migrate" && !canMigrate && (
                  <span className="mt-1 block text-xs">
                    No hay otra cuenta en esta delegación a la que moverlos.
                  </span>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Qué hacer con los movimientos */}
          {canMigrate && (
            <div className="space-y-2">
              <Label>¿Qué hacemos con los movimientos?</Label>
              <Select value={mode} onValueChange={(v) => setMode(v as Mode)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="delete">Eliminarlos junto con la cuenta</SelectItem>
                  <SelectItem value="migrate">Migrarlos a otra cuenta y luego eliminar esta</SelectItem>
                </SelectContent>
              </Select>

              {mode === "migrate" && (
                <div className="space-y-2 pt-1">
                  <Label className="flex items-center gap-1.5 text-sm">
                    <ArrowRightLeft className="h-3.5 w-3.5" />
                    Cuenta destino
                  </Label>
                  <Select value={targetCuentaId} onValueChange={setTargetCuentaId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona una cuenta…" />
                    </SelectTrigger>
                    <SelectContent>
                      {otherCuentas.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre}
                          {c.tipo === "banco" && c.banco_nombre ? ` · ${c.banco_nombre}` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Alert className="border-amber-200 bg-amber-50">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertDescription className="text-amber-800 text-xs">
                      Los movimientos pasarán a <strong>{targetNombre || "la cuenta destino"}</strong>. Revisa
                      después el <strong>saldo inicial</strong> de esa cuenta: si ya estaba sincronizada con el
                      banco, puede quedar descuadrado y tendrás que ajustarlo a mano.
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </div>
          )}

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
              disabled={!canConfirm}
              className="flex-1"
            >
              {isDeleting
                ? mode === "migrate"
                  ? "Migrando…"
                  : "Eliminando..."
                : mode === "migrate"
                  ? "Migrar y eliminar"
                  : "Eliminar Cuenta"}
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
