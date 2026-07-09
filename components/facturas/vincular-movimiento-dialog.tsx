"use client"

import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { BadgeCheck, Link2, Loader2, Sparkles } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { DatabaseService } from "@/lib/services/database"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { esMatchDirecto, importePagadoFactura, importePendienteFactura, scoreCandidatoMovimiento } from "@/lib/utils/facturas"
import type { FacturaConRelaciones, MovimientoConRelaciones } from "@/lib/types/database"

interface VincularMovimientoDialogProps {
  factura: FacturaConRelaciones | null
  open: boolean
  onOpenChange: (open: boolean) => void
  delegacionId: string
  onLink: (facturaId: string, movimientoId: string, creadoPor?: string) => Promise<void>
  onMarcarPagadaFuera?: (facturaId: string) => Promise<void>
}

export function VincularMovimientoDialog({
  factura,
  open,
  onOpenChange,
  delegacionId,
  onLink,
  onMarcarPagadaFuera,
}: VincularMovimientoDialogProps) {
  const { user } = useAuth()
  const [candidatos, setCandidatos] = useState<MovimientoConRelaciones[]>([])
  const [candidatosLoading, setCandidatosLoading] = useState(false)
  const [seleccion, setSeleccion] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  // Importe que le falta cubrir a la factura (total menos lo ya vinculado en
  // otros movimientos). Se busca por este valor, no por el importe total, para
  // soportar pagos en varios plazos.
  const importePendiente = useMemo(() => (factura ? importePendienteFactura(factura) : null), [factura])
  const yaPagado = useMemo(() => (factura ? importePagadoFactura(factura) : 0), [factura])

  // Cargar candidatos al abrir
  useEffect(() => {
    if (!open || !factura) return
    setCandidatosLoading(true)
    DatabaseService.findCandidatosMovimientoParaFactura(
      delegacionId,
      {
        importe: importePendiente,
        fecha_emision: factura.fecha_emision,
        contacto_id: factura.contacto_id,
      },
      { limit: 30 },
    )
      .then((list) => setCandidatos(list))
      .catch(() => setCandidatos([]))
      .finally(() => setCandidatosLoading(false))
  }, [open, factura, delegacionId, importePendiente])

  // Reset al cerrar
  useEffect(() => {
    if (open) return
    setCandidatos([])
    setSeleccion(null)
  }, [open])

  const scores = useMemo(() => {
    if (!factura) return []
    return candidatos.map((m) =>
      scoreCandidatoMovimiento(
        { importe: importePendiente, fecha_emision: factura.fecha_emision, contacto_id: factura.contacto_id },
        m,
      ),
    )
  }, [candidatos, factura, importePendiente])

  const matchDirecto = useMemo(() => esMatchDirecto(scores), [scores])

  // Pre-selecciona el match directo para minimizar clicks
  useEffect(() => {
    if (matchDirecto && candidatos[0] && !seleccion) {
      setSeleccion(candidatos[0].id)
    }
  }, [matchDirecto, candidatos, seleccion])

  const handleLink = async () => {
    if (!factura || !seleccion) return
    setBusy(true)
    try {
      await onLink(factura.id, seleccion, user?.id)
      toast.success("Factura vinculada al movimiento")
      onOpenChange(false)
    } catch (err) {
      toast.error("No se pudo vincular: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setBusy(false)
    }
  }

  const handlePagadaFuera = async () => {
    if (!factura || !onMarcarPagadaFuera) return
    setBusy(true)
    try {
      await onMarcarPagadaFuera(factura.id)
      toast.success("Factura marcada como pagada fuera de MCM Bank")
      onOpenChange(false)
    } catch (err) {
      toast.error("No se pudo actualizar: " + (err instanceof Error ? err.message : "error desconocido"))
    } finally {
      setBusy(false)
    }
  }

  if (!factura) return null

  const titulo = factura.concepto?.trim() || factura.archivos?.[0]?.nombre_original || "Factura"

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5 text-primary" />
            {yaPagado > 0 ? "Vincular otro pago a la factura" : "Vincular factura a un movimiento"}
          </DialogTitle>
          <DialogDescription>
            {titulo}
            {factura.importe != null && (
              <>
                {" "}· <span className="font-semibold">{formatCurrency(Number(factura.importe))}</span>
              </>
            )}
            {factura.contacto?.nombre && <> · {factura.contacto.nombre}</>}
          </DialogDescription>
        </DialogHeader>

        {yaPagado > 0 && importePendiente != null && (
          <p className="rounded-md bg-orange-50 px-2.5 py-1.5 text-xs text-orange-800 dark:bg-orange-950/30 dark:text-orange-200">
            Ya hay {formatCurrency(yaPagado)} vinculados. Buscando movimientos por el resto:{" "}
            <span className="font-semibold">{formatCurrency(importePendiente)}</span>.
          </p>
        )}

        <p className="text-xs text-muted-foreground">
          {importePendiente != null
            ? "Gastos con un importe parecido (con un pelín de margen) sin factura vinculada, ordenados por afinidad."
            : "Últimos gastos sin factura vinculada. Añade el importe a la factura para afinar la búsqueda."}
        </p>

        {candidatosLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando candidatos…
          </div>
        ) : candidatos.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
            No hay movimientos candidatos. Puede que aún no se haya importado del banco, o que se
            pagara fuera de MCM Bank.
          </div>
        ) : (
          <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {candidatos.map((m, idx) => {
              const s = scores[idx]
              const selected = seleccion === m.id
              const esTop = idx === 0 && matchDirecto
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSeleccion(m.id)}
                  className={cn(
                    "w-full rounded-lg border p-2.5 text-left text-sm transition-colors",
                    selected
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border bg-background hover:border-primary/40 hover:bg-muted/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-medium">{m.concepto}</span>
                    <span className="font-mono text-xs text-rose-700 dark:text-rose-400">
                      {formatCurrency(Number(m.importe))}
                    </span>
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
                    <span>{formatDate(m.fecha)}</span>
                    {m.cuenta?.nombre && <span>· {m.cuenta.nombre}</span>}
                    {esTop && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        <Sparkles className="h-3 w-3" /> Match directo
                      </span>
                    )}
                    {s?.importeExacto && !esTop && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                        importe exacto
                      </span>
                    )}
                    {s?.fechaCercana && (
                      <span className="rounded-full bg-sky-100 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
                        fecha cercana
                      </span>
                    )}
                    {s?.mismoContacto && (
                      <span className="rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
                        mismo contacto
                      </span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          {onMarcarPagadaFuera && factura.estado !== "pagada_fuera" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={handlePagadaFuera}
              className="justify-start text-muted-foreground"
              title="La factura está pagada, pero el movimiento no está en MCM Bank"
            >
              <BadgeCheck className="mr-1.5 h-3.5 w-3.5" /> Pagada fuera de MCM Bank
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleLink} disabled={busy || !seleccion}>
              {busy ? "Vinculando…" : "Vincular"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
