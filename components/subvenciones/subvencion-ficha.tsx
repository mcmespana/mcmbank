"use client"

import { useState, type ReactNode } from "react"
import Link from "next/link"
import {
  ArrowRight,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  Circle,
  ExternalLink,
  Plus,
  Repeat,
  Trash2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { FinanciadorSelector } from "./financiador-selector"
import {
  EnlaceInline,
  EstadoInline,
  FechaInline,
  ImporteInline,
  NotasInline,
  TextoInline,
} from "./campos-inline"
import { useGuardarSubvencion } from "@/hooks/use-guardar-subvencion"
import {
  HITOS,
  SUBVENCION_CAMINO,
  SUBVENCION_ESTADO_INFO,
  cuandoEs,
  importeCobrado,
  porcentajeImputado,
  proximaFecha,
} from "@/lib/utils/subvenciones"
import { formatCurrency, formatDate, toLocalDateString } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { SubvencionConResumen, SubvencionEnlace, SubvencionEstado, SubvencionUpdate } from "@/lib/types/database"

interface SubvencionFichaProps {
  subvencion: SubvencionConResumen
  /** Dentro de la hoja lateral: los desplegables necesitan z-[80]. */
  enCapa?: boolean
  /** Menú de acciones (repetir, borrar…) que pone quien la monta. */
  acciones?: ReactNode
  /** Enlace a los movimientos imputados; en la propia página de detalle no hace falta. */
  mostrarEnlaceMovimientos?: boolean
}

/**
 * La ficha de una subvención, **editable en el sitio**: cada dato se cambia
 * pulsándolo, sin formulario ni botón de guardar (ver campos-inline.tsx).
 * Es la misma en la hoja lateral de la lista y en la página de la subvención.
 *
 * Orden, de lo que más se toca a lo que menos: estado → dinero → fechas →
 * justificación → enlaces y notas → lo que en el Excel iba plegado con "+".
 */
export function SubvencionFicha({ subvencion: s, enCapa = false, acciones, mostrarEnlaceMovimientos = true }: SubvencionFichaProps) {
  const guardar = useGuardarSubvencion()
  const g = (cambios: SubvencionUpdate, aviso?: string) => guardar(s, cambios, { aviso })
  const hoy = toLocalDateString(new Date())
  const nombreCorto = s.codigo || s.nombre

  const cambiarEstado = (e: SubvencionEstado) =>
    g({ estado: e }, `${nombreCorto}: ${SUBVENCION_ESTADO_INFO[e].label.toLowerCase()}`)

  return (
    <div className="space-y-6">
      {/* ---------------------------------------------------------- Cabecera */}
      <header className="space-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 pr-8 text-xs text-muted-foreground">
          <TextoInline
            valor={s.codigo}
            onGuardar={(v) => g({ codigo: v })}
            etiqueta="Código"
            vacio="Sin código"
            mono
            className="rounded border bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium text-foreground/80"
            inputClassName="h-7 w-32 text-xs"
          />
          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium tabular-nums text-primary">
            {s.ejercicio ?? "Para estudiar"}
          </span>
          <button
            type="button"
            aria-pressed={s.recurrente}
            onClick={() => g({ recurrente: !s.recurrente })}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              s.recurrente ? "border-primary/30 bg-primary/5 text-primary" : "border-dashed hover:bg-muted",
            )}
            title="¿Sale cada año y nos vamos presentando?"
          >
            <Repeat className="h-3 w-3" />
            {s.recurrente ? "Sale cada año" : "¿Sale cada año?"}
          </button>
          {acciones && <div className="ml-auto">{acciones}</div>}
        </div>

        <TextoInline
          valor={s.nombre}
          onGuardar={(v) => g({ nombre: v ?? s.nombre })}
          etiqueta="Nombre"
          requerido
          className="text-xl font-semibold tracking-tight text-foreground"
          inputClassName="h-9 text-lg font-semibold"
        />

        <div className="flex min-w-0 flex-wrap items-center gap-x-1 gap-y-1 text-sm text-muted-foreground">
          <FinanciadorSelector
            compacto
            value={s.financiador_id}
            onChange={(f) =>
              f &&
              guardar(
                s,
                { financiador_id: f.id },
                {
                  aviso: `Financiador: ${f.nombre}`,
                  optimista: { financiador: { id: f.id, nombre: f.nombre, ambito: f.ambito, orden: f.orden } },
                },
              )
            }
          />
          <span aria-hidden>·</span>
          <span className="text-xs">La pide</span>
          <TextoInline
            valor={s.solicitante}
            onGuardar={(v) => g({ solicitante: v })}
            etiqueta="Quién la pide"
            vacio="—"
            className="text-sm font-medium text-foreground"
            inputClassName="h-7 w-40"
          />
        </div>
      </header>

      {/* ---------------------------------------------------------- Estado */}
      <section aria-label="Estado" className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <EstadoInline estado={s.estado} onGuardar={cambiarEstado} enCapa={enCapa} tamano="md" />
          <button
            type="button"
            aria-pressed={s.justificacion_completa}
            onClick={() =>
              g(
                { justificacion_completa: !s.justificacion_completa },
                s.justificacion_completa ? undefined : `${nombreCorto}: justificación completa`,
              )
            }
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              s.justificacion_completa
                ? "border-emerald-200/70 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-200"
                : "border-dashed text-muted-foreground hover:bg-muted",
            )}
            title="Todo presentado y todos los requerimientos contestados"
          >
            {s.justificacion_completa ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-3.5 w-3.5" />}
            {s.justificacion_completa ? "Justificación completa" : "Justificación sin completar"}
          </button>
        </div>
        <Camino estado={s.estado} onElegir={cambiarEstado} />
      </section>

      {/* ---------------------------------------------------------- Dinero */}
      <Seccion titulo="Dinero">
        <Dinero s={s} g={g} nombreCorto={nombreCorto} mostrarEnlaceMovimientos={mostrarEnlaceMovimientos} />
      </Seccion>

      {/* ---------------------------------------------------------- Fechas */}
      <Seccion titulo="Fechas">
        <LineaDeTiempo s={s} g={g} hoy={hoy} enCapa={enCapa} />
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-md bg-muted/40 px-3 py-2 text-sm">
          <CalendarRange className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span className="text-muted-foreground">Gastos imputables</span>
          <span className="inline-flex flex-wrap items-center gap-x-2">
            <span className="text-muted-foreground">del</span>
            <FechaInline
              valor={s.periodo_desde}
              onGuardar={(v) => g({ periodo_desde: v })}
              etiqueta="Gastos desde"
              vacio="dd/mm/aaaa"
              enCapa={enCapa}
            />
            <span className="text-muted-foreground">al</span>
            <FechaInline
              valor={s.periodo_hasta}
              onGuardar={(v) => g({ periodo_hasta: v })}
              etiqueta="Gastos hasta"
              vacio="dd/mm/aaaa"
              enCapa={enCapa}
            />
          </span>
        </div>
      </Seccion>

      {/* ---------------------------------------------------------- Enlaces y notas */}
      <Seccion titulo="Documentos y notas">
        <div className="space-y-3">
          <div className="flex min-w-0 items-center gap-2">
            <span className="w-20 shrink-0 text-xs text-muted-foreground">Carpeta</span>
            <EnlaceInline
              valor={s.url_carpeta}
              onGuardar={(v) => g({ url_carpeta: v })}
              etiqueta="Carpeta de documentos"
              textoEnlace="Abrir carpeta"
              vacio="Añadir la carpeta de Drive"
            />
          </div>
          <Enlaces enlaces={s.enlaces} onGuardar={(enlaces) => g({ enlaces })} />
          <NotasInline valor={s.notas} onGuardar={(v) => g({ notas: v })} etiqueta="Notas" />
        </div>
      </Seccion>

      <MasDetalles s={s} g={g} />
    </div>
  )
}

// ---------------------------------------------------------------------------

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section aria-label={titulo} className="space-y-2.5">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{titulo}</h3>
      {children}
    </section>
  )
}

/**
 * El camino de siete pasos como una barra de segmentos. Se pinta hasta el paso
 * actual con el color de cada estado, y cada segmento es un botón: pasar a
 * "Concedida" es un clic. Si la subvención se salió del camino (rechazada,
 * renunciamos, cobrada en parte) la barra se apaga y lo dice.
 */
function Camino({ estado, onElegir }: { estado: SubvencionEstado; onElegir: (e: SubvencionEstado) => Promise<void> }) {
  const indice = SUBVENCION_CAMINO.indexOf(estado)
  const fuera = indice === -1
  return (
    <div className="space-y-1.5">
      <ol className="flex gap-1" aria-label="Pasos de la subvención">
        {SUBVENCION_CAMINO.map((e, i) => {
          const info = SUBVENCION_ESTADO_INFO[e]
          const hecho = !fuera && i <= indice
          const actual = i === indice
          return (
            <li key={e} className="flex-1">
              <button
                type="button"
                onClick={() => onElegir(e)}
                aria-current={actual ? "step" : undefined}
                aria-label={`${actual ? "Estado actual: " : "Pasar a "}${info.label}`}
                title={info.label}
                className={cn(
                  "block h-2 w-full rounded-full transition-[background-color,opacity] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
                  hecho ? cn(info.dotClass, "hover:opacity-80") : "bg-muted hover:bg-muted-foreground/30",
                  fuera && "opacity-50",
                  actual && "ring-2 ring-offset-1 ring-offset-background ring-foreground/20",
                )}
              />
            </li>
          )
        })}
      </ol>
      <p className="text-xs text-muted-foreground">
        {fuera ? (
          <>Fuera del camino: {SUBVENCION_ESTADO_INFO[estado].descripcion.toLowerCase()}</>
        ) : (
          <>
            Paso {indice + 1} de {SUBVENCION_CAMINO.length}
            {indice < SUBVENCION_CAMINO.length - 1 && (
              <> · siguiente: {SUBVENCION_ESTADO_INFO[SUBVENCION_CAMINO[indice + 1]].label.toLowerCase()}</>
            )}
          </>
        )}
      </p>
    </div>
  )
}

function Dinero({
  s,
  g,
  nombreCorto,
  mostrarEnlaceMovimientos,
}: {
  s: SubvencionConResumen
  g: (c: SubvencionUpdate, aviso?: string) => Promise<void>
  nombreCorto: string
  mostrarEnlaceMovimientos: boolean
}) {
  const cobrado = importeCobrado(s)
  const tope = Math.max(s.importe_solicitado ?? 0, s.importe_concedido ?? 0, cobrado, 1)
  const pct = (n: number) => `${Math.min((n / tope) * 100, 100)}%`
  const pctImp = porcentajeImputado(s.resumen.total_gastos, s.importe_concedido)
  const concedida = SUBVENCION_ESTADO_INFO.concedida
  const cobradaInfo = SUBVENCION_ESTADO_INFO.cobrada
  const cobradoDeducido = s.importe_cobrado == null && cobrado > 0

  const cifra = (
    label: string,
    punto: string,
    valor: number | null,
    campo: "importe_solicitado" | "importe_concedido" | "importe_cobrado",
    extra?: ReactNode,
  ) => (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-3 [@container(min-width:30rem)]:block">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className={cn("h-2 w-2 shrink-0 rounded-full", punto)} aria-hidden />
        {label}
      </div>
      <ImporteInline
        valor={valor}
        tamano="lg"
        etiqueta={`${label} de ${nombreCorto}`}
        onGuardar={(v) => g({ [campo]: v } as SubvencionUpdate, `${label}: ${v != null ? formatCurrency(v) : "sin importe"}`)}
      />
      {extra && <div className="w-full text-right [@container(min-width:30rem)]:text-left">{extra}</div>}
    </div>
  )

  // Tres cifras en fila solo si caben enteras (hoja lateral); en la columna
  // de la página de detalle y en móvil, una debajo de otra, con la etiqueta a
  // la izquierda. Es el ancho de la tarjeta lo que cuenta, no el de la
  // pantalla: la misma ficha vive en sitios de anchos muy distintos.
  return (
    <div className="space-y-4 rounded-lg border bg-card p-4 [container-type:inline-size]">
      <div className="grid grid-cols-1 gap-2 [@container(min-width:30rem)]:grid-cols-3 [@container(min-width:30rem)]:gap-3">
        {cifra("Solicitado", "bg-muted-foreground/40", s.importe_solicitado, "importe_solicitado")}
        {cifra("Concedido", concedida.dotClass, s.importe_concedido, "importe_concedido")}
        {cifra(
          "Cobrado",
          cobradaInfo.dotClass,
          s.importe_cobrado,
          "importe_cobrado",
          cobradoDeducido ? (
            <p className="text-[11px] text-muted-foreground" title="Está cobrada y no se apuntó cuánto: cuenta lo concedido">
              {formatCurrency(cobrado)} por estar cobrada
            </p>
          ) : null,
        )}
      </div>

      {/* Tres barras superpuestas en una: lo pedido de fondo, lo concedido y lo cobrado encima. */}
      <div
        className="relative h-2.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Solicitado ${formatCurrency(s.importe_solicitado ?? 0)}, concedido ${formatCurrency(s.importe_concedido ?? 0)}, cobrado ${formatCurrency(cobrado)}`}
      >
        <div className="absolute inset-y-0 left-0 rounded-full bg-muted-foreground/25" style={{ width: pct(s.importe_solicitado ?? 0) }} />
        <div className={cn("absolute inset-y-0 left-0 rounded-full opacity-70", concedida.dotClass)} style={{ width: pct(s.importe_concedido ?? 0) }} />
        <div className={cn("absolute inset-y-0 left-0 rounded-full", cobradaInfo.dotClass)} style={{ width: pct(cobrado) }} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3 text-sm">
        <div className="min-w-0">
          <span className="text-muted-foreground">Gastos imputados </span>
          <span className="font-semibold tabular-nums">{formatCurrency(s.resumen.total_gastos)}</span>
          {pctImp != null && (
            <span className="text-muted-foreground tabular-nums"> · {pctImp.toLocaleString("es-ES")} % de lo concedido</span>
          )}
          {s.resumen.movimientos > 0 && (
            <span className="text-muted-foreground">
              {" "}
              · {s.resumen.movimientos} mov.{s.resumen.delegaciones > 1 ? ` de ${s.resumen.delegaciones} delegaciones` : ""}
            </span>
          )}
        </div>
        {mostrarEnlaceMovimientos && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/subvenciones/${s.id}`}>
              {s.resumen.movimientos ? "Ver movimientos" : "Imputar gastos"}
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
      </div>
      {pctImp != null && s.resumen.total_gastos > 0 && (
        <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
          <div
            className={cn("h-full rounded-full", pctImp > 100 ? "bg-amber-500" : "bg-primary")}
            style={{ width: `${Math.min(pctImp, 100)}%` }}
          />
        </div>
      )}
    </div>
  )
}

/**
 * Las seis fechas como una línea de tiempo vertical: lo pasado apagado, lo que
 * viene con su "en 12 días", y la siguiente que aprieta, resaltada. Cada fecha
 * se cambia pulsándola.
 */
function LineaDeTiempo({
  s,
  g,
  hoy,
  enCapa,
}: {
  s: SubvencionConResumen
  g: (c: SubvencionUpdate) => Promise<void>
  hoy: string
  enCapa: boolean
}) {
  const siguiente = proximaFecha(s, hoy)
  return (
    <ol className="relative space-y-0.5 before:absolute before:bottom-3 before:left-[7px] before:top-3 before:w-px before:bg-border">
      {HITOS.map((h) => {
        const valor = s[h.campo]
        const pasado = !!valor && valor < hoy
        const esSiguiente = !!siguiente && siguiente.fecha === valor && valor != null && valor >= hoy
        return (
          <li key={h.campo} className="relative flex min-h-8 items-center gap-3 pl-6">
            <span
              aria-hidden
              className={cn(
                "absolute left-0 top-1/2 h-[15px] w-[15px] -translate-y-1/2 rounded-full border-2 bg-background",
                !valor && "border-dashed border-muted-foreground/30",
                pasado && "border-muted-foreground/40 bg-muted-foreground/40",
                valor && !pasado && "border-primary",
                esSiguiente && "border-primary bg-primary ring-4 ring-primary/15",
              )}
            />
            <span className={cn("w-36 shrink-0 text-sm", esSiguiente ? "font-medium text-foreground" : "text-muted-foreground")}>
              {h.label}
            </span>
            <FechaInline
              valor={valor}
              onGuardar={(v) => g({ [h.campo]: v } as SubvencionUpdate)}
              etiqueta={h.label}
              vacio="—"
              enCapa={enCapa}
              className={cn(pasado && "text-muted-foreground", esSiguiente && "font-medium text-primary")}
            >
              {valor ? (
                <span className="truncate">
                  {formatDate(valor)}
                  <span className={cn("ml-1.5 text-xs", esSiguiente ? "text-primary" : "text-muted-foreground")}>
                    {cuandoEs(valor, hoy)}
                  </span>
                </span>
              ) : undefined}
            </FechaInline>
          </li>
        )
      })}
    </ol>
  )
}

function Enlaces({
  enlaces,
  onGuardar,
}: {
  enlaces: SubvencionEnlace[]
  onGuardar: (enlaces: SubvencionEnlace[]) => Promise<void>
}) {
  const [nuevo, setNuevo] = useState<SubvencionEnlace | null>(null)

  const anadir = async () => {
    if (!nuevo?.url.trim()) return
    await onGuardar([...enlaces, { nombre: nuevo.nombre.trim() || "Enlace", url: nuevo.url.trim() }]).catch(() => {})
    setNuevo(null)
  }

  return (
    <div className="flex min-w-0 items-start gap-2">
      <span className="w-20 shrink-0 pt-1 text-xs text-muted-foreground">Enlaces</span>
      <div className="min-w-0 flex-1 space-y-1">
        {enlaces.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {enlaces.map((e, i) => (
              <li key={`${e.url}-${i}`} className="group/enlace inline-flex max-w-full items-center rounded-md border bg-card text-xs">
                <a
                  href={e.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-w-0 items-center gap-1 px-2 py-1 hover:text-primary"
                >
                  <ExternalLink className="h-3 w-3 shrink-0" />
                  <span className="truncate">{e.nombre || "Enlace"}</span>
                </a>
                <button
                  type="button"
                  onClick={() => onGuardar(enlaces.filter((_, j) => j !== i)).catch(() => {})}
                  className="rounded-r-md px-1.5 py-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={`Quitar el enlace ${e.nombre || e.url}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </li>
            ))}
          </ul>
        )}
        {nuevo ? (
          <form
            className="flex min-w-0 flex-wrap gap-1.5"
            onSubmit={(ev) => {
              ev.preventDefault()
              anadir()
            }}
          >
            <Input
              autoFocus
              value={nuevo.nombre}
              onChange={(ev) => setNuevo({ ...nuevo, nombre: ev.target.value })}
              placeholder="Bases, readme…"
              className="h-8 w-32"
              aria-label="Nombre del enlace"
            />
            <Input
              type="url"
              value={nuevo.url}
              onChange={(ev) => setNuevo({ ...nuevo, url: ev.target.value })}
              placeholder="https://…"
              className="h-8 min-w-0 flex-1"
              aria-label="Dirección del enlace"
              onKeyDown={(ev) => ev.key === "Escape" && setNuevo(null)}
            />
            <Button type="submit" size="sm" className="h-8" disabled={!nuevo.url.trim()}>
              Añadir
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-8" onClick={() => setNuevo(null)}>
              Cancelar
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setNuevo({ nombre: "", url: "" })}
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 -mx-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            Añadir enlace
          </button>
        )}
      </div>
    </div>
  )
}

function MasDetalles({ s, g }: { s: SubvencionConResumen; g: (c: SubvencionUpdate) => Promise<void> }) {
  const [abierto, setAbierto] = useState(false)
  return (
    <Collapsible open={abierto} onOpenChange={setAbierto}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <ChevronDown className={cn("h-4 w-4 transition-transform", abierto && "rotate-180")} />
          Más detalles
          {!abierto && (s.convocatoria || s.expediente) && (
            <span className="text-xs font-normal">· convocatoria oficial{s.expediente ? ", expediente" : ""}</span>
          )}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-3 pt-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="w-20 shrink-0 text-xs text-muted-foreground">Expediente</span>
          <TextoInline
            valor={s.expediente}
            onGuardar={(v) => g({ expediente: v })}
            etiqueta="Expediente"
            vacio="—"
            mono
            className="text-sm"
            inputClassName="w-48"
          />
        </div>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Nombre oficial de la convocatoria</span>
          <NotasInline
            valor={s.convocatoria}
            onGuardar={(v) => g({ convocatoria: v })}
            etiqueta="Nombre oficial de la convocatoria"
            vacio="Añadir el nombre oficial…"
          />
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
