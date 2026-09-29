"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { es } from "date-fns/locale"
import { Check, ChevronDown, ExternalLink, Pencil, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Calendar } from "@/components/ui/calendar"
import { LoadingSpinner } from "@/components/ui/loading-spinner"
import { MoneyInput, formatMoney, parseMoney } from "@/components/ui/money-input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Command, CommandGroup, CommandItem, CommandList } from "@/components/ui/command"
import { StatusPill } from "@/components/ui/status-pill"
import { SUBVENCION_CAMINO, SUBVENCION_ESTADO_INFO } from "@/lib/utils/subvenciones"
import { formatCurrency, formatDate } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import type { SubvencionEstado } from "@/lib/types/database"

/**
 * Edición en el sitio para la ficha de una subvención y su fila de la lista.
 *
 * Lo que se cambia una vez y rápido —el estado, los importes, una fecha— se
 * cambia donde se ve, sin abrir un formulario. Todos siguen el mismo trato,
 * para que se aprenda una vez:
 *
 *   - el valor es el botón: se pulsa (o se llega con Tab y Enter) y se edita;
 *   - **Enter o salir del campo guarda**, **Esc deja lo que había**;
 *   - mientras guarda, un spinner y el campo no admite otro envío; al terminar,
 *     un check verde que se apaga solo (design.md §3.5);
 *   - si falla, vuelve el valor anterior y el error sale en un aviso (lo hace
 *     `useGuardarSubvencion`).
 *
 * `enCapa` sube el z-index de los desplegables cuando el campo vive dentro de
 * la hoja lateral (z-[60]); con el z-50 de serie se pintarían por debajo.
 */

type Guardar<T> = (valor: T) => Promise<void>

/** Check verde de ~1,4 s tras guardar. */
function useHecho() {
  const [hecho, setHecho] = useState(false)
  const t = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => {
    if (t.current) clearTimeout(t.current)
  }, [])
  const marcar = () => {
    setHecho(true)
    if (t.current) clearTimeout(t.current)
    t.current = setTimeout(() => setHecho(false), 1400)
  }
  return [hecho, marcar] as const
}

function Indicador({ guardando, hecho }: { guardando: boolean; hecho: boolean }) {
  if (guardando) return <LoadingSpinner size="sm" className="shrink-0" />
  if (hecho)
    return (
      <Check
        className="h-3.5 w-3.5 shrink-0 text-emerald-600 animate-in fade-in-0 zoom-in-50 duration-200 motion-reduce:animate-none dark:text-emerald-400"
        aria-label="Guardado"
      />
    )
  return null
}

/** Aspecto común del valor pulsable: parece texto, se nota que se toca. */
const valorPulsable =
  "group/campo inline-flex max-w-full items-center gap-1.5 rounded-md px-1.5 py-0.5 -mx-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none"

/**
 * Lápiz que asoma al pasar el ratón o llegar con el teclado. En pantallas
 * táctiles no hay "pasar por encima", así que ni se reserva su sitio: en una
 * fila de móvil esos 18 px son los que recortaban la cifra.
 */
function Lapiz() {
  return (
    <Pencil
      className="hidden h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover/campo:opacity-100 group-focus-visible/campo:opacity-100 [@media(hover:hover)]:block"
      aria-hidden
    />
  )
}

async function conEstado(
  setGuardando: (v: boolean) => void,
  marcar: () => void,
  accion: () => Promise<void>,
): Promise<boolean> {
  setGuardando(true)
  try {
    await accion()
    marcar()
    return true
  } catch {
    return false
  } finally {
    setGuardando(false)
  }
}

// ---------------------------------------------------------------------------
// Importe
// ---------------------------------------------------------------------------

export function ImporteInline({
  valor,
  onGuardar,
  etiqueta,
  vacio = "—",
  className,
  tamano = "md",
}: {
  valor: number | null
  onGuardar: Guardar<number | null>
  /** Para el lector de pantalla: "Importe concedido de IVAJ 2026". */
  etiqueta: string
  vacio?: ReactNode
  className?: string
  tamano?: "sm" | "md" | "lg"
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [hecho, marcar] = useHecho()
  const cerrado = useRef(false)

  const abrir = () => {
    setTexto(formatMoney(valor))
    cerrado.current = false
    setEditando(true)
  }

  const terminar = async (guardar: boolean) => {
    if (cerrado.current) return
    cerrado.current = true
    setEditando(false)
    if (!guardar) return
    const nuevo = texto.trim() ? parseMoney(texto) : null
    if (nuevo === valor || (nuevo != null && valor != null && Math.abs(nuevo - valor) < 0.005)) return
    await conEstado(setGuardando, marcar, () => onGuardar(nuevo))
  }

  const tam = tamano === "lg" ? "text-xl font-semibold" : tamano === "sm" ? "text-sm" : "text-sm font-medium"

  if (editando) {
    return (
      <span className={cn("relative inline-flex", className)}>
        <MoneyInput
          autoFocus
          value={texto}
          onValueChange={setTexto}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={() => terminar(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              terminar(true)
            } else if (e.key === "Escape") {
              e.preventDefault()
              e.stopPropagation()
              terminar(false)
            }
          }}
          aria-label={etiqueta}
          placeholder="0,00"
          className={cn(
            "h-8 pr-6 text-right tabular-nums",
            tamano === "lg" ? "w-40 text-lg font-semibold" : "w-32",
          )}
        />
        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">€</span>
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={abrir}
      disabled={guardando}
      aria-label={`${etiqueta}: ${valor != null ? formatCurrency(valor) : "sin importe"}. Cambiar`}
      className={cn(valorPulsable, "tabular-nums", tam, valor == null && "text-muted-foreground", className)}
    >
      <span className="truncate">{valor != null ? formatCurrency(valor) : vacio}</span>
      <Indicador guardando={guardando} hecho={hecho} />
      {!guardando && !hecho && <Lapiz />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

const FUERA_DEL_CAMINO: SubvencionEstado[] = ["cobrada_parcial", "rechazada", "renuncia"]

export function EstadoInline({
  estado,
  onGuardar,
  enCapa = false,
  tamano = "sm",
  etiqueta = "Estado",
}: {
  estado: SubvencionEstado
  onGuardar: Guardar<SubvencionEstado>
  enCapa?: boolean
  tamano?: "sm" | "md"
  etiqueta?: string
}) {
  const [open, setOpen] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [hecho, marcar] = useHecho()
  const info = SUBVENCION_ESTADO_INFO[estado]

  const elegir = async (e: SubvencionEstado) => {
    setOpen(false)
    if (e === estado) return
    await conEstado(setGuardando, marcar, () => onGuardar(e))
  }

  const item = (e: SubvencionEstado) => {
    const i = SUBVENCION_ESTADO_INFO[e]
    return (
      <CommandItem key={e} value={`${i.label} ${e}`} onSelect={() => elegir(e)} className="items-start gap-2.5 py-2">
        <i.icon className={cn("mt-0.5 h-4 w-4 shrink-0", i.textClass)} aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">{i.label}</span>
          <span className="block text-xs text-muted-foreground">{i.descripcion}</span>
        </span>
        {e === estado && <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-label="Estado actual" />}
      </CommandItem>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={guardando}
          aria-label={`${etiqueta}: ${info.label}. Cambiar`}
          className="group/campo inline-flex items-center gap-1 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
        >
          <StatusPill
            label={info.label}
            icon={info.icon}
            size={tamano}
            bgClass={info.bgClass}
            textClass={info.textClass}
            borderClass={cn(info.borderClass, "transition-shadow group-hover/campo:shadow-sm")}
            className="pr-1.5"
          />
          <span className="-ml-0.5 inline-flex w-4 justify-center">
            {guardando || hecho ? (
              <Indicador guardando={guardando} hecho={hecho} />
            ) : (
              <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
            )}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-80 p-0", enCapa && "z-[80]")}>
        {/* Se abre con el estado actual resaltado: las flechas parten de donde está. */}
        <Command defaultValue={`${info.label} ${estado}`}>
          <CommandList className="max-h-[22rem]">
            <CommandGroup heading="El camino">{SUBVENCION_CAMINO.map(item)}</CommandGroup>
            <CommandGroup heading="Otros desenlaces">{FUERA_DEL_CAMINO.map(item)}</CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Fecha
// ---------------------------------------------------------------------------

function aFecha(iso: string | null): Date | undefined {
  if (!iso) return undefined
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number)
  return new Date(y, m - 1, d)
}

function aIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

export function FechaInline({
  valor,
  onGuardar,
  etiqueta,
  vacio = "Sin fecha",
  enCapa = false,
  className,
  children,
}: {
  valor: string | null
  onGuardar: Guardar<string | null>
  etiqueta: string
  vacio?: ReactNode
  enCapa?: boolean
  className?: string
  /** Contenido alternativo del botón (p. ej. fecha + "en 12 días"). */
  children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [hecho, marcar] = useHecho()
  const seleccionada = aFecha(valor)

  const fijar = async (iso: string | null) => {
    setOpen(false)
    if (iso === valor) return
    await conEstado(setGuardando, marcar, () => onGuardar(iso))
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={guardando}
          aria-label={`${etiqueta}: ${valor ? formatDate(valor) : "sin fecha"}. Cambiar`}
          className={cn(valorPulsable, "text-sm tabular-nums", !valor && "text-muted-foreground", className)}
        >
          {children ?? <span className="truncate">{valor ? formatDate(valor) : vacio}</span>}
          <Indicador guardando={guardando} hecho={hecho} />
          {!guardando && !hecho && <Lapiz />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className={cn("w-auto p-0", enCapa && "z-[80]")}>
        <Calendar
          mode="single"
          selected={seleccionada}
          defaultMonth={seleccionada ?? new Date()}
          captionLayout="dropdown"
          startMonth={new Date(2018, 0)}
          endMonth={new Date(new Date().getFullYear() + 4, 11)}
          onSelect={(d) => d && fijar(aIso(d))}
          locale={es}
          autoFocus
        />
        <div className="flex gap-1 border-t p-2">
          <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={() => fijar(aIso(new Date()))}>
            Hoy
          </Button>
          {valor && (
            <Button type="button" variant="ghost" size="sm" className="flex-1 text-muted-foreground" onClick={() => fijar(null)}>
              <X className="h-3.5 w-3.5" />
              Quitar fecha
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ---------------------------------------------------------------------------
// Texto de una línea
// ---------------------------------------------------------------------------

export function TextoInline({
  valor,
  onGuardar,
  etiqueta,
  vacio = "Añadir",
  requerido = false,
  className,
  inputClassName,
  mono = false,
}: {
  valor: string | null
  onGuardar: Guardar<string | null>
  etiqueta: string
  vacio?: ReactNode
  /** No se puede dejar vacío: vaciarlo deja lo que había. */
  requerido?: boolean
  className?: string
  inputClassName?: string
  mono?: boolean
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [hecho, marcar] = useHecho()
  const cerrado = useRef(false)

  const terminar = async (guardar: boolean) => {
    if (cerrado.current) return
    cerrado.current = true
    setEditando(false)
    if (!guardar) return
    const limpio = texto.trim()
    if (requerido && !limpio) return
    const nuevo = limpio || null
    if (nuevo === (valor ?? null)) return
    await conEstado(setGuardando, marcar, () => onGuardar(nuevo))
  }

  if (editando) {
    return (
      <Input
        autoFocus
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        onFocus={(e) => e.currentTarget.select()}
        onBlur={() => terminar(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            terminar(true)
          } else if (e.key === "Escape") {
            e.preventDefault()
            e.stopPropagation()
            terminar(false)
          }
        }}
        aria-label={etiqueta}
        className={cn("h-8", mono && "font-mono", inputClassName)}
      />
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setTexto(valor ?? "")
        cerrado.current = false
        setEditando(true)
      }}
      disabled={guardando}
      aria-label={`${etiqueta}: ${valor || "vacío"}. Cambiar`}
      className={cn(valorPulsable, mono && "font-mono", !valor && "text-muted-foreground", className)}
    >
      <span className="min-w-0 truncate">{valor || vacio}</span>
      <Indicador guardando={guardando} hecho={hecho} />
      {!guardando && !hecho && <Lapiz />}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Texto largo (notas, nombre oficial)
// ---------------------------------------------------------------------------

export function NotasInline({
  valor,
  onGuardar,
  etiqueta,
  vacio = "Añadir notas…",
  className,
}: {
  valor: string | null
  onGuardar: Guardar<string | null>
  etiqueta: string
  vacio?: string
  className?: string
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [hecho, marcar] = useHecho()
  const cerrado = useRef(false)

  const terminar = async (guardar: boolean) => {
    if (cerrado.current) return
    cerrado.current = true
    setEditando(false)
    if (!guardar) return
    const nuevo = texto.trim() || null
    if (nuevo === (valor ?? null)) return
    await conEstado(setGuardando, marcar, () => onGuardar(nuevo))
  }

  if (editando) {
    return (
      <div className="space-y-1">
        <Textarea
          autoFocus
          value={texto}
          rows={Math.min(Math.max(texto.split("\n").length + 1, 3), 12)}
          onChange={(e) => setTexto(e.target.value)}
          onBlur={() => terminar(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault()
              terminar(true)
            } else if (e.key === "Escape") {
              e.preventDefault()
              e.stopPropagation()
              terminar(false)
            }
          }}
          aria-label={etiqueta}
          className="text-sm"
        />
        <p className="text-[11px] text-muted-foreground">Se guarda al salir · Esc para dejarlo como estaba</p>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={() => {
        setTexto(valor ?? "")
        cerrado.current = false
        setEditando(true)
      }}
      disabled={guardando}
      aria-label={`${etiqueta}. Cambiar`}
      className={cn(
        "group/campo relative block w-full rounded-md px-2 py-1.5 -mx-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        !valor && "text-muted-foreground",
        className,
      )}
    >
      <span className="block whitespace-pre-wrap break-words pr-5">{valor || vacio}</span>
      <span className="absolute right-1.5 top-2">
        {guardando || hecho ? <Indicador guardando={guardando} hecho={hecho} /> : <Lapiz />}
      </span>
    </button>
  )
}

// ---------------------------------------------------------------------------
// Enlace
// ---------------------------------------------------------------------------

export function EnlaceInline({
  valor,
  onGuardar,
  etiqueta,
  textoEnlace,
  vacio = "Añadir enlace",
}: {
  valor: string | null
  onGuardar: Guardar<string | null>
  etiqueta: string
  textoEnlace: string
  vacio?: string
}) {
  const [editando, setEditando] = useState(false)
  const [texto, setTexto] = useState("")
  const [guardando, setGuardando] = useState(false)
  const [hecho, marcar] = useHecho()
  const cerrado = useRef(false)

  const abrirEdicion = () => {
    setTexto(valor ?? "")
    cerrado.current = false
    setEditando(true)
  }
  const terminar = async (guardar: boolean) => {
    if (cerrado.current) return
    cerrado.current = true
    setEditando(false)
    if (!guardar) return
    const nuevo = texto.trim() || null
    if (nuevo === (valor ?? null)) return
    await conEstado(setGuardando, marcar, () => onGuardar(nuevo))
  }

  if (editando) {
    return (
      <Input
        autoFocus
        type="url"
        value={texto}
        placeholder="https://drive.google.com/…"
        onChange={(e) => setTexto(e.target.value)}
        onBlur={() => terminar(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault()
            terminar(true)
          } else if (e.key === "Escape") {
            e.preventDefault()
            e.stopPropagation()
            terminar(false)
          }
        }}
        aria-label={etiqueta}
        className="h-8"
      />
    )
  }

  if (!valor) {
    return (
      <button type="button" onClick={abrirEdicion} className={cn(valorPulsable, "text-sm text-muted-foreground")}>
        {vacio}
        <Indicador guardando={guardando} hecho={hecho} />
      </button>
    )
  }

  return (
    <span className="inline-flex min-w-0 items-center gap-1">
      <a
        href={valor}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 -ml-1.5 text-sm font-medium text-primary hover:bg-primary/10"
      >
        <ExternalLink className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate">{textoEnlace}</span>
      </a>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0"
        onClick={abrirEdicion}
        aria-label={`Cambiar ${etiqueta.toLowerCase()}`}
        title="Cambiar el enlace"
      >
        {guardando || hecho ? <Indicador guardando={guardando} hecho={hecho} /> : <Pencil className="h-3.5 w-3.5" />}
      </Button>
    </span>
  )
}
