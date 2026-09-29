"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowLeftRight,
  CalendarRange,
  Check,
  Copy,
  Download,
  FileText,
  Landmark,
  Paperclip,
  Search,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorMessage } from "@/components/ui/error-message"
import { EntityAvatar } from "@/components/ui/entity-avatar"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useIsAdminState } from "@/hooks/use-is-admin"
import { useSubvencion } from "@/hooks/use-subvenciones"
import { useClipboard } from "@/hooks/use-clipboard"
import { SubvencionFicha } from "./subvencion-ficha"
import { AccionesSubvencion } from "./subvencion-sheet"
import { ImputacionEditor } from "./imputacion-editor"
import {
  actualizarImputacion,
  quitarMovimientos,
  restaurarImputaciones,
  type MovimientoDeSubvencion,
} from "@/lib/services/subvenciones"
import {
  FORMATOS_IDS,
  SUBVENCION_ESTADO_INFO,
  formatearIds,
  fueraDePeriodo,
  importeLibre,
  type FormatoIds,
} from "@/lib/utils/subvenciones"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { describirError } from "@/lib/utils/describir-error"
import { cn } from "@/lib/utils"

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

const TODAS = "__todas__"

export function SubvencionDetail({ id }: { id: string }) {
  const router = useRouter()
  const { isAdmin, loading: adminLoading } = useIsAdminState()
  const { subvencion, movimientos, loading, movimientosLoading, movimientosFetching, error, invalidar } =
    useSubvencion(id, { enabled: isAdmin })

  const [delegacion, setDelegacion] = useState<string>(TODAS)
  const [busqueda, setBusqueda] = useState("")
  const [seleccion, setSeleccion] = useState<Set<string>>(new Set())
  const [quitando, setQuitando] = useState(false)
  const { copy, copied } = useClipboard()

  const delegaciones = useMemo(() => {
    const porId = new Map<string, { id: string; nombre: string; n: number }>()
    for (const m of movimientos) {
      const actual = porId.get(m.delegacion_id)
      if (actual) actual.n++
      else porId.set(m.delegacion_id, { id: m.delegacion_id, nombre: m.delegacion?.nombre ?? "Sin nombre", n: 1 })
    }
    return [...porId.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es"))
  }, [movimientos])

  const visibles = useMemo(() => {
    const q = normalizar(busqueda.trim())
    return movimientos.filter((m) => {
      if (delegacion !== TODAS && m.delegacion_id !== delegacion) return false
      if (!q) return true
      return normalizar(
        [m.concepto, m.descripcion, m.contacto?.nombre, m.categoria?.nombre, m.id, ...m.otras.map((o) => o.nombre)]
          .filter(Boolean)
          .join(" "),
      ).includes(q)
    })
  }, [movimientos, delegacion, busqueda])

  // La selección solo tiene sentido sobre lo que se ve; lo que un filtro
  // esconde no se puede quitar sin querer.
  const seleccionVisible = useMemo(() => visibles.filter((m) => seleccion.has(m.id)), [visibles, seleccion])
  const todoVisibleMarcado = visibles.length > 0 && seleccionVisible.length === visibles.length
  const idsObjetivo = seleccionVisible.length ? seleccionVisible.map((m) => m.id) : visibles.map((m) => m.id)
  const fueraCount = subvencion ? movimientos.filter((m) => fueraDePeriodo(m.fecha, subvencion)).length : 0

  if (adminLoading) return <PageSkeleton />
  if (!isAdmin) {
    return (
      <EmptyState
        icon={<Landmark className="h-5 w-5" />}
        title="Solo para la oficina técnica"
        description="Las subvenciones las gestionan los gestores centrales."
      />
    )
  }
  if (loading) return <PageSkeleton rows={6} tabs={0} />
  if (error && !subvencion) {
    return <ErrorMessage message={describirError(error, "No se ha podido cargar la subvención")} />
  }
  if (!subvencion) {
    return (
      <EmptyState
        icon={<Landmark className="h-5 w-5" />}
        title="Esta subvención no existe"
        description="Puede que la haya borrado alguien de la oficina técnica."
      >
        <Button variant="outline" asChild>
          <Link href="/subvenciones">Volver a subvenciones</Link>
        </Button>
      </EmptyState>
    )
  }

  const info = SUBVENCION_ESTADO_INFO[subvencion.estado]

  const toggle = (movId: string) =>
    setSeleccion((prev) => {
      const next = new Set(prev)
      if (next.has(movId)) next.delete(movId)
      else next.add(movId)
      return next
    })

  const copiarIds = async (formato: FormatoIds) => {
    const ok = await copy(formatearIds(idsObjetivo, formato))
    if (ok) {
      toast.success(
        `${idsObjetivo.length} ${idsObjetivo.length === 1 ? "id copiado" : "ids copiados"} · ${FORMATOS_IDS[formato].label.toLowerCase()}`,
      )
    } else {
      toast.error("No se han podido copiar los ids. Prueba con Descargar Excel, que los lleva en la primera columna.")
    }
  }

  const handleQuitar = async () => {
    const ids = seleccionVisible.map((m) => m.id)
    if (!ids.length) return
    setQuitando(true)
    try {
      const quitadas = await quitarMovimientos(subvencion.id, ids)
      setSeleccion(new Set())
      await invalidar()
      // Ya reversible (la fila se puede volver a insertar tal cual): se
      // ejecuta al momento y "Deshacer" hace la contraria (design.md §3.6).
      toast.success(
        `${quitadas.length} ${quitadas.length === 1 ? "movimiento quitado" : "movimientos quitados"} de ${subvencion.nombre}`,
        {
          duration: 12000,
          action: quitadas.length
            ? {
                label: "Deshacer",
                onClick: () => {
                  restaurarImputaciones(quitadas)
                    .then(() => {
                      invalidar()
                      toast.success("Vuelven a estar en la subvención")
                    })
                    .catch((err) => toast.error(describirError(err, "No se han podido volver a imputar")))
                },
              }
            : undefined,
        },
      )
    } catch (err) {
      toast.error(describirError(err, "No se han podido quitar los movimientos"))
    } finally {
      setQuitando(false)
    }
  }

  const handleGuardarParte = async (m: MovimientoDeSubvencion, importe: number) => {
    try {
      const anterior = await actualizarImputacion(subvencion.id, m.id, importe)
      await invalidar()
      toast.success(`Parte de «${m.concepto}»: ${formatCurrency(importe)}`, {
        duration: 8000,
        action: {
          label: "Deshacer",
          onClick: () => {
            actualizarImputacion(subvencion.id, m.id, anterior)
              .then(() => invalidar())
              .catch((err) => toast.error(describirError(err, "No se ha podido deshacer")))
          },
        },
      })
    } catch (err) {
      toast.error(describirError(err, "No se ha podido cambiar la parte imputada"))
      throw err
    }
  }

  const handleExcel = async () => {
    try {
      const { exportarMovimientosSubvencion } = await import("@/lib/utils/subvenciones-excel")
      await exportarMovimientosSubvencion(subvencion, visibles)
    } catch (err) {
      toast.error(describirError(err, "No se ha podido generar el Excel"))
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="sr-only">{subvencion.codigo ? `${subvencion.codigo} · ${subvencion.nombre}` : subvencion.nombre}</h1>
      <Button variant="ghost" size="sm" asChild className="-ml-2 text-muted-foreground">
        <Link href={`/subvenciones${subvencion.ejercicio ? `?anio=${subvencion.ejercicio}` : ""}`}>
          <ArrowLeft className="h-4 w-4" />
          Subvenciones{subvencion.ejercicio ? ` ${subvencion.ejercicio}` : ""}
        </Link>
      </Button>

      {/* Dos paneles, como Facturas: la ficha a la izquierda (se edita en el
          sitio y se queda quieta al bajar) y los movimientos, que son una
          tabla ancha, a la derecha. En móvil, uno debajo del otro. */}
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)] 2xl:grid-cols-[minmax(0,30rem)_minmax(0,1fr)]">
        <aside
          aria-label="Ficha de la subvención"
          className="relative rounded-xl border bg-card p-5 pt-6 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6rem)] lg:overflow-y-auto lg:overscroll-contain"
        >
          {/* Franja con el color del estado: se reconoce de un vistazo en qué punto está. */}
          <div className={cn("absolute inset-x-0 top-0 h-1 rounded-t-xl", info.dotClass)} aria-hidden />
          <SubvencionFicha
            subvencion={subvencion}
            mostrarEnlaceMovimientos={false}
            acciones={<AccionesSubvencion subvencion={subvencion} onBorrada={() => router.push("/subvenciones")} />}
          />
          {fueraCount > 0 && (
            <p className="mt-4 flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300">
              <CalendarRange className="h-3.5 w-3.5 shrink-0" />
              {fueraCount} {fueraCount === 1 ? "movimiento cae" : "movimientos caen"} fuera del periodo de gastos.
            </p>
          )}
        </aside>

        <section className="min-w-0 space-y-3" aria-labelledby="sv-movimientos">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <h2 id="sv-movimientos" className="shrink-0 text-lg font-semibold">
              Movimientos imputados
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link href="/transacciones">
                  <ArrowLeftRight className="h-4 w-4" />
                  Añadir desde Movimientos
                </Link>
              </Button>
              <CopiarIdsButton
                cuantos={idsObjetivo.length}
                deSeleccion={seleccionVisible.length > 0}
                copiado={copied !== null}
                onCopiar={copiarIds}
              />
              <Button variant="outline" size="sm" onClick={handleExcel} disabled={!visibles.length}>
                <Download className="h-4 w-4" />
                Descargar Excel
              </Button>
            </div>
          </div>

          {movimientos.length > 0 && (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {delegaciones.length > 1 && (
                <Select value={delegacion} onValueChange={setDelegacion}>
                  <SelectTrigger className="sm:w-64" aria-label="Filtrar por delegación">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={TODAS}>Todas las delegaciones ({movimientos.length})</SelectItem>
                    {delegaciones.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nombre} ({d.n})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="relative sm:w-80">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar concepto, proveedor, id…"
                  className="pl-8"
                  aria-label="Buscar en los movimientos de la subvención"
                />
              </div>
            </div>
          )}

          {seleccionVisible.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm">
              <span className="font-medium" aria-live="polite">
                {seleccionVisible.length} {seleccionVisible.length === 1 ? "seleccionado" : "seleccionados"} ·{" "}
                {formatCurrency(seleccionVisible.reduce((acc, m) => acc + m.importe_imputado, 0))}
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="destructiveGhost"
                  size="sm"
                  onClick={handleQuitar}
                  disabled={quitando}
                  aria-busy={quitando}
                >
                  {quitando ? <LoadingSpinner size="sm" /> : <X className="h-4 w-4" />}
                  Quitar de la subvención
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setSeleccion(new Set())}>
                  Limpiar selección
                </Button>
              </div>
            </div>
          )}

          {movimientosLoading ? (
            <PageSkeleton rows={5} tabs={0} />
          ) : movimientos.length === 0 ? (
            <EmptyState
              icon={<ArrowLeftRight className="h-5 w-5" />}
              title="Todavía no tiene movimientos"
              description="Ve a Movimientos, elige una delegación, selecciona los gastos que justifica y pulsa «Subvención». Puedes repetirlo con cada delegación."
            >
              <Button asChild>
                <Link href="/transacciones">Ir a Movimientos</Link>
              </Button>
            </EmptyState>
          ) : visibles.length === 0 ? (
            <EmptyState title="Ningún movimiento coincide" description="Prueba con otra búsqueda o con todas las delegaciones.">
              <Button
                variant="outline"
                onClick={() => {
                  setBusqueda("")
                  setDelegacion(TODAS)
                }}
              >
                Quitar los filtros
              </Button>
            </EmptyState>
          ) : (
            <div className={cn("space-y-1.5 transition-opacity", movimientosFetching && "opacity-60")}>
              <div className="flex items-center gap-3 px-3 text-xs text-muted-foreground">
                <Checkbox
                  checked={todoVisibleMarcado ? true : seleccionVisible.length ? "indeterminate" : false}
                  onCheckedChange={() =>
                    setSeleccion(todoVisibleMarcado ? new Set() : new Set(visibles.map((m) => m.id)))
                  }
                  aria-label="Seleccionar todos los movimientos visibles"
                />
                <span>
                  {visibles.length} de {movimientos.length} · {formatCurrency(visibles.reduce((a, m) => a + m.importe_imputado, 0))} imputados
                </span>
              </div>
              {visibles.map((m) => (
                <MovimientoFila
                  key={m.id}
                  movimiento={m}
                  seleccionado={seleccion.has(m.id)}
                  onToggle={() => toggle(m.id)}
                  fuera={fueraDePeriodo(m.fecha, subvencion)}
                  subvencionId={subvencion.id}
                  onGuardarParte={(importe) => handleGuardarParte(m, importe)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------

function CopiarIdsButton({
  cuantos,
  deSeleccion,
  copiado,
  onCopiar,
}: {
  cuantos: number
  deSeleccion: boolean
  copiado: boolean
  onCopiar: (formato: FormatoIds) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={!cuantos}>
          {copiado ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
          Copiar {cuantos} {cuantos === 1 ? "id" : "ids"}
          {deSeleccion && <span className="text-muted-foreground">(selección)</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-1">
        {(Object.keys(FORMATOS_IDS) as FormatoIds[]).map((f) => (
          <button
            key={f}
            type="button"
            className="flex w-full flex-col items-start rounded-md px-3 py-2 text-left hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
            onClick={() => {
              setOpen(false)
              onCopiar(f)
            }}
          >
            <span className="text-sm font-medium">{FORMATOS_IDS[f].label}</span>
            <span className="text-xs text-muted-foreground">{FORMATOS_IDS[f].descripcion}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

function MovimientoFila({
  movimiento: m,
  seleccionado,
  onToggle,
  fuera,
  subvencionId,
  onGuardarParte,
}: {
  movimiento: MovimientoDeSubvencion
  seleccionado: boolean
  onToggle: () => void
  fuera: boolean
  subvencionId: string
  onGuardarParte: (importe: number) => Promise<void>
}) {
  const total = Math.abs(m.importe)
  const libre = importeLibre(
    m.importe,
    m.otras.map((o) => ({ movimiento_id: m.id, subvencion_id: o.subvencion_id, importe_imputado: o.importe_imputado })),
    subvencionId,
  )
  const repartido = m.otras.length > 0
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-border/50 bg-card px-3 py-2 text-sm",
        seleccionado && "border-primary/60 bg-primary/5 ring-1 ring-primary/40",
      )}
    >
      <Checkbox checked={seleccionado} onCheckedChange={onToggle} aria-label={`Seleccionar ${m.concepto}`} />
      <EntityAvatar
        name={m.contacto?.nombre ?? m.concepto}
        logoUrl={m.contacto?.logo_url ?? undefined}
        size="sm"
        className="hidden sm:flex"
      />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-medium">{m.concepto}</span>
          {fuera && (
            <span
              className="inline-flex shrink-0 items-center gap-1 text-xs text-amber-700 dark:text-amber-300"
              title="La fecha cae fuera del periodo de gastos de la subvención"
            >
              <CalendarRange className="h-3 w-3" />
              Fuera de periodo
            </span>
          )}
        </div>
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
          <span className="tabular-nums">{formatDate(m.fecha)}</span>
          <span>·</span>
          <span className="font-medium text-foreground/80">{m.delegacion?.nombre ?? "—"}</span>
          {m.contacto && (
            <>
              <span>·</span>
              <span className="truncate">{m.contacto.nombre}</span>
            </>
          )}
          {m.categoria && (
            <>
              <span>·</span>
              <span className="truncate">{m.categoria.nombre}</span>
            </>
          )}
        </div>
        {repartido && (
          <div className="mt-1 flex min-w-0 items-center gap-2">
            {/* Cómo se reparte el movimiento: esta subvención, las demás y lo libre. */}
            <div className="flex h-1.5 w-20 shrink-0 overflow-hidden rounded-full bg-muted" aria-hidden>
              <div className="bg-primary" style={{ width: `${(m.importe_imputado / total) * 100}%` }} />
              <div className="bg-muted-foreground/40" style={{ width: `${((total - libre) / total) * 100}%` }} />
            </div>
            <span className="truncate text-[11px] text-muted-foreground">
              También en{" "}
              {m.otras.map((o, i) => (
                <span key={o.subvencion_id}>
                  {i > 0 && ", "}
                  <Link href={`/subvenciones/${o.subvencion_id}`} className="underline-offset-2 hover:underline">
                    {o.nombre}
                  </Link>{" "}
                  <span className="tabular-nums">({formatCurrency(o.importe_imputado)})</span>
                </span>
              ))}
            </span>
          </div>
        )}
      </div>
      <div className="hidden shrink-0 items-center gap-2 text-xs text-muted-foreground sm:flex">
        {m.factura_id ? (
          <span className="inline-flex items-center gap-1" title="Tiene factura vinculada">
            <FileText className="h-3.5 w-3.5" />
            Factura
          </span>
        ) : m.factura_pendiente ? (
          <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300" title="Marcado como falta factura">
            <AlertTriangle className="h-3.5 w-3.5" />
            Falta factura
          </span>
        ) : null}
        {m.archivos > 0 && (
          <span className="inline-flex items-center gap-1" title={`${m.archivos} archivos adjuntos`}>
            <Paperclip className="h-3.5 w-3.5" />
            {m.archivos}
          </span>
        )}
      </div>
      <div className="shrink-0">
        <ImputacionEditor
          importeMovimiento={m.importe}
          imputado={m.importe_imputado}
          libre={libre}
          concepto={m.concepto}
          onGuardar={onGuardarParte}
        />
      </div>
    </div>
  )
}
