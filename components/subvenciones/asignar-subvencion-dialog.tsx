"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { CalendarRange, Landmark, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { StatusPill } from "@/components/ui/status-pill"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useAuth } from "@/contexts/auth-context"
import { useSubvenciones } from "@/hooks/use-subvenciones"
import { useSubmitGuard } from "@/hooks/use-submit-guard"
import { SubvencionFormDialog } from "./subvencion-form-dialog"
import { imputacionesDeMovimientos, imputarMovimientos, quitarMovimientos } from "@/lib/services/subvenciones"
import { SUBVENCION_ESTADO_INFO, fueraDePeriodo, repartirAsignacion } from "@/lib/utils/subvenciones"
import { describirError } from "@/lib/utils/describir-error"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface AsignarSubvencionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Movimientos seleccionados en la pantalla de Movimientos. */
  movimientos: { id: string; fecha: string; importe: number }[]
  onDone?: () => void
}

/**
 * Imputa la selección de Movimientos a una subvención.
 *
 * Un movimiento solo puede estar en una subvención (scripts/071). Los que ya
 * están en otra se enseñan y **no se mueven**: sacar un gasto de una
 * justificación tiene que ser un gesto propio, desde esa subvención.
 */
export function AsignarSubvencionDialog({
  open,
  onOpenChange,
  movimientos,
  onDone,
}: AsignarSubvencionDialogProps) {
  const { user } = useAuth()
  const { subvenciones, loading, invalidar } = useSubvenciones({ enabled: open })
  const [destinoId, setDestinoId] = useState<string | null>(null)
  const [existentes, setExistentes] = useState<{ movimiento_id: string; subvencion_id: string }[] | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [crearOpen, setCrearOpen] = useState(false)
  const { enviando, guard } = useSubmitGuard()

  const ids = useMemo(() => movimientos.map((m) => m.id), [movimientos])
  const idsKey = ids.join(",")

  // Al abrir: dónde está ya cada movimiento seleccionado.
  useEffect(() => {
    if (!open) return
    let vivo = true
    setExistentes(null)
    setErrorCarga(null)
    imputacionesDeMovimientos(ids)
      .then((filas) => vivo && setExistentes(filas))
      .catch((err) => vivo && setErrorCarga(describirError(err, "No se ha podido comprobar la selección")))
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idsKey])

  // Solo se ofrecen las que admiten gastos: denegadas y cerradas no.
  const elegibles = useMemo(
    () => subvenciones.filter((s) => s.estado !== "denegada" && s.estado !== "cerrada"),
    [subvenciones],
  )
  const nombrePorId = useMemo(() => new Map(subvenciones.map((s) => [s.id, s.nombre])), [subvenciones])
  const destino = elegibles.find((s) => s.id === destinoId) ?? null

  const reparto = useMemo(
    () => (existentes && destinoId ? repartirAsignacion(ids, existentes, destinoId) : null),
    [existentes, destinoId, ids],
  )
  const libres = existentes ? repartirAsignacion(ids, existentes, "").nuevos.length : null
  const nuevos = reparto?.nuevos ?? []
  const nuevosSet = new Set(nuevos)
  const importeNuevos = movimientos.filter((m) => nuevosSet.has(m.id)).reduce((a, m) => a + m.importe, 0)
  const fuera = destino ? movimientos.filter((m) => nuevosSet.has(m.id) && fueraDePeriodo(m.fecha, destino)).length : 0

  const handleAsignar = guard(async () => {
    if (!destino || !nuevos.length) return
    try {
      await imputarMovimientos(destino.id, nuevos, user?.id ?? null)
      await invalidar()
      onOpenChange(false)
      onDone?.()
      const saltados = ids.length - nuevos.length
      toast.success(
        `${nuevos.length} ${nuevos.length === 1 ? "movimiento imputado" : "movimientos imputados"} a ${destino.nombre}` +
          (saltados ? ` · ${saltados} no se han tocado` : ""),
        {
          duration: 12000,
          action: {
            label: "Deshacer",
            onClick: () => {
              quitarMovimientos(destino.id, nuevos)
                .then(() => {
                  invalidar()
                  toast.success("Imputación deshecha")
                })
                .catch((err) => toast.error(describirError(err, "No se ha podido deshacer")))
            },
          },
        },
      )
    } catch (err) {
      toast.error(describirError(err, "No se han podido imputar los movimientos"))
    }
  })

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !enviando && onOpenChange(o)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Imputar a una subvención</DialogTitle>
            <DialogDescription>
              {ids.length} {ids.length === 1 ? "movimiento seleccionado" : "movimientos seleccionados"}
              {libres != null && libres < ids.length && ` · ${libres} libres`}. Cada movimiento solo puede estar en una
              subvención.
            </DialogDescription>
          </DialogHeader>

          {errorCarga ? (
            <p className="text-sm text-destructive" role="alert">
              {errorCarga}
            </p>
          ) : loading || existentes === null ? (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <LoadingSpinner size="sm" /> Comprobando la selección…
            </div>
          ) : elegibles.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
              <Landmark className="h-6 w-6" />
              No hay ninguna subvención abierta a la que imputar gastos.
              <Button size="sm" onClick={() => setCrearOpen(true)}>
                <Plus className="h-4 w-4" />
                Nueva subvención
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div role="radiogroup" aria-label="Subvención" className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
                {elegibles.map((s) => {
                  const info = SUBVENCION_ESTADO_INFO[s.estado]
                  const activa = s.id === destinoId
                  return (
                    <button
                      key={s.id}
                      type="button"
                      role="radio"
                      aria-checked={activa}
                      onClick={() => setDestinoId(s.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left transition-colors",
                        activa ? "border-primary/60 bg-primary/5 ring-1 ring-primary/40" : "hover:bg-muted/60",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium">{s.nombre}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[s.financiador, s.ejercicio].filter(Boolean).join(" · ")} · {s.resumen.movimientos} mov.
                        </span>
                      </span>
                      <StatusPill
                        label={info.label}
                        icon={info.icon}
                        bgClass={info.bgClass}
                        textClass={info.textClass}
                        borderClass={info.borderClass}
                      />
                    </button>
                  )
                })}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCrearOpen(true)} className="text-muted-foreground">
                <Plus className="h-4 w-4" />
                Nueva subvención
              </Button>

              {reparto && (
                <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-sm" aria-live="polite">
                  <p>
                    <span className="font-medium">{nuevos.length}</span>{" "}
                    {nuevos.length === 1 ? "se imputará" : "se imputarán"}
                    {nuevos.length > 0 && <> · {formatCurrency(importeNuevos)}</>}
                  </p>
                  {reparto.yaEnEsta.length > 0 && (
                    <p className="text-muted-foreground">
                      {reparto.yaEnEsta.length} ya {reparto.yaEnEsta.length === 1 ? "estaba" : "estaban"} en esta.
                    </p>
                  )}
                  {[...reparto.enOtra.entries()].map(([otraId, lista]) => (
                    <p key={otraId} className="text-amber-700 dark:text-amber-300">
                      {lista.length} {lista.length === 1 ? "está" : "están"} en{" "}
                      <Link href={`/subvenciones/${otraId}`} className="font-medium underline underline-offset-2">
                        {nombrePorId.get(otraId) ?? "otra subvención"}
                      </Link>{" "}
                      y no se {lista.length === 1 ? "toca" : "tocan"}. Para cambiarlos, quítalos antes de allí.
                    </p>
                  ))}
                  {fuera > 0 && (
                    <p className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                      <CalendarRange className="h-3.5 w-3.5 shrink-0" />
                      {fuera} {fuera === 1 ? "cae" : "caen"} fuera del periodo de gastos de la subvención.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button onClick={handleAsignar} disabled={!destino || !nuevos.length || enviando} aria-busy={enviando}>
              {enviando && <LoadingSpinner size="sm" />}
              {nuevos.length
                ? `Imputar ${nuevos.length} ${nuevos.length === 1 ? "movimiento" : "movimientos"}`
                : "Imputar movimientos"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SubvencionFormDialog
        open={crearOpen}
        onOpenChange={setCrearOpen}
        onSaved={(s) => {
          invalidar()
          setDestinoId(s.id)
        }}
      />
    </>
  )
}
