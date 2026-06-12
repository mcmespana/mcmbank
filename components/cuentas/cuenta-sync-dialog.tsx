"use client"

import { useRef, useState } from "react"
import { Loader2, RefreshCw, CheckCircle2, AlertCircle, ChevronDown, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import type { BancoSyncLogStep } from "@/lib/types/database"

type SyncResult = {
  cuenta_id: string
  log_id: string
  estado: "ok" | "error" | "parcial"
  recibidas: number
  insertadas: number
  duplicadas: number
  errores: number
  date_from: string | null
  date_to: string | null
  error_mensaje?: string | null
  log: BancoSyncLogStep[]
  movimientos_insertados?: Array<{ fecha: string; concepto: string | null; importe: number }>
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  cuentaId: string
  cuentaNombre: string
  onCompleted?: () => void
}

export function CuentaSyncDialog({ open, onOpenChange, cuentaId, cuentaNombre, onCompleted }: Props) {
  const [running, setRunning] = useState(false)
  const [result, setResult] = useState<SyncResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Refrescamos la lista de cuentas SOLO al cerrar el dialog: si lo hacemos
  // al terminar la sync, el manager entra en loading, desmonta este dialog
  // y se pierde el resumen en pantalla.
  const didSyncRef = useRef(false)

  const handleOpenChange = (o: boolean) => {
    if (!o && didSyncRef.current) {
      didSyncRef.current = false
      onCompleted?.()
    }
    onOpenChange(o)
  }

  const run = async () => {
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const res = await fetch(`/api/bank-sync/run?cuenta_id=${cuentaId}`, { method: "POST" })
      const body = await res.json()
      if (!res.ok || !body.ok) {
        setError(body.error || `HTTP ${res.status}`)
      } else {
        setResult(body.resultado as SyncResult)
        didSyncRef.current = true
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setRunning(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Sincronizar {cuentaNombre}
          </DialogTitle>
          <DialogDescription>
            Solicita los movimientos a Enable Banking y los importa, evitando duplicados. Muestra todo el log
            de la operación para diagnóstico.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-4">
          {!result && !error && !running && (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Pulsa "Ejecutar sincronización" para empezar.
            </div>
          )}

          {running && (
            <div className="flex items-center justify-center gap-3 py-8 text-sm">
              <Loader2 className="h-5 w-5 animate-spin" />
              Ejecutando sincronización...
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-900 dark:bg-red-950 dark:text-red-200 dark:border-red-800">
              <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-semibold">Error en la sincronización</div>
                <div className="mt-1 whitespace-pre-wrap font-mono text-xs">{error}</div>
              </div>
            </div>
          )}

          {result && <ResultView result={result} />}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={running}>
            Cerrar
          </Button>
          <Button onClick={run} disabled={running}>
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Ejecutando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                {result ? "Volver a ejecutar" : "Ejecutar sincronización"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ResultView({ result }: { result: SyncResult }) {
  const color =
    result.estado === "ok" ? "bg-green-500" : result.estado === "parcial" ? "bg-yellow-500" : "bg-red-500"
  return (
    <div className="space-y-4">
      <div className="rounded-lg border p-4 space-y-3">
        <div className="flex items-center gap-2">
          {result.estado === "ok" ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <AlertCircle className="h-5 w-5 text-yellow-600" />
          )}
          <span className="font-semibold capitalize">{result.estado}</span>
          <Badge className={color + " text-white"}>{result.estado.toUpperCase()}</Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
          <Stat label="Recibidas" value={result.recibidas} />
          <Stat label="Insertadas" value={result.insertadas} highlight />
          <Stat label="Duplicadas" value={result.duplicadas} />
          <Stat label="Errores" value={result.errores} danger={result.errores > 0} />
        </div>

        <div className="text-xs text-muted-foreground">
          Ventana: <span className="font-mono">{result.date_from}</span> →{" "}
          <span className="font-mono">{result.date_to}</span>
        </div>

        {result.error_mensaje && (
          <div className="rounded bg-red-50 dark:bg-red-950 p-2 text-xs text-red-900 dark:text-red-200 font-mono">
            {result.error_mensaje}
          </div>
        )}
      </div>

      {result.movimientos_insertados && result.movimientos_insertados.length > 0 && (
        <ImportedList movimientos={result.movimientos_insertados} total={result.insertadas} />
      )}

      <LogViewer steps={result.log} />
    </div>
  )
}

function ImportedList({
  movimientos,
  total,
}: {
  movimientos: NonNullable<SyncResult["movimientos_insertados"]>
  total: number
}) {
  const sorted = [...movimientos].sort((a, b) => b.fecha.localeCompare(a.fecha))
  return (
    <div className="rounded-lg border">
      <div className="border-b px-3 py-2 font-semibold text-sm">
        Movimientos importados ({total})
        {total > movimientos.length && (
          <span className="ml-2 font-normal text-xs text-muted-foreground">
            mostrando los {movimientos.length} primeros
          </span>
        )}
      </div>
      <div className="max-h-72 overflow-y-auto divide-y text-sm">
        {sorted.map((m, i) => (
          <div key={`${m.fecha}-${m.concepto}-${m.importe}-${i}`} className="flex items-center gap-3 px-3 py-1.5">
            <span className="font-mono text-xs text-muted-foreground shrink-0">{m.fecha}</span>
            <span className="flex-1 truncate" title={m.concepto || undefined}>
              {m.concepto || "(sin concepto)"}
            </span>
            <span
              className={
                "font-mono text-xs font-semibold shrink-0 " +
                (m.importe >= 0 ? "text-green-600" : "text-red-600")
              }
            >
              {m.importe.toLocaleString("es-ES", { style: "currency", currency: "EUR" })}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  highlight,
  danger,
}: {
  label: string
  value: number
  highlight?: boolean
  danger?: boolean
}) {
  return (
    <div className="rounded border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div
        className={
          "text-lg font-semibold " +
          (danger ? "text-red-600" : highlight ? "text-green-600" : "")
        }
      >
        {value}
      </div>
    </div>
  )
}

function LogViewer({ steps }: { steps: BancoSyncLogStep[] }) {
  return (
    <div className="rounded-lg border">
      <div className="border-b px-3 py-2 font-semibold text-sm">Log detallado ({steps.length} pasos)</div>
      <div className="max-h-96 overflow-y-auto divide-y text-xs font-mono">
        {steps.map((s, i) => (
          <LogRow key={`${s.t}-${i}`} step={s} />
        ))}
      </div>
    </div>
  )
}

function LogRow({ step }: { step: BancoSyncLogStep }) {
  const [open, setOpen] = useState(false)
  const colors: Record<string, string> = {
    info: "text-blue-600 dark:text-blue-400",
    warn: "text-yellow-600 dark:text-yellow-400",
    error: "text-red-600 dark:text-red-400",
    debug: "text-gray-500",
  }
  const hasData = !!step.data && Object.keys(step.data).length > 0
  return (
    <div className="px-3 py-1.5">
      <div
        className={"flex items-start gap-2 " + (hasData ? "cursor-pointer" : "")}
        onClick={() => hasData && setOpen(!open)}
      >
        <span className="text-muted-foreground shrink-0">
          {new Date(step.t).toISOString().split("T")[1]?.slice(0, 12)}
        </span>
        <span className={"shrink-0 uppercase " + (colors[step.level] || "")}>[{step.level}]</span>
        {hasData && (open ? <ChevronDown className="h-3 w-3 mt-0.5" /> : <ChevronRight className="h-3 w-3 mt-0.5" />)}
        <span className="break-words">{step.msg}</span>
      </div>
      {hasData && open && (
        <pre className="mt-1 ml-6 rounded bg-muted p-2 overflow-x-auto whitespace-pre-wrap break-all">
          {JSON.stringify(step.data, null, 2)}
        </pre>
      )}
    </div>
  )
}
