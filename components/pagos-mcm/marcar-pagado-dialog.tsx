"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AlertTriangle, Banknote, Loader2 } from "lucide-react"
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
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DateField } from "@/components/ui/date-field"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { useCuentas } from "@/hooks/use-cuentas"
import { DatabaseService } from "@/lib/services/database"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import type {
  MovimientoConRelaciones,
  PagoMcmConRelaciones,
} from "@/lib/types/database"

interface MarcarPagadoDialogProps {
  pago: PagoMcmConRelaciones | null
  open: boolean
  onOpenChange: (open: boolean) => void
  delegacionId: string
  onConvert: (
    pagoId: string,
    options: { cuentaId: string; fecha: string; delegacionId: string; creadoPor: string },
  ) => Promise<{ movimientoId: string }>
  onLink: (pagoId: string, movimientoId: string, creadoPor?: string) => Promise<void>
}

const todayISO = () => new Date().toISOString().slice(0, 10)

type Mode = "crear" | "vincular"

export function MarcarPagadoDialog({
  pago,
  open,
  onOpenChange,
  delegacionId,
  onConvert,
  onLink,
}: MarcarPagadoDialogProps) {
  const { user } = useAuth()
  const { cuentas, loading: cuentasLoading } = useCuentas(delegacionId)
  const [mode, setMode] = useState<Mode>("crear")
  const [modeAutoSet, setModeAutoSet] = useState(false)
  const [cuentaId, setCuentaId] = useState<string>("")
  const [fecha, setFecha] = useState<string>(todayISO())
  const [candidatos, setCandidatos] = useState<MovimientoConRelaciones[]>([])
  const [candidatosLoading, setCandidatosLoading] = useState(false)
  const [seleccionMov, setSeleccionMov] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Auto-select cuenta por defecto: la que tiene más movimientos
  useEffect(() => {
    if (!open || !delegacionId || cuentasLoading) return
    if (cuentaId) return
    DatabaseService.getCuentaConMasMovimientos(delegacionId)
      .then((id) => {
        if (id) setCuentaId(id)
        else if (cuentas[0]?.id) setCuentaId(cuentas[0].id)
      })
      .catch(() => {
        if (cuentas[0]?.id) setCuentaId(cuentas[0].id)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, delegacionId, cuentasLoading, cuentas.length])

  // Cargar candidatos al abrir
  useEffect(() => {
    if (!open || !pago) return
    setCandidatosLoading(true)
    DatabaseService.findCandidatosMovimientoParaPago(delegacionId, Number(pago.importe), {
      contactoId: pago.contacto_id,
      limit: 30,
    })
      .then((list) => setCandidatos(list))
      .catch(() => setCandidatos([]))
      .finally(() => setCandidatosLoading(false))
  }, [open, pago, delegacionId])

  // Preseleccionar "Vincular existente" si hay un candidato con importe exacto.
  useEffect(() => {
    if (!open || modeAutoSet || candidatosLoading || !pago) return
    const hayExacto = candidatos.some((m) => Math.abs(Math.abs(Number(m.importe)) - Number(pago.importe)) < 0.005)
    setMode(hayExacto ? "vincular" : "crear")
    setModeAutoSet(true)
  }, [open, modeAutoSet, candidatosLoading, candidatos, pago])

  // Reset al cerrar
  useEffect(() => {
    if (open) return
    setMode("crear")
    setModeAutoSet(false)
    setCuentaId("")
    setFecha(todayISO())
    setCandidatos([])
    setSeleccionMov(null)
  }, [open])

  const handleConvert = async () => {
    if (!pago || !user) return
    if (!cuentaId) {
      toast.error("Elige una cuenta")
      return
    }
    setBusy(true)
    try {
      await onConvert(pago.id, {
        cuentaId,
        fecha,
        delegacionId,
        creadoPor: user.id,
      })
      toast.success("Movimiento creado y pago marcado como pagado")
      onOpenChange(false)
    } catch (err) {
      toast.error("No se pudo convertir: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setBusy(false)
    }
  }

  const handleLink = async () => {
    if (!pago || !seleccionMov) return
    setBusy(true)
    try {
      await onLink(pago.id, seleccionMov, user?.id)
      toast.success("Pago vinculado al movimiento")
      onOpenChange(false)
    } catch (err) {
      toast.error("No se pudo vincular: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setBusy(false)
    }
  }

  if (!pago) return null

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Banknote className="h-5 w-5 text-primary" />
            Marcar pago como pagado
          </DialogTitle>
          <DialogDescription>
            {pago.concepto} · <span className="font-semibold">{formatCurrency(Number(pago.importe))}</span> · {pago.contacto?.nombre}
          </DialogDescription>
        </DialogHeader>

        <div className="inline-flex w-full rounded-xl border border-border/60 bg-muted/40 p-1">
          {(["crear", "vincular"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 rounded-lg px-3 py-1.5 text-xs font-medium tracking-tight transition-colors",
                mode === m ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {m === "crear" ? "Crear movimiento" : `Vincular existente${candidatos.length > 0 ? ` (${candidatos.length})` : ""}`}
            </button>
          ))}
        </div>

        {mode === "crear" ? (
          <div className="space-y-4 pt-1">
            <Alert className="border-amber-300/60 bg-amber-50/60 dark:bg-amber-950/30">
              <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-300" />
              <AlertDescription className="text-xs text-amber-900 dark:text-amber-200">
                Esto crea un movimiento manual en MCM Bank; no realiza la transferencia en el banco.
              </AlertDescription>
            </Alert>

            <div className="space-y-1.5">
              <Label>Cuenta de origen</Label>
              <Select value={cuentaId} onValueChange={setCuentaId} disabled={cuentasLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={cuentasLoading ? "Cargando…" : "Elige una cuenta"} />
                </SelectTrigger>
                <SelectContent>
                  {cuentas.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                      {c.banco_nombre && <span className="text-muted-foreground"> · {c.banco_nombre}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">Por defecto, la cuenta con más movimientos.</p>
            </div>

            <div className="space-y-1.5">
              <Label>Fecha del movimiento</Label>
              <DateField value={fecha} onChange={setFecha} />
            </div>
          </div>
        ) : (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Movimientos con un importe parecido a {formatCurrency(Number(pago.importe))} sin pago vinculado.
              {pago.contacto_id && " Los del mismo contacto aparecen primero."}
            </p>

            {candidatosLoading ? (
              <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Buscando candidatos…
              </div>
            ) : candidatos.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
                No hay movimientos sin vincular con un importe parecido.
              </div>
            ) : (
              <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {candidatos.map((m) => {
                  const sameContacto = pago.contacto_id && m.contacto_id === pago.contacto_id
                  const selected = seleccionMov === m.id
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setSeleccionMov(m.id)}
                      className={cn(
                        "w-full rounded-lg border p-2.5 text-left text-sm transition-colors",
                        selected
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-background hover:border-primary/40 hover:bg-muted/40",
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium truncate">{m.concepto}</span>
                        <span className="font-mono text-xs text-rose-700 dark:text-rose-400">
                          {formatCurrency(Number(m.importe))}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span>{formatDate(m.fecha)}</span>
                        {m.cuenta?.nombre && <span>· {m.cuenta.nombre}</span>}
                        {sameContacto && (
                          <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                            mismo contacto
                          </span>
                        )}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          {mode === "crear" ? (
            <Button onClick={handleConvert} disabled={busy || !cuentaId}>
              {busy ? "Creando…" : "Crear movimiento y marcar pagado"}
            </Button>
          ) : (
            <Button onClick={handleLink} disabled={busy || !seleccionMov}>
              {busy ? "Vinculando…" : "Vincular y marcar pagado"}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
