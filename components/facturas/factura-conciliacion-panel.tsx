"use client"

import { useEffect, useMemo, useState } from "react"
import { Loader2, PartyPopper, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"
import { DatabaseService } from "@/lib/services/database"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { esMatchDirecto, scoreCandidatoMovimiento } from "@/lib/utils/facturas"
import type { MovimientoConRelaciones } from "@/lib/types/database"

interface FacturaConciliacionPanelProps {
  delegacionId: string
  /** Importe que aún le falta cubrir a la factura (total menos lo ya vinculado). */
  importePendiente: number | null
  /** Suma de los movimientos ya vinculados (0 si aún no tiene ninguno). */
  importeYaPagado: number
  fechaEmision: string | null
  contactoId: string | null
  /** Nombre del proveedor, para cotejarlo con el concepto del movimiento. */
  contactoNombre?: string | null
  seleccion: string | null
  onSeleccionChange: (id: string | null) => void
}

/**
 * Cuerpo de la búsqueda de candidatos para conciliar una factura, extraído
 * de vincular-movimiento-dialog.tsx para poder vivir tanto en ese diálogo
 * como, embebido, en factura-detail-sheet.tsx — donde se recalcula al vuelo
 * cada vez que se edita el importe en la sección de datos.
 */
export function FacturaConciliacionPanel({
  delegacionId,
  importePendiente,
  importeYaPagado,
  fechaEmision,
  contactoId,
  contactoNombre,
  seleccion,
  onSeleccionChange,
}: FacturaConciliacionPanelProps) {
  const [candidatos, setCandidatos] = useState<MovimientoConRelaciones[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    DatabaseService.findCandidatosMovimientoParaFactura(
      delegacionId,
      {
        importe: importePendiente,
        fecha_emision: fechaEmision,
        contacto_id: contactoId,
        contacto_nombre: contactoNombre ?? null,
      },
      { limit: 30 },
    )
      .then((list) => {
        if (!cancelled) setCandidatos(list)
      })
      .catch(() => {
        if (!cancelled) setCandidatos([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [delegacionId, importePendiente, fechaEmision, contactoId, contactoNombre])

  const scores = useMemo(
    () =>
      candidatos.map((m) =>
        scoreCandidatoMovimiento(
          {
            importe: importePendiente,
            fecha_emision: fechaEmision,
            contacto_id: contactoId,
            contacto_nombre: contactoNombre ?? null,
          },
          m,
        ),
      ),
    [candidatos, importePendiente, fechaEmision, contactoId, contactoNombre],
  )

  const matchDirecto = useMemo(() => esMatchDirecto(scores), [scores])

  // Pre-selecciona el match directo para minimizar clicks.
  useEffect(() => {
    if (matchDirecto && candidatos[0] && !seleccion) {
      onSeleccionChange(candidatos[0].id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchDirecto, candidatos])

  return (
    <div className="space-y-2">
      {importeYaPagado > 0 && importePendiente != null && (
        <p className="rounded-md bg-orange-50 px-2.5 py-1.5 text-xs text-orange-800 dark:bg-orange-950/30 dark:text-orange-200">
          Ya hay {formatCurrency(importeYaPagado)} vinculados. Buscando movimientos por el resto:{" "}
          <span className="font-semibold">{formatCurrency(importePendiente)}</span>.
        </p>
      )}

      {matchDirecto && candidatos[0] ? (
        <p className="flex items-start gap-1.5 rounded-md bg-primary/5 px-2.5 py-1.5 text-xs text-primary">
          <PartyPopper className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            Fijo que es este. Mismo importe y por las mismas fechas: ya te lo he marcado, tú solo
            guarda.
          </span>
        </p>
      ) : (
        <p className="text-xs text-muted-foreground">
          {importePendiente != null
            ? "Gastos con un importe parecido (con un pelín de margen) sin factura vinculada, ordenados por afinidad."
            : "Últimos gastos sin factura vinculada. Añade el importe a la factura para afinar la búsqueda."}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Buscando candidatos…
        </div>
      ) : candidatos.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
          No hay movimientos candidatos. Puede que aún no se haya importado del banco, o que se pagara
          fuera de MCM Bank.
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
                onClick={() => onSeleccionChange(selected ? null : m.id)}
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
                      <Sparkles className="h-3 w-3" /> Este es
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
                  {s?.nombreEnConcepto && (
                    <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
                      lo nombra el concepto
                    </span>
                  )}
                  {s?.otroProveedorEnConcepto && (
                    <span className="rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
                      es de otro proveedor
                    </span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
