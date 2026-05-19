"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  Copy,
  Loader2,
  SkipForward,
  Wallet,
} from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { useClipboard } from "@/hooks/use-clipboard"
import { useCuentas } from "@/hooks/use-cuentas"
import { DatabaseService } from "@/lib/services/database"
import { formatCurrency } from "@/lib/utils/format"
import { formatearIban, normalizarIban } from "@/lib/utils/iban"
import { formatImporteBanco, getConceptoTransferenciaSugerido } from "@/lib/utils/transferencia"
import type { PagoMcmConRelaciones } from "@/lib/types/database"

interface TransferRunDialogProps {
  pagos: PagoMcmConRelaciones[]
  open: boolean
  onOpenChange: (open: boolean) => void
  delegacionId: string
  onConvert: (
    pagoId: string,
    options: { cuentaId: string; fecha: string; delegacionId: string; creadoPor: string },
  ) => Promise<{ movimientoId: string }>
}

const todayISO = () => new Date().toISOString().slice(0, 10)

type CopyField = "iban" | "importe" | "concepto" | null

export function TransferRunDialog({
  pagos,
  open,
  onOpenChange,
  delegacionId,
  onConvert,
}: TransferRunDialogProps) {
  const { user } = useAuth()
  const { cuentas, loading: cuentasLoading } = useCuentas(delegacionId)
  const { copy } = useClipboard()

  const [index, setIndex] = useState(0)
  const [cuentaId, setCuentaId] = useState<string>("")
  const [fecha, setFecha] = useState<string>(todayISO())
  const [busy, setBusy] = useState(false)
  const [justCopied, setJustCopied] = useState<CopyField>(null)
  const [completados, setCompletados] = useState<string[]>([])

  // Auto-select de la cuenta con más movimientos (persiste entre pasos).
  useEffect(() => {
    if (!open || !delegacionId || cuentasLoading || cuentaId) return
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

  // Reset al cerrar.
  useEffect(() => {
    if (open) return
    setIndex(0)
    setFecha(todayISO())
    setJustCopied(null)
    setCompletados([])
    // Mantenemos cuentaId para reabrir más rápido en la misma sesión.
  }, [open])

  const total = pagos.length
  const pago = pagos[index] ?? null

  const sugerencia = useMemo(() => {
    if (!pago) return { iban: "", ibanFmt: "", importe: "", concepto: "" }
    const ibanRaw = normalizarIban(pago.contacto?.iban ?? "")
    return {
      iban: ibanRaw,
      ibanFmt: formatearIban(ibanRaw),
      importe: formatImporteBanco(Number(pago.importe)),
      concepto: getConceptoTransferenciaSugerido(pago),
    }
  }, [pago])

  // Atajos: Enter / → siguiente; Esc cerrar (lo gestiona Dialog).
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return
      if (e.key === "ArrowRight") {
        e.preventDefault()
        handleSkip()
      } else if (e.key === "Enter") {
        e.preventDefault()
        void handleDone()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, index, cuentaId, fecha, busy])

  if (!pago) {
    // Si entramos sin pagos: mostrar mensaje breve y cerrar.
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>No hay pagos pendientes con IBAN</DialogTitle>
            <DialogDescription>
              Cuando tengas pagos pendientes con IBAN, vuelve aquí para hacerlos uno detrás del otro
              sin perderte.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    )
  }

  const doCopy = async (field: Exclude<CopyField, null>, value: string) => {
    const ok = await copy(value)
    if (ok) {
      setJustCopied(field)
      setTimeout(() => setJustCopied((curr) => (curr === field ? null : curr)), 1200)
    }
  }

  const advance = () => {
    if (index + 1 >= total) {
      toast.success(`Modo transferencia terminado · ${completados.length} pago(s) marcado(s)`)
      onOpenChange(false)
    } else {
      setIndex((i) => i + 1)
      setJustCopied(null)
    }
  }

  const handleSkip = () => {
    if (busy) return
    advance()
  }

  const handleDone = async () => {
    if (!user) {
      toast.error("Debes iniciar sesión")
      return
    }
    if (!cuentaId) {
      toast.error("Elige la cuenta desde la que pagas")
      return
    }
    setBusy(true)
    try {
      await onConvert(pago.id, { cuentaId, fecha, delegacionId, creadoPor: user.id })
      setCompletados((prev) => [...prev, pago.id])
      advance()
    } catch (err) {
      toast.error("No se pudo marcar como pagado: " + (err instanceof Error ? err.message : "error"))
    } finally {
      setBusy(false)
    }
  }

  const handleBack = () => {
    if (index === 0) return
    setIndex((i) => i - 1)
    setJustCopied(null)
  }

  const progressPct = Math.round(((index + 1) / total) * 100)
  const cuentaActual = cuentas.find((c) => c.id === cuentaId)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-primary" />
              Modo transferencia
            </DialogTitle>
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              Pago {index + 1} de {total}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted" aria-label={`Progreso ${progressPct}%`}>
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <DialogDescription className="sr-only">
            Asistente para realizar transferencias bancarias una a una y marcarlas como pagadas.
          </DialogDescription>
        </DialogHeader>

        {/* Resumen del pago */}
        <div className="rounded-lg border bg-muted/30 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Beneficiario
              </div>
              <div className="truncate text-lg font-semibold">
                {pago.contacto?.nombre ?? "Contacto"}
              </div>
              {pago.concepto && (
                <div className="line-clamp-2 text-sm text-muted-foreground">{pago.concepto}</div>
              )}
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
                Importe
              </div>
              <div className="text-2xl font-bold tabular-nums text-primary">
                {formatCurrency(Number(pago.importe))}
              </div>
            </div>
          </div>
        </div>

        {/* Cuenta + fecha (se mantienen para el siguiente paso) */}
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="trf-cuenta" className="text-xs">
              Cuenta desde la que pagas
            </Label>
            <Select value={cuentaId} onValueChange={setCuentaId} disabled={cuentasLoading}>
              <SelectTrigger id="trf-cuenta">
                <SelectValue placeholder="Elige cuenta…" />
              </SelectTrigger>
              <SelectContent>
                {cuentas.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="trf-fecha" className="text-xs">
              Fecha
            </Label>
            <Input
              id="trf-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-[160px]"
            />
          </div>
        </div>

        {/* Campos copiables */}
        <div className="space-y-2">
          <CopyRow
            label="IBAN"
            value={sugerencia.ibanFmt}
            copyValue={sugerencia.iban}
            copied={justCopied === "iban"}
            onCopy={() => doCopy("iban", sugerencia.iban)}
          />
          <CopyRow
            label="Importe"
            value={sugerencia.importe + " €"}
            copyValue={sugerencia.importe}
            copied={justCopied === "importe"}
            onCopy={() => doCopy("importe", sugerencia.importe)}
            mono
          />
          <CopyRow
            label="Concepto"
            value={sugerencia.concepto}
            copyValue={sugerencia.concepto}
            copied={justCopied === "concepto"}
            onCopy={() => doCopy("concepto", sugerencia.concepto)}
            multiline
          />
        </div>

        {/* Acciones */}
        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:items-center sm:justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBack}
            disabled={index === 0 || busy}
            className="sm:w-auto"
          >
            <ChevronLeft className="mr-1 h-4 w-4" /> Anterior
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSkip}
              disabled={busy}
              title="Saltar este pago (no marca como pagado)"
            >
              <SkipForward className="mr-1 h-4 w-4" /> Saltar
            </Button>
            <Button onClick={handleDone} disabled={busy || !cuentaId} size="sm" className="min-w-[180px]">
              {busy ? (
                <>
                  <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> Marcando…
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-1.5 h-4 w-4" />
                  Hecho · {index + 1 >= total ? "Terminar" : "Siguiente"}
                  {index + 1 < total && <ArrowRight className="ml-1 h-4 w-4" />}
                </>
              )}
            </Button>
          </div>
        </div>

        {cuentaActual && (
          <p className="text-[11px] text-muted-foreground">
            Al pulsar <span className="font-medium">Hecho</span> se creará el movimiento en{" "}
            <span className="font-medium">{cuentaActual.nombre}</span> con fecha {fecha} y el pago
            quedará marcado como pagado.
          </p>
        )}
      </DialogContent>
    </Dialog>
  )
}

function CopyRow({
  label,
  value,
  copyValue,
  copied,
  onCopy,
  mono = false,
  multiline = false,
}: {
  label: string
  value: string
  copyValue: string
  copied: boolean
  onCopy: () => void
  mono?: boolean
  multiline?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onCopy}
      title={`Copiar ${label.toLowerCase()}: ${copyValue}`}
      className={cn(
        "group flex w-full items-center gap-3 rounded-md border bg-background p-3 text-left transition",
        "hover:border-primary/60 hover:bg-primary/5",
        copied && "border-emerald-500/60 bg-emerald-50/60 dark:bg-emerald-950/20",
      )}
    >
      <div className="flex w-24 shrink-0 flex-col">
        <span className="text-[10px] font-medium uppercase tracking-widest text-muted-foreground">
          {label}
        </span>
      </div>
      <div
        className={cn(
          "min-w-0 flex-1 break-all text-sm",
          mono && "font-mono tabular-nums",
          multiline ? "whitespace-pre-wrap" : "truncate",
        )}
      >
        {value || <span className="text-muted-foreground italic">(vacío)</span>}
      </div>
      <span
        className={cn(
          "flex shrink-0 items-center gap-1 text-xs font-medium",
          copied ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground group-hover:text-primary",
        )}
      >
        {copied ? (
          <>
            <Check className="h-3.5 w-3.5" /> Copiado
          </>
        ) : (
          <>
            <Copy className="h-3.5 w-3.5" /> Copiar
          </>
        )}
      </span>
    </button>
  )
}
