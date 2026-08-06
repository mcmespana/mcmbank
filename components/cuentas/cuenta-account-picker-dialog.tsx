"use client"

import { useEffect, useState } from "react"
import { Landmark, Loader2 } from "lucide-react"
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
import { cn } from "@/lib/utils"
import type { EBAccountResource } from "@/lib/enable-banking/types"

interface CuentaAccountPickerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bancoConexionId: string
  cuentaId: string
  cuentaNombre: string
  onLinked: () => void
}

export function CuentaAccountPickerDialog({
  open,
  onOpenChange,
  bancoConexionId,
  cuentaId,
  cuentaNombre,
  onLinked,
}: CuentaAccountPickerDialogProps) {
  const [loading, setLoading] = useState(true)
  const [accounts, setAccounts] = useState<EBAccountResource[]>([])
  const [selectedUid, setSelectedUid] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setSelectedUid(null)

    fetch(`/api/bank-sync/link-account?banco_conexion_id=${bancoConexionId}`)
      .then(async (res) => {
        const body = await res.json()
        if (!res.ok) throw new Error(body?.error || "No se pudieron cargar las cuentas")
        return body.accounts as EBAccountResource[]
      })
      .then((accs) => {
        if (cancelled) return
        setAccounts(accs)
        if (accs.length === 1) setSelectedUid(accs[0].uid)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : "No se pudieron cargar las cuentas")
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, bancoConexionId])

  const handleConfirm = async () => {
    if (!selectedUid) return
    setLinking(true)
    setError(null)
    try {
      const res = await fetch("/api/bank-sync/link-account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          banco_conexion_id: bancoConexionId,
          cuenta_id: cuentaId,
          account_uid: selectedUid,
        }),
      })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || "No se pudo enlazar la cuenta")
      onLinked()
      onOpenChange(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo enlazar la cuenta")
    } finally {
      setLinking(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !linking && onOpenChange(o)}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Landmark className="h-5 w-5" />
            Elige la cuenta del banco
          </DialogTitle>
          <DialogDescription>
            El banco devolvió varias cuentas y ninguna coincidió automáticamente con el IBAN de{" "}
            <strong>{cuentaNombre}</strong>. Elige a cuál corresponde.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando cuentas…
          </p>
        )}

        {error && (
          <Alert className="border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30">
            <AlertDescription className="text-red-800 dark:text-red-300">{error}</AlertDescription>
          </Alert>
        )}

        {!loading && accounts.length > 0 && (
          <div className="space-y-2">
            {accounts.map((account) => {
              const iban = account.account_id?.iban
              const selected = selectedUid === account.uid
              return (
                <button
                  key={account.uid}
                  type="button"
                  onClick={() => setSelectedUid(account.uid)}
                  className={cn(
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    selected ? "border-primary bg-primary/5" : "border-border hover:bg-muted/50",
                  )}
                >
                  <div className="text-sm font-medium">{account.name || account.product || "Cuenta"}</div>
                  <div className="text-xs text-muted-foreground">
                    {iban || "Sin IBAN"} {account.currency ? `· ${account.currency}` : ""}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        {!loading && accounts.length === 0 && !error && (
          <p className="text-sm text-muted-foreground">No hay cuentas pendientes de elegir para esta conexión.</p>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={linking}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedUid || linking}>
            {linking ? "Enlazando…" : "Enlazar cuenta"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
