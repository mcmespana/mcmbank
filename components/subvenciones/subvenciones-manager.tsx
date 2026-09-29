"use client"

import { useCallback, useMemo, useState, type ReactNode } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { AlarmClock, CalendarClock, Check, Landmark, Plus, Repeat, Search, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { FilterTabs } from "@/components/ui/filter-tabs"
import { ListHeaderRow, ListRow } from "@/components/ui/list-row"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorMessage } from "@/components/ui/error-message"
import { useIsAdminState } from "@/hooks/use-is-admin"
import { useSubvenciones } from "@/hooks/use-subvenciones"
import { useGuardarSubvencion } from "@/hooks/use-guardar-subvencion"
import { SubvencionFormDialog } from "./subvencion-form-dialog"
import { SubvencionSheet } from "./subvencion-sheet"
import { EstadoInline, ImporteInline } from "./campos-inline"
import {
  FINANCIADOR_AMBITO_INFO,
  PLAZO_CERCA_CLASS,
  PLAZO_CERCA_DIAS,
  SUBVENCION_ESTADO_INFO,
  agruparPorAmbito,
  cuandoEs,
  diasHasta,
  importeCobrado,
  porcentajeImputado,
  proximaFecha,
  recuentoPorEstado,
  totalesEjercicio,
} from "@/lib/utils/subvenciones"
import { formatCurrency, formatDate, toLocalDateString } from "@/lib/utils/format"
import { describirError } from "@/lib/utils/describir-error"
import { cn } from "@/lib/utils"
import type {
  FinanciadorAmbito,
  SubvencionConResumen,
  SubvencionEstado,
  SubvencionUpdate,
} from "@/lib/types/database"

/**
 * Una pestaña por ejercicio, y "Para estudiar" (sin ejercicio) solo si hay
 * alguna. Nunca todos los años juntos: se trabaja año a año, como en el Excel,
 * y mezclarlos haría que los totales no significaran nada.
 */
const PARA_ESTUDIAR = "estudiar"

const pestanaDe = (s: SubvencionConResumen) => (s.ejercicio == null ? PARA_ESTUDIAR : String(s.ejercicio))

function normalizar(t: string) {
  return t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
}

function coincide(s: SubvencionConResumen, q: string) {
  if (!q) return true
  return normalizar(
    [s.codigo, s.nombre, s.financiador?.nombre, s.solicitante, s.convocatoria, s.expediente, s.notas]
      .filter(Boolean)
      .join(" "),
  ).includes(q)
}

/**
 * Columnas de la fila en escritorio. Por debajo de `2xl` no cabe la de lo
 * imputado y pasa a la línea de debajo del nombre; por debajo de `lg` la fila
 * se apila (nombre y estado arriba, los tres importes debajo).
 */
const COLUMNAS =
  "lg:grid-cols-[minmax(0,1fr)_9.5rem_repeat(3,8rem)] 2xl:grid-cols-[minmax(0,1fr)_10rem_repeat(3,8rem)_7rem]"

export function SubvencionesManager() {
  const { isAdmin, loading: adminLoading } = useIsAdminState()
  const { subvenciones, loading, error, invalidar } = useSubvenciones({ enabled: isAdmin })
  const [busqueda, setBusqueda] = useState("")
  const [estados, setEstados] = useState<Set<SubvencionEstado>>(() => new Set())
  const [crearOpen, setCrearOpen] = useState(false)

  // El año y la subvención abierta viven en la URL (`?anio=2026&s=<id>`):
  // volver desde la página de una subvención deja el año donde estaba, y una
  // ficha abierta se puede pasar por enlace. Se escribe con `history`, que
  // Next sincroniza con `useSearchParams` sin navegar ni pedir nada al servidor.
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const anioUrl = searchParams.get("anio")
  const abiertaId = searchParams.get("s")
  const cambiarUrl = useCallback(
    (cambios: Record<string, string | null>) => {
      const p = new URLSearchParams(window.location.search)
      for (const [k, v] of Object.entries(cambios)) {
        if (v == null) p.delete(k)
        else p.set(k, v)
      }
      const qs = p.toString()
      window.history.replaceState(null, "", qs ? `${pathname}?${qs}` : pathname)
    },
    [pathname],
  )

  // Como el Excel: un bloque por año, el más reciente primero.
  const ejercicios = useMemo(
    () => [...new Set(subvenciones.map((s) => s.ejercicio).filter((e): e is number => e != null))].sort((a, b) => b - a),
    [subvenciones],
  )
  const hayParaEstudiar = subvenciones.some((s) => s.ejercicio == null)
  const anioActual = new Date().getFullYear()
  const abierta = abiertaId ? (subvenciones.find((s) => s.id === abiertaId) ?? null) : null
  const pestanaValida = (p: string | null): p is string =>
    p != null && (p === PARA_ESTUDIAR ? hayParaEstudiar : ejercicios.includes(Number(p)))
  const pestana = pestanaValida(anioUrl)
    ? anioUrl
    : abierta
      ? pestanaDe(abierta)
      : ejercicios.includes(anioActual)
        ? String(anioActual)
        : ejercicios[0]
          ? String(ejercicios[0])
          : hayParaEstudiar
            ? PARA_ESTUDIAR
            : String(anioActual)

  const cambiarPestana = (p: string) => {
    // Los estados elegidos en un año no tienen por qué existir en otro: se
    // empezaría viendo una lista vacía sin saber por qué.
    setEstados(new Set())
    cambiarUrl({ anio: p })
  }
  const abrir = useCallback(
    (id: string | null, anio?: string) => cambiarUrl(anio ? { s: id, anio } : { s: id }),
    [cambiarUrl],
  )

  const delAnio = useMemo(() => subvenciones.filter((s) => pestanaDe(s) === pestana), [subvenciones, pestana])
  const q = normalizar(busqueda.trim())
  const visibles = useMemo(
    () => delAnio.filter((s) => coincide(s, q) && (estados.size === 0 || estados.has(s.estado))),
    [delAnio, q, estados],
  )
  // Si se busca algo que está en otro año, se dice dónde, sin mezclar años.
  const enOtrosAnios = useMemo(() => {
    if (!q) return []
    const cuenta = new Map<string, number>()
    for (const s of subvenciones) {
      const p = pestanaDe(s)
      if (p !== pestana && coincide(s, q)) cuenta.set(p, (cuenta.get(p) ?? 0) + 1)
    }
    return [...cuenta.entries()].sort((a, b) => b[0].localeCompare(a[0]))
  }, [subvenciones, pestana, q])

  const grupos = useMemo(() => agruparPorAmbito(visibles), [visibles])
  const orden = useMemo(() => grupos.flatMap((g) => g.subvenciones.map((s) => s.id)), [grupos])
  const hoy = toLocalDateString(new Date())

  if (adminLoading) return <PageSkeleton />
  if (!isAdmin) {
    return (
      <EmptyState
        icon={<Landmark className="h-5 w-5" />}
        title="Solo para la oficina técnica"
        description="Las subvenciones las gestionan los gestores centrales. Si necesitas verlas, pídeselo a la oficina técnica."
      />
    )
  }

  const tabs = [
    ...ejercicios.map((e) => ({
      value: String(e),
      label: String(e),
      count: subvenciones.filter((s) => s.ejercicio === e).length,
    })),
    ...(hayParaEstudiar
      ? [{ value: PARA_ESTUDIAR, label: "Para estudiar", count: subvenciones.filter((s) => s.ejercicio == null).length }]
      : []),
  ]
  const etiquetaPestana = tabs.find((t) => t.value === pestana)?.label ?? pestana
  const esAnio = /^\d{4}$/.test(pestana)
  const filtrando = Boolean(q) || estados.size > 0
  const confirmadoVisible = filtrando ? totalesEjercicio(visibles).confirmado : 0
  const quitarFiltros = () => {
    setBusqueda("")
    setEstados(new Set())
  }
  const alternarEstado = (e: SubvencionEstado) =>
    setEstados((prev) => {
      const next = new Set(prev)
      if (next.has(e)) next.delete(e)
      else next.add(e)
      return next
    })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Subvenciones"
        actions={
          <Button onClick={() => setCrearOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva subvención
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <FilterTabs value={pestana} onValueChange={cambiarPestana} items={tabs} />
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar código, financiador, nombre…"
            className="pl-8"
            aria-label="Buscar subvenciones"
          />
        </div>
      </div>

      {error ? (
        <ErrorMessage message={describirError(error, "No se han podido cargar las subvenciones")} />
      ) : loading ? (
        <PageSkeleton rows={5} tabs={0} />
      ) : subvenciones.length === 0 ? (
        <EmptyState
          icon={<Landmark className="h-5 w-5" />}
          title="Aún no hay subvenciones"
          description="Crea la primera y después, desde Movimientos, selecciona los gastos de cualquier delegación e imputáselos."
        >
          <Button onClick={() => setCrearOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva subvención
          </Button>
        </EmptyState>
      ) : (
        <>
          {delAnio.length > 0 && (
            <ResumenDelAnio
              subvenciones={delAnio}
              etiqueta={etiquetaPestana}
              conDinero={pestana !== PARA_ESTUDIAR}
              estados={estados}
              onAlternarEstado={alternarEstado}
              onQuitarEstados={() => setEstados(new Set())}
            />
          )}

          {visibles.length === 0 ? (
            <EmptyState
              title="Ninguna subvención coincide"
              description={
                busqueda
                  ? `Nada con «${busqueda}» en «${etiquetaPestana}»${estados.size ? " con esos estados" : ""}.`
                  : estados.size
                    ? `Ninguna de «${etiquetaPestana}» está en esos estados.`
                    : `No hay ninguna en «${etiquetaPestana}».`
              }
            >
              <div className="flex flex-wrap justify-center gap-2">
                {filtrando && (
                  <Button variant="outline" onClick={quitarFiltros}>
                    Quitar los filtros
                  </Button>
                )}
                {enOtrosAnios.map(([p, n]) => (
                  <Button key={p} variant="outline" onClick={() => cambiarPestana(p)}>
                    {n} en {p === PARA_ESTUDIAR ? "Para estudiar" : p}
                  </Button>
                ))}
              </div>
            </EmptyState>
          ) : (
            <div className="space-y-2">
              {filtrando && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 pb-1 text-sm text-muted-foreground" aria-live="polite">
                  <span>
                    <span className="font-medium text-foreground tabular-nums">{visibles.length}</span> de{" "}
                    <span className="tabular-nums">{delAnio.length}</span>
                    {esAnio && confirmadoVisible > 0 && <> · {formatCurrency(confirmadoVisible)} confirmados</>}
                  </span>
                  {enOtrosAnios.length > 0 && (
                    <span className="flex flex-wrap items-center gap-1">
                      · también en
                      {enOtrosAnios.map(([p, n]) => (
                        <Button
                          key={p}
                          variant="link"
                          size="sm"
                          className="h-auto p-0 text-sm"
                          onClick={() => cambiarPestana(p)}
                        >
                          {p === PARA_ESTUDIAR ? "Para estudiar" : p} ({n})
                        </Button>
                      ))}
                    </span>
                  )}
                  <Button variant="ghost" size="sm" className="ml-auto h-7" onClick={quitarFiltros}>
                    <X className="h-3.5 w-3.5" />
                    Quitar filtros
                  </Button>
                </div>
              )}

              <ListHeaderRow className={cn("gap-x-3 border-x border-l-4 border-transparent", COLUMNAS)}>
                <span>Subvención</span>
                <span>Estado</span>
                <span className="pr-[1.125rem] text-right">Solicitado</span>
                <span className="pr-[1.125rem] text-right">Concedido</span>
                <span className="pr-[1.125rem] text-right">Cobrado</span>
                <span className="hidden text-right 2xl:block">Imputado</span>
              </ListHeaderRow>

              <div className="space-y-4">
                {grupos.map((g) => (
                  <section key={g.ambito} aria-labelledby={`grupo-${g.ambito}`} className="space-y-1.5">
                    <CabeceraGrupo
                      id={`grupo-${g.ambito}`}
                      ambito={g.ambito}
                      label={g.label}
                      subvenciones={g.subvenciones}
                      conDinero={esAnio}
                    />
                    {g.subvenciones.map((s) => (
                      <SubvencionRow
                        key={s.id}
                        subvencion={s}
                        hoy={hoy}
                        abierta={s.id === abierta?.id}
                        onAbrir={() => abrir(s.id)}
                      />
                    ))}
                  </section>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <SubvencionSheet subvencion={abierta} orden={orden} onAbrir={abrir} />

      <SubvencionFormDialog
        open={crearOpen}
        onOpenChange={setCrearOpen}
        plantilla={esAnio ? { ejercicio: Number(pestana) } : pestana === PARA_ESTUDIAR ? { ejercicio: null } : null}
        onSaved={async (s) => {
          // Se espera a la lista para abrirla ya con sus datos: abrir un id que
          // la lista aún no tiene cerraría la hoja un instante.
          await invalidar()
          abrir(s.id, s.ejercicio == null ? PARA_ESTUDIAR : String(s.ejercicio))
        }}
      />
    </div>
  )
}

// ---------------------------------------------------------------------------
// El año de un vistazo
// ---------------------------------------------------------------------------

/**
 * Arriba de la lista, lo que se preguntaría del año: cuánto dinero hay
 * confirmado y cuánto ha entrado ya, y en qué punto está cada subvención.
 * Los estados son además el filtro: se pulsan para ver solo esas.
 */
function ResumenDelAnio({
  subvenciones,
  etiqueta,
  conDinero,
  estados,
  onAlternarEstado,
  onQuitarEstados,
}: {
  subvenciones: SubvencionConResumen[]
  etiqueta: string
  conDinero: boolean
  estados: Set<SubvencionEstado>
  onAlternarEstado: (e: SubvencionEstado) => void
  onQuitarEstados: () => void
}) {
  const totales = totalesEjercicio(subvenciones)
  const recuento = recuentoPorEstado(subvenciones)
  const tope = Math.max(totales.solicitado, totales.confirmado, 1)
  const pct = (n: number) => `${(n / tope) * 100}%`
  const cobrada = SUBVENCION_ESTADO_INFO.cobrada
  const concedida = SUBVENCION_ESTADO_INFO.concedida

  return (
    <section
      aria-label={`Resumen de ${etiqueta}`}
      className={cn(
        "grid gap-x-8 gap-y-5 rounded-xl border bg-card p-4 shadow-sm sm:p-5",
        conDinero && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]",
      )}
    >
      {conDinero && (
        <div className="min-w-0 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground">Confirmado {etiqueta}</p>
            <p className="text-2xl font-semibold tabular-nums tracking-tight">{formatCurrency(totales.confirmado)}</p>
          </div>
          {/* Una barra: lo cobrado, lo que falta por cobrar de lo confirmado, y de fondo el máximo posible. */}
          <div
            className="flex h-2.5 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`Cobrado ${formatCurrency(totales.cobrado)}, por cobrar ${formatCurrency(totales.porCobrar)}, máximo posible ${formatCurrency(totales.solicitado)}`}
          >
            <div className={cn("h-full", cobrada.dotClass)} style={{ width: pct(totales.cobrado) }} />
            <div className={cn("h-full opacity-80", concedida.dotClass)} style={{ width: pct(totales.porCobrar) }} />
          </div>
          <dl className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm">
            <Cifra punto={cobrada.dotClass} label="Cobrado" valor={totales.cobrado} />
            <Cifra punto={concedida.dotClass} label="Por cobrar" valor={totales.porCobrar} />
            <Cifra
              punto="bg-muted ring-1 ring-inset ring-border"
              label="Máximo posible"
              valor={totales.solicitado}
              ayuda="Lo solicitado en lo que sigue vivo (sin rechazadas ni renuncias)"
            />
          </dl>
        </div>
      )}

      <div className="min-w-0 space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            <span className="tabular-nums">{subvenciones.length}</span>{" "}
            {subvenciones.length === 1 ? "subvención" : "subvenciones"} · pulsa un estado para ver solo esas
          </p>
          {estados.size > 0 && (
            <button
              type="button"
              onClick={onQuitarEstados}
              className="shrink-0 rounded text-xs font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Ver todas
            </button>
          )}
        </div>
        <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full" aria-hidden>
          {recuento.map(({ estado, n }) => (
            <div
              key={estado}
              className={cn(
                "h-full transition-opacity duration-150",
                SUBVENCION_ESTADO_INFO[estado].dotClass,
                estados.size > 0 && !estados.has(estado) && "opacity-25",
              )}
              style={{ flexGrow: n, flexBasis: 0 }}
            />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por estado">
          {recuento.map(({ estado, n }) => {
            const info = SUBVENCION_ESTADO_INFO[estado]
            const activo = estados.has(estado)
            return (
              <button
                key={estado}
                type="button"
                aria-pressed={activo}
                onClick={() => onAlternarEstado(estado)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  activo
                    ? cn(info.bgClass, info.textClass, info.borderClass, "shadow-sm")
                    : "border-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <span className={cn("h-2 w-2 shrink-0 rounded-full", info.dotClass)} aria-hidden />
                {info.label}
                <span className="tabular-nums opacity-70">{n}</span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function Cifra({ punto, label, valor, ayuda }: { punto: string; label: string; valor: number; ayuda?: string }) {
  return (
    <div className="flex items-center gap-1.5" title={ayuda}>
      <span className={cn("h-2 w-2 shrink-0 rounded-full", punto)} aria-hidden />
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium tabular-nums">{formatCurrency(valor)}</dd>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Cabecera de cada grupo (Generalitat, Diputaciones…)
// ---------------------------------------------------------------------------

/**
 * El nombre del grupo y, en escritorio, sus subtotales debajo de cada columna
 * de importes, como las filas de total del Excel. Con una sola subvención no
 * se ponen: repetirían la fila de debajo.
 */
function CabeceraGrupo({
  id,
  ambito,
  label,
  subvenciones,
  conDinero,
}: {
  id: string
  ambito: FinanciadorAmbito
  label: string
  subvenciones: SubvencionConResumen[]
  conDinero: boolean
}) {
  const Icono = FINANCIADOR_AMBITO_INFO[ambito].icon
  const t = totalesEjercicio(subvenciones)
  const subtotales = conDinero && subvenciones.length > 1
  const subtotal = (valor: number, ayuda: string) => (
    <span className="hidden pr-[1.125rem] text-right tabular-nums lg:block" title={ayuda}>
      {valor > 0 ? formatCurrency(valor) : ""}
    </span>
  )

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)] items-end gap-x-3 border-x border-l-4 border-transparent px-3 pt-2 text-xs text-muted-foreground",
        COLUMNAS,
      )}
    >
      <h2 id={id} className="flex min-w-0 items-center gap-2 font-semibold uppercase tracking-wide">
        <Icono className="h-3.5 w-3.5 shrink-0" aria-hidden />
        <span className="truncate">{label}</span>
        <span className="font-normal normal-case tracking-normal tabular-nums">{subvenciones.length}</span>
      </h2>
      {subtotales && (
        <>
          <span className="hidden lg:block" />
          {subtotal(t.solicitado, `Solicitado en ${label}, sin rechazadas ni renuncias`)}
          {subtotal(t.confirmado, `Confirmado en ${label}`)}
          {subtotal(t.cobrado, `Cobrado en ${label}`)}
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Una fila
// ---------------------------------------------------------------------------

/**
 * La fila se abre pulsando en cualquier sitio (el nombre es un botón cuyo
 * `::after` cubre la fila entera), y el estado y los importes se cambian ahí
 * mismo, sin abrir nada: van por encima de esa capa con `relative z-10`. Así
 * no hay botones metidos dentro de otro botón, que el lector de pantalla no
 * sabría anunciar.
 */
function SubvencionRow({
  subvencion: s,
  hoy,
  abierta,
  onAbrir,
}: {
  subvencion: SubvencionConResumen
  hoy: string
  abierta: boolean
  onAbrir: () => void
}) {
  const guardar = useGuardarSubvencion()
  const info = SUBVENCION_ESTADO_INFO[s.estado]
  const descartada = info.fase === "descartada"
  const fecha = proximaFecha(s, hoy)
  const cerca = fecha ? diasHasta(fecha.fecha, hoy) <= PLAZO_CERCA_DIAS : false
  const cobrado = importeCobrado(s)
  const pctImp = porcentajeImputado(s.resumen.total_gastos, s.importe_concedido)
  const nombreCorto = s.codigo || s.nombre
  const g = (cambios: SubvencionUpdate, aviso: string) => guardar(s, cambios, { aviso })

  const importe = (
    label: string,
    campo: "importe_solicitado" | "importe_concedido" | "importe_cobrado",
    vacio: ReactNode = "—",
  ) => (
    <Celda label={label}>
      <ImporteInline
        valor={s[campo]}
        vacio={vacio}
        className="relative z-10"
        etiqueta={`${label} de ${nombreCorto}`}
        onGuardar={(v) =>
          g({ [campo]: v } as SubvencionUpdate, `${label} de ${nombreCorto}: ${v != null ? formatCurrency(v) : "sin importe"}`)
        }
      />
    </Celda>
  )

  return (
    <ListRow
      accentClass={info.accentClass}
      selected={abierta}
      className={cn(
        "relative py-2.5",
        // Sin `hover:border-border`: repintaría también la banda del estado.
        !abierta && "hover:bg-muted/40 hover:shadow-md",
        descartada && !abierta && "bg-muted/30",
      )}
    >
      <div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2.5 lg:items-center", COLUMNAS)}>
        <div className="min-w-0 space-y-0.5">
          <div className="flex min-w-0 items-center gap-2">
            {s.codigo && (
              <span className="shrink-0 rounded border bg-muted/50 px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground/80">
                {s.codigo}
              </span>
            )}
            <button
              type="button"
              onClick={onAbrir}
              aria-haspopup="dialog"
              className={cn(
                // En móvil el nombre baja de línea en vez de cortarse: al lado está el estado y no queda sitio.
                "min-w-0 break-words text-left font-medium text-foreground after:absolute lg:truncate after:inset-0 after:rounded-lg focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring",
                descartada && "text-muted-foreground",
              )}
            >
              {s.nombre}
            </button>
            {s.recurrente && <Repeat className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-label="Sale cada año" />}
          </div>
          <p className="flex min-w-0 flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
            <span className="truncate">{[s.financiador?.nombre, s.solicitante].filter(Boolean).join(" · ")}</span>
            {fecha && (
              <span className={cn("inline-flex items-center gap-1 whitespace-nowrap", cerca && cn("font-medium", PLAZO_CERCA_CLASS))}>
                <span aria-hidden>·</span>
                {cerca ? <AlarmClock className="h-3.5 w-3.5" aria-hidden /> : <CalendarClock className="h-3.5 w-3.5" aria-hidden />}
                {fecha.etiqueta} {formatDate(fecha.fecha)}, {cuandoEs(fecha.fecha, hoy)}
              </span>
            )}
            {s.resumen.movimientos > 0 && (
              <span className="whitespace-nowrap 2xl:hidden">
                · {s.resumen.movimientos} mov. imputados ({formatCurrency(s.resumen.total_gastos)})
              </span>
            )}
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-1 justify-self-end lg:justify-self-start">
          <EstadoInline
            estado={s.estado}
            tamano="md"
            etiqueta={`Estado de ${nombreCorto}`}
            onGuardar={(e) => g({ estado: e }, `${nombreCorto}: ${SUBVENCION_ESTADO_INFO[e].label}`)}
          />
          {s.justificacion_completa && (
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-label="Justificación completa" />
          )}
        </div>

        <div className="col-span-2 grid grid-cols-3 gap-x-3 lg:contents">
          {importe("Solicitado", "importe_solicitado")}
          {importe("Concedido", "importe_concedido")}
          {importe(
            "Cobrado",
            "importe_cobrado",
            // Cobrada sin cifra apuntada: cuenta lo concedido, y se ve en gris.
            cobrado > 0 ? <span title="Está cobrada y no se apuntó cuánto: cuenta lo concedido">{formatCurrency(cobrado)}</span> : "—",
          )}
          <div className="hidden text-right tabular-nums 2xl:block">
            {s.resumen.movimientos > 0 ? (
              <>
                <div className="text-sm font-medium">{formatCurrency(s.resumen.total_gastos)}</div>
                <div className="text-[11px] text-muted-foreground">
                  {s.resumen.movimientos} mov.{pctImp != null ? ` · ${pctImp.toLocaleString("es-ES")} %` : ""}
                </div>
              </>
            ) : (
              <span className="text-sm text-muted-foreground">—</span>
            )}
          </div>
        </div>
      </div>
    </ListRow>
  )
}

/**
 * El importe va suelto dentro de la celda, sin envoltorio: el botón lleva
 * `-mx-1.5` y `max-w-full`, y metido en una caja que encoge a su contenido el
 * `max-w-full` se queda 12 px corto y recorta la cifra ("15.000,0…").
 */
function Celda({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col items-start lg:items-end">
      <div className="text-[11px] text-muted-foreground lg:hidden">{label}</div>
      {children}
    </div>
  )
}
