"use client"

import { CodigoSubvencion } from "@/components/subvenciones/codigo-subvencion"
import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { CalendarRange, Check, CheckCircle2, Copy, Landmark, Plus, Search, Sheet as SheetIcon, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
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
import { useClipboard } from "@/hooks/use-clipboard"
import { SubvencionFormDialog } from "./subvencion-form-dialog"
import { imputacionesDeMovimientos, imputarMovimientos, quitarMovimientos } from "@/lib/services/subvenciones"
import {
  SUBVENCION_ESTADO_INFO,
  fueraDePeriodo,
  importeDesdePorcentaje,
  paraImputar,
  redondear2,
  repartirAsignacion,
  tablaParaHoja,
  type Imputacion,
} from "@/lib/utils/subvenciones"
import { describirError } from "@/lib/utils/describir-error"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { SubvencionConResumen } from "@/lib/types/database"

interface AsignarSubvencionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Movimientos seleccionados en la pantalla de Movimientos. */
  movimientos: { id: string; fecha: string; importe: number; concepto?: string | null }[]
  onDone?: () => void
}

/**
 * Imputa la selección de Movimientos a una subvención.
 *
 * - **A cuál**: tarjetas, no una lista larga. Sin buscar, solo las del año en
 *   curso, que es donde se imputa casi siempre; los demás años a un clic, y
 *   escribiendo se busca en todos.
 * - **Cuánto**: el 100 % de cada uno por defecto, sin pasar de lo que le quede
 *   libre (un movimiento puede repartirse entre varias, scripts/072). El % se
 *   puede bajar para todos, y cada parte se ajusta luego en la subvención.
 * - **Los ids**: debajo, cada movimiento con su id y un botón para copiarlo, y
 *   "copiar todos" o la tabla entera para pegarla en Google Sheets. Al imputar
 *   la ventana no se cierra, precisamente para poder copiarlos después.
 *
 * Lo que ya está entero en otra se enseña y no se toca: quitarle un gasto a
 * una justificación es un gesto propio, desde esa subvención.
 */
export function AsignarSubvencionDialog({ open, onOpenChange, movimientos, onDone }: AsignarSubvencionDialogProps) {
  const { user } = useAuth()
  const { subvenciones, loading, invalidar } = useSubvenciones({ enabled: open })
  const [destinoId, setDestinoId] = useState<string | null>(null)
  const [existentes, setExistentes] = useState<Imputacion[] | null>(null)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [crearOpen, setCrearOpen] = useState(false)
  const [filtro, setFiltro] = useState("")
  const [anioElegido, setAnioElegido] = useState<number | "todos" | null>(null)
  const [pct, setPct] = useState("100")
  const [hecho, setHecho] = useState<{ subvencion: SubvencionConResumen; items: { id: string; importe: number }[] } | null>(
    null,
  )
  const { enviando, guard } = useSubmitGuard()

  const idsKey = movimientos.map((m) => m.id).join(",")

  // Al abrir: dónde está ya cada movimiento seleccionado, y con cuánto.
  useEffect(() => {
    if (!open) return
    let vivo = true
    setExistentes(null)
    setErrorCarga(null)
    setHecho(null)
    imputacionesDeMovimientos(movimientos.map((m) => m.id))
      .then((filas) => vivo && setExistentes(filas))
      .catch((err) => vivo && setErrorCarga(describirError(err, "No se ha podido comprobar la selección")))
    return () => {
      vivo = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, idsKey])

  // Años con alguna subvención a la que se pueda imputar; por defecto el actual
  // (o el más reciente si este año aún no hay ninguna).
  const elegiblesTodas = useMemo(() => paraImputar(subvenciones, { todos: true }), [subvenciones])
  const anios = useMemo(
    () => [...new Set(elegiblesTodas.map((s) => s.ejercicio).filter((e): e is number => e != null))].sort((a, b) => b - a),
    [elegiblesTodas],
  )
  const anioActual = new Date().getFullYear()
  const anio = anioElegido ?? (anios.includes(anioActual) ? anioActual : (anios[0] ?? anioActual))
  const buscando = filtro.trim().length > 0
  const tarjetas = useMemo(
    () =>
      paraImputar(subvenciones, {
        q: filtro,
        anio: anio === "todos" ? anioActual : anio,
        todos: anio === "todos",
      }),
    [subvenciones, filtro, anio, anioActual],
  )

  const nombrePorId = useMemo(
    () => new Map(subvenciones.map((s) => [s.id, s.codigo ? `${s.codigo} · ${s.nombre}` : s.nombre])),
    [subvenciones],
  )
  const destino = subvenciones.find((s) => s.id === destinoId) ?? null

  const reparto = useMemo(
    () => (existentes && destinoId ? repartirAsignacion(movimientos, existentes, destinoId) : null),
    [existentes, destinoId, movimientos],
  )

  // Cada uno se lleva el % de su importe, sin pasar de lo libre. Con 100, lo libre.
  const pctNum = Number(pct.replace(",", "."))
  const pctValido = Number.isFinite(pctNum) && pctNum > 0 && pctNum <= 100
  const items = useMemo(() => {
    if (!reparto || !pctValido) return []
    const totalPorId = new Map(movimientos.map((m) => [m.id, m.importe]))
    return reparto.aImputar
      .map((a) => ({
        id: a.id,
        importe: redondear2(Math.min(a.importe, importeDesdePorcentaje(pctNum, totalPorId.get(a.id) ?? 0))),
      }))
      .filter((a) => a.importe > 0)
  }, [reparto, pctNum, pctValido, movimientos])
  const recortados =
    reparto && pctValido
      ? reparto.aImputar.filter((a) => {
          const total = Math.abs(movimientos.find((m) => m.id === a.id)?.importe ?? 0)
          return importeDesdePorcentaje(pctNum, total) > a.importe + 0.005
        }).length
      : 0
  const importeTotal = items.reduce((acc, i) => acc + i.importe, 0)
  const idsItems = new Set(items.map((i) => i.id))
  const fuera = destino ? movimientos.filter((m) => idsItems.has(m.id) && fueraDePeriodo(m.fecha, destino)).length : 0

  // Lo que va a cada fila de la tabla de abajo: lo que se imputará (o se imputó).
  const imputadoPorId = new Map((hecho?.items ?? items).map((i) => [i.id, i.importe]))
  const motivoPorId = new Map<string, string>()
  if (!hecho && reparto) {
    for (const id of reparto.yaEnEsta) motivoPorId.set(id, "Ya está en esta")
    for (const [otraId, lista] of reparto.sinHueco)
      for (const id of lista) motivoPorId.set(id, `Entero en ${nombrePorId.get(otraId) ?? "otra"}`)
  }

  const handleAsignar = guard(async () => {
    if (!destino || !items.length || !pctValido) return
    try {
      await imputarMovimientos(destino.id, items, user?.id ?? null)
      await invalidar()
      // `onDone` (que vacía la selección) espera a que se cierre: si no, la
      // tabla de ids se quedaría vacía justo cuando se quieren copiar.
      setHecho({ subvencion: destino, items })
    } catch (err) {
      toast.error(describirError(err, "No se han podido imputar los movimientos"))
    }
  })

  const deshacer = guard(async () => {
    if (!hecho) return
    try {
      await quitarMovimientos(
        hecho.subvencion.id,
        hecho.items.map((i) => i.id),
      )
      await invalidar()
      setHecho(null)
      toast.success("Imputación deshecha")
    } catch (err) {
      toast.error(describirError(err, "No se ha podido deshacer"))
    }
  })

  const cerrar = () => {
    onOpenChange(false)
    if (hecho) onDone?.()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !enviando && !o && cerrar()}>
        <DialogContent className="flex max-h-[92dvh] flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl">
          <DialogHeader className="border-b px-6 py-4 text-left">
            <DialogTitle>Imputar a una subvención</DialogTitle>
            <DialogDescription>
              {movimientos.length} {movimientos.length === 1 ? "movimiento seleccionado" : "movimientos seleccionados"} ·{" "}
              {formatCurrency(movimientos.reduce((a, m) => a + Math.abs(m.importe), 0))}
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
            {hecho ? (
              <div
                className="flex flex-wrap items-center gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100"
                role="status"
              >
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                <span className="min-w-0 flex-1">
                  <span className="font-medium">
                    {hecho.items.length} {hecho.items.length === 1 ? "imputado" : "imputados"} a{" "}
                    {hecho.subvencion.codigo || hecho.subvencion.nombre}
                  </span>{" "}
                  · {formatCurrency(hecho.items.reduce((a, i) => a + i.importe, 0))}. Ya puedes copiar los ids de abajo.
                </span>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/subvenciones/${hecho.subvencion.id}`}>Ver la subvención</Link>
                </Button>
              </div>
            ) : errorCarga ? (
              <p className="text-sm text-destructive" role="alert">
                {errorCarga}
              </p>
            ) : loading || existentes === null ? (
              <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
                <LoadingSpinner size="sm" /> Comprobando la selección…
              </div>
            ) : elegiblesTodas.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
                <Landmark className="h-6 w-6" />
                No hay ninguna subvención a la que imputar gastos.
                <Button size="sm" onClick={() => setCrearOpen(true)}>
                  <Plus className="h-4 w-4" />
                  Nueva subvención
                </Button>
              </div>
            ) : (
              <section className="space-y-3" aria-labelledby="imputar-a-cual">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <h3 id="imputar-a-cual" className="shrink-0 text-sm font-medium">
                    ¿A cuál?
                  </h3>
                  <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
                    {!buscando &&
                      [...anios.slice(0, 3), "todos" as const].map((a) => (
                        <button
                          key={a}
                          type="button"
                          aria-pressed={anio === a}
                          onClick={() => setAnioElegido(a)}
                          className={cn(
                            "rounded-md px-2.5 py-1 text-xs font-medium tabular-nums transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                            anio === a ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          {a === "todos" ? "Todos los años" : a}
                        </button>
                      ))}
                  </div>
                  <div className="relative sm:w-64">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={filtro}
                      onChange={(e) => setFiltro(e.target.value)}
                      placeholder="Buscar en todos los años…"
                      className="h-9 pl-8"
                      aria-label="Buscar subvención"
                    />
                  </div>
                </div>

                <div
                  role="radiogroup"
                  aria-labelledby="imputar-a-cual"
                  className="grid max-h-[17rem] grid-cols-1 gap-2 overflow-y-auto p-0.5 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {tarjetas.map((s) => {
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
                          "relative flex min-h-[4.25rem] flex-col justify-between gap-1 rounded-lg border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          activa ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:border-foreground/20 hover:bg-muted/50",
                        )}
                      >
                        <span className="line-clamp-2 pr-5 text-sm font-medium leading-snug">
                          {s.codigo && <CodigoSubvencion codigo={s.codigo} nombre={s.nombre} color={s.color} className="mr-1.5 align-[1px]" />}
                          {s.nombre}
                        </span>
                        <span className="flex min-w-0 items-center gap-1.5 text-[11px] text-muted-foreground">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", info.dotClass)} aria-hidden />
                          <span className="truncate">
                            {[info.label, s.financiador?.nombre, (buscando || anio === "todos") && (s.ejercicio ?? "Para estudiar")]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        {activa && <Check className="absolute right-2 top-2 h-4 w-4 text-primary" aria-hidden />}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setCrearOpen(true)}
                    className="flex min-h-[4.25rem] items-center justify-center gap-1.5 rounded-lg border border-dashed text-sm text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Plus className="h-4 w-4" />
                    Nueva subvención
                  </button>
                </div>
                {tarjetas.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    {buscando ? `Ninguna coincide con «${filtro}».` : `En ${anio} no hay ninguna.`}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                  <label htmlFor="imputar-pct">Imputar el</label>
                  <div className="relative w-20">
                    <Input
                      id="imputar-pct"
                      inputMode="decimal"
                      value={pct}
                      onChange={(e) => setPct(e.target.value.replace(/[^\d.,]/g, ""))}
                      className="h-8 pr-6 text-right tabular-nums"
                      aria-invalid={!pctValido}
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      %
                    </span>
                  </div>
                  <span className="text-muted-foreground">
                    {pctValido
                      ? "de cada uno, sin pasar de lo que le quede libre. Luego se ajusta cada parte en la subvención."
                      : "Tiene que estar entre 0 y 100."}
                  </span>
                </div>

                {reparto && (reparto.parciales > 0 || recortados > 0 || fuera > 0 || reparto.sinHueco.size > 0) && (
                  <div className="space-y-1 text-xs text-muted-foreground" aria-live="polite">
                    {reparto.parciales > 0 && (
                      <p>
                        {reparto.parciales} {reparto.parciales === 1 ? "ya está" : "ya están"} en parte en otra: entra
                        {reparto.parciales === 1 ? "" : "n"} por lo que queda libre.
                      </p>
                    )}
                    {recortados > 0 && (
                      <p>
                        {recortados} no {recortados === 1 ? "llega" : "llegan"} al {pct} % porque el resto está en otra.
                      </p>
                    )}
                    {[...reparto.sinHueco.entries()].map(([otraId, lista]) => (
                      <p key={otraId} className="text-amber-700 dark:text-amber-300">
                        {lista.length} {lista.length === 1 ? "está entero" : "están enteros"} en{" "}
                        <Link href={`/subvenciones/${otraId}`} className="font-medium underline underline-offset-2">
                          {nombrePorId.get(otraId) ?? "otra subvención"}
                        </Link>{" "}
                        y no {lista.length === 1 ? "cabe" : "caben"}.
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
              </section>
            )}

            <TablaMovimientos
              movimientos={movimientos}
              imputadoPorId={destino || hecho ? imputadoPorId : null}
              motivoPorId={motivoPorId}
            />
          </div>

          <DialogFooter className="border-t px-6 py-3">
            {hecho ? (
              <>
                <Button variant="ghost" onClick={deshacer} disabled={enviando} aria-busy={enviando}>
                  {enviando ? <LoadingSpinner size="sm" /> : <Undo2 className="h-4 w-4" />}
                  Deshacer
                </Button>
                <Button onClick={cerrar}>Cerrar</Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={cerrar} disabled={enviando}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleAsignar}
                  disabled={!destino || !items.length || !pctValido || enviando}
                  aria-busy={enviando}
                >
                  {enviando && <LoadingSpinner size="sm" />}
                  {items.length
                    ? `Imputar ${items.length} · ${formatCurrency(importeTotal)}`
                    : destino
                      ? "Nada que imputar"
                      : "Elige una subvención"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SubvencionFormDialog
        open={crearOpen}
        onOpenChange={setCrearOpen}
        onSaved={async (s) => {
          await invalidar()
          setDestinoId(s.id)
          if (s.ejercicio != null) setAnioElegido(s.ejercicio)
        }}
      />
    </>
  )
}

/**
 * Cada movimiento con su id, para pegarlo donde haga falta (la API, un Excel,
 * la hoja de la justificación). "Copiar ids" va uno por línea, que en Google
 * Sheets cae en una columna; "Copiar tabla" lleva además fecha, concepto e
 * importes, cada uno en su columna.
 */
function TablaMovimientos({
  movimientos,
  imputadoPorId,
  motivoPorId,
}: {
  movimientos: AsignarSubvencionDialogProps["movimientos"]
  /** null mientras no hay subvención elegida: no hay nada que enseñar en esa columna. */
  imputadoPorId: Map<string, number> | null
  motivoPorId: Map<string, string>
}) {
  const { copy, isCopied } = useClipboard()
  const ids = movimientos.map((m) => m.id).join("\n")
  const tabla = tablaParaHoja(
    movimientos.map((m) => ({
      id: m.id,
      fecha: m.fecha,
      concepto: m.concepto ?? null,
      importe: m.importe,
      imputado: imputadoPorId?.get(m.id) ?? null,
    })),
  )
  const copiar = async (texto: string, aviso: string) => {
    if (await copy(texto)) toast.success(aviso)
  }

  return (
    <section className="space-y-2" aria-labelledby="imputar-movimientos">
      <div className="flex flex-wrap items-center gap-2">
        <h3 id="imputar-movimientos" className="mr-auto text-sm font-medium">
          Los movimientos
        </h3>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => copiar(ids, `${movimientos.length} ids copiados, uno por línea`)}
        >
          {isCopied(ids) ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          Copiar ids
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-8"
          onClick={() => copiar(tabla, "Tabla copiada: pégala en Google Sheets")}
          title="Id, fecha, concepto, importe e imputado, cada uno en su columna"
        >
          {isCopied(tabla) ? <Check className="h-3.5 w-3.5" /> : <SheetIcon className="h-3.5 w-3.5" />}
          Copiar tabla para Sheets
        </Button>
      </div>

      <div className="max-h-72 overflow-y-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted text-[11px] uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-1.5 text-left font-medium">Fecha</th>
              <th className="px-3 py-1.5 text-left font-medium">Concepto</th>
              <th className="px-3 py-1.5 text-right font-medium">Importe</th>
              {imputadoPorId && <th className="px-3 py-1.5 text-right font-medium">Imputa</th>}
              <th className="px-3 py-1.5 text-left font-medium">Id</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {movimientos.map((m) => {
              const imp = imputadoPorId?.get(m.id)
              const motivo = motivoPorId.get(m.id)
              return (
                <tr key={m.id} className={cn(imputadoPorId && imp == null && "text-muted-foreground")}>
                  <td className="whitespace-nowrap px-3 py-1.5 tabular-nums">{formatDate(m.fecha)}</td>
                  <td className="max-w-[16rem] truncate px-3 py-1.5" title={m.concepto ?? undefined}>
                    {m.concepto || "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">{formatCurrency(m.importe)}</td>
                  {imputadoPorId && (
                    <td className="whitespace-nowrap px-3 py-1.5 text-right tabular-nums">
                      {imp != null ? formatCurrency(imp) : <span className="text-xs">{motivo ?? "—"}</span>}
                    </td>
                  )}
                  <td className="px-3 py-1">
                    <button
                      type="button"
                      onClick={() => copiar(m.id, "Id copiado")}
                      className="group inline-flex max-w-[11rem] items-center gap-1.5 rounded px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={`Copiar el id de ${m.concepto || "este movimiento"}`}
                      title={m.id}
                    >
                      <span className="truncate">{m.id}</span>
                      {isCopied(m.id) ? (
                        <Check className="h-3 w-3 shrink-0 text-emerald-600" />
                      ) : (
                        <Copy className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
                      )}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
