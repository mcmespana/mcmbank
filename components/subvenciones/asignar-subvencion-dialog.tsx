"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { CalendarRange, Landmark, Plus, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import {
  SUBVENCION_ESTADO_INFO,
  admiteGastos,
  fueraDePeriodo,
  importeDesdePorcentaje,
  redondear2,
  repartirAsignacion,
  type Imputacion,
} from "@/lib/utils/subvenciones"
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

type Cuanto = "libre" | "porcentaje"

/**
 * Imputa la selección de Movimientos a una subvención.
 *
 * Un movimiento puede repartirse entre varias subvenciones (scripts/072), así
 * que cada uno entra por **lo que le queda libre**, o por un porcentaje de su
 * importe ("el 60 % de cada factura del campamento, al IVAJ") sin pasar de lo
 * libre. Lo que ya está entero en otra se enseña y no se toca: quitarle un
 * gasto a una justificación es un gesto propio, desde esa subvención.
 */
export function AsignarSubvencionDialog({ open, onOpenChange, movimientos, onDone }: AsignarSubvencionDialogProps) {
  const { user } = useAuth()
  const { subvenciones, loading, invalidar } = useSubvenciones({ enabled: open })
  const [destinoId, setDestinoId] = useState<string | null>(null)
  const [existentes, setExistentes] = useState<Imputacion[] | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [crearOpen, setCrearOpen] = useState(false)
  const [filtro, setFiltro] = useState("")
  const [cuanto, setCuanto] = useState<Cuanto>("libre")
  const [pct, setPct] = useState("100")
  const { enviando, guard } = useSubmitGuard()

  const idsKey = movimientos.map((m) => m.id).join(",")

  // Al abrir: dónde está ya cada movimiento seleccionado, y con cuánto.
  useEffect(() => {
    if (!open) return
    let vivo = true
    setExistentes(null)
    setErrorCarga(null)
    imputacionesDeMovimientos(movimientos.map((m) => m.id))
      .then((filas) => vivo && setExistentes(filas))
      .catch((err) => vivo && setErrorCarga(describirError(err, "No se ha podido comprobar la selección")))
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idsKey])

  // Las rechazadas y renunciadas no justifican nada. Primero las del año más
  // reciente, que es donde casi siempre se imputa.
  const elegibles = useMemo(() => {
    const q = filtro.trim().toLowerCase()
    return subvenciones
      .filter((s) => admiteGastos(s.estado))
      .filter(
        (s) =>
          !q ||
          [s.codigo, s.nombre, s.financiador?.nombre, s.ejercicio].filter(Boolean).join(" ").toLowerCase().includes(q),
      )
      .sort((a, b) => (b.ejercicio ?? 0) - (a.ejercicio ?? 0) || (a.financiador?.orden ?? 999) - (b.financiador?.orden ?? 999))
  }, [subvenciones, filtro])
  const nombrePorId = useMemo(
    () => new Map(subvenciones.map((s) => [s.id, s.codigo ? `${s.codigo} · ${s.nombre}` : s.nombre])),
    [subvenciones],
  )
  const destino = subvenciones.find((s) => s.id === destinoId) ?? null

  const reparto = useMemo(
    () => (existentes && destinoId ? repartirAsignacion(movimientos, existentes, destinoId) : null),
    [existentes, destinoId, movimientos],
  )

  // Con porcentaje, cada uno se lleva ese % de su importe, sin pasar de lo libre.
  const pctNum = Number(pct.replace(",", "."))
  const pctValido = cuanto === "libre" || (Number.isFinite(pctNum) && pctNum > 0 && pctNum <= 100)
  const items = useMemo(() => {
    if (!reparto) return []
    const totalPorId = new Map(movimientos.map((m) => [m.id, m.importe]))
    return reparto.aImputar
      .map((a) => ({
        id: a.id,
        importe:
          cuanto === "libre"
            ? a.importe
            : redondear2(Math.min(a.importe, importeDesdePorcentaje(pctNum, totalPorId.get(a.id) ?? 0))),
      }))
      .filter((a) => a.importe > 0)
  }, [reparto, cuanto, pctNum, movimientos])
  const recortados =
    cuanto === "porcentaje" && reparto
      ? reparto.aImputar.filter((a) => {
          const total = Math.abs(movimientos.find((m) => m.id === a.id)?.importe ?? 0)
          return importeDesdePorcentaje(pctNum, total) > a.importe + 0.005
        }).length
      : 0
  const importeTotal = items.reduce((acc, i) => acc + i.importe, 0)
  const idsItems = new Set(items.map((i) => i.id))
  const fuera = destino ? movimientos.filter((m) => idsItems.has(m.id) && fueraDePeriodo(m.fecha, destino)).length : 0

  const handleAsignar = guard(async () => {
    if (!destino || !items.length || !pctValido) return
    try {
      await imputarMovimientos(destino.id, items, user?.id ?? null)
      await invalidar()
      onOpenChange(false)
      onDone?.()
      const saltados = movimientos.length - items.length
      toast.success(
        `${items.length} ${items.length === 1 ? "movimiento imputado" : "movimientos imputados"} a ${destino.nombre} · ${formatCurrency(importeTotal)}` +
          (saltados ? ` · ${saltados} no se han tocado` : ""),
        {
          duration: 12000,
          action: {
            label: "Deshacer",
            onClick: () => {
              quitarMovimientos(
                destino.id,
                items.map((i) => i.id),
              )
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
              {movimientos.length} {movimientos.length === 1 ? "movimiento seleccionado" : "movimientos seleccionados"}.
              Un gasto puede repartirse entre varias subvenciones sin pasar de su importe.
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
          ) : subvenciones.filter((s) => admiteGastos(s.estado)).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
              <Landmark className="h-6 w-6" />
              No hay ninguna subvención a la que imputar gastos.
              <Button size="sm" onClick={() => setCrearOpen(true)}>
                <Plus className="h-4 w-4" />
                Nueva subvención
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={filtro}
                  onChange={(e) => setFiltro(e.target.value)}
                  placeholder="Buscar subvención…"
                  className="pl-8"
                  aria-label="Buscar subvención"
                />
              </div>
              <div role="radiogroup" aria-label="Subvención" className="max-h-64 space-y-1.5 overflow-y-auto pr-1">
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
                        <span className="block truncate text-sm font-medium">
                          {s.codigo && <span className="mr-1.5 font-mono text-xs text-muted-foreground">{s.codigo}</span>}
                          {s.nombre}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {[s.financiador?.nombre, s.ejercicio ?? "Para estudiar"].filter(Boolean).join(" · ")} ·{" "}
                          {s.resumen.movimientos} mov.
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
                {elegibles.length === 0 && (
                  <p className="py-4 text-center text-sm text-muted-foreground">Ninguna coincide con «{filtro}».</p>
                )}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setCrearOpen(true)} className="text-muted-foreground">
                <Plus className="h-4 w-4" />
                Nueva subvención
              </Button>

              <fieldset className="space-y-2">
                <legend className="text-sm font-medium">¿Cuánto de cada movimiento?</legend>
                <div role="radiogroup" className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1">
                  {(["libre", "porcentaje"] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={cuanto === c}
                      onClick={() => setCuanto(c)}
                      className={cn(
                        "rounded px-2 py-1.5 text-xs font-medium transition-colors",
                        cuanto === c ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {c === "libre" ? "Todo lo que quede libre" : "Un porcentaje"}
                    </button>
                  ))}
                </div>
                {cuanto === "porcentaje" && (
                  <div className="flex items-center gap-2">
                    <div className="relative w-28">
                      <Input
                        inputMode="decimal"
                        value={pct}
                        onChange={(e) => setPct(e.target.value.replace(/[^\d.,]/g, ""))}
                        className="pr-7 text-right tabular-nums"
                        aria-label="Porcentaje de cada movimiento"
                        aria-invalid={!pctValido}
                      />
                      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                        %
                      </span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {pctValido ? "de cada uno, sin pasar de lo que le quede libre." : "Entre 0 y 100."}
                    </span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Luego puedes ajustar cada uno desde la subvención.</p>
              </fieldset>

              {reparto && (
                <div className="space-y-1.5 rounded-lg border bg-muted/30 p-3 text-sm" aria-live="polite">
                  <p>
                    <span className="font-medium">{items.length}</span> {items.length === 1 ? "se imputará" : "se imputarán"}
                    {items.length > 0 && <> · {formatCurrency(importeTotal)}</>}
                  </p>
                  {reparto.parciales > 0 && (
                    <p className="text-muted-foreground">
                      {reparto.parciales} {reparto.parciales === 1 ? "ya está" : "ya están"} en parte en otra subvención: entra
                      {reparto.parciales === 1 ? "" : "n"} solo por lo que queda libre.
                    </p>
                  )}
                  {recortados > 0 && (
                    <p className="text-muted-foreground">
                      {recortados} no {recortados === 1 ? "llega" : "llegan"} al {pct} % porque el resto está en otra.
                    </p>
                  )}
                  {reparto.yaEnEsta.length > 0 && (
                    <p className="text-muted-foreground">
                      {reparto.yaEnEsta.length} ya {reparto.yaEnEsta.length === 1 ? "estaba" : "estaban"} en esta. Su parte
                      se cambia desde la subvención.
                    </p>
                  )}
                  {[...reparto.sinHueco.entries()].map(([otraId, lista]) => (
                    <p key={otraId} className="text-amber-700 dark:text-amber-300">
                      {lista.length} {lista.length === 1 ? "está entero" : "están enteros"} en{" "}
                      <Link href={`/subvenciones/${otraId}`} className="font-medium underline underline-offset-2">
                        {nombrePorId.get(otraId) ?? "otra subvención"}
                      </Link>{" "}
                      y no {lista.length === 1 ? "cabe" : "caben"}. Para repartirlos, baja antes su parte allí.
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
            <Button
              onClick={handleAsignar}
              disabled={!destino || !items.length || !pctValido || enviando}
              aria-busy={enviando}
            >
              {enviando && <LoadingSpinner size="sm" />}
              {items.length
                ? `Imputar ${items.length} ${items.length === 1 ? "movimiento" : "movimientos"}`
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
