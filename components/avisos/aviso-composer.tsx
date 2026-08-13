"use client"

import { forwardRef, useEffect, useRef, useState } from "react"
import { es } from "date-fns/locale"
import {
  ArrowUp,
  Building2,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  Flag,
  Loader2,
  MessageSquare,
  Plus,
  SquareCheckBig,
  Tag,
  User,
  Users,
  X,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Switch } from "@/components/ui/switch"
import type { AvisoAsignable, AvisoDestinatario, AvisoTipo } from "@/lib/types/avisos"
import { AVISO_MAX_CONTENIDO, AVISO_MAX_REFERENCIA } from "@/lib/types/avisos"
import { formatFechaLimiteCorta } from "./utils"

export interface AvisoDraft {
  tipo: AvisoTipo
  destinatario: AvisoDestinatario
  contenido: string
  referencia: string
  notificar: boolean
  referenciaAbierta: boolean
  /** Solo aplica a tareas. */
  responsable_id: string | null
  /**
   * Nombre del responsable elegido. Se guarda junto al id para que el chip lo
   * muestre al instante (y tras recargar, con el borrador de localStorage) sin
   * tener que ir a buscar la lista de asignables.
   */
  responsable_nombre: string | null
  /** Solo aplica a tareas. ISO "yyyy-mm-dd". */
  fecha_limite: string | null
  /** Solo aplica a tareas. */
  urgente: boolean
}

export const AVISO_DRAFT_VACIO: AvisoDraft = {
  tipo: "tarea",
  destinatario: "delegacion",
  contenido: "",
  referencia: "",
  notificar: false,
  referenciaAbierta: false,
  responsable_id: null,
  responsable_nombre: null,
  fecha_limite: null,
  urgente: false,
}

interface AvisoComposerProps {
  draft: AvisoDraft
  onDraftChange: (cambios: Partial<AvisoDraft>) => void
  onSubmit: () => void
  enviando: boolean
  /** Nombre del lado receptor, para el texto en reposo ("…a MCM Vila-real"). */
  destinoNombre: string
  /** A quién avisaría el correo si se activa el interruptor, para el pie. */
  descripcionCorreo: string
  /** A quién se le puede asignar la tarea dirigida a `destinatario`. */
  onCargarAsignables: (destinatario: AvisoDestinatario) => Promise<AvisoAsignable[]>
  /** Ref al textarea para poder enfocarlo al abrir el panel. */
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
}

const PLACEHOLDERS: Record<AvisoTipo, string> = {
  tarea: "Qué hay que hacer…",
  nota: "Qué queremos contar…",
}

const DESTINATARIO_OPCIONES: { value: AvisoDestinatario; label: string; icono: typeof Building2 }[] = [
  { value: "delegacion", label: "Para la delegación", icono: Building2 },
  { value: "oficina_tecnica", label: "Para la oficina técnica", icono: Users },
]

/**
 * Chip de detalle del compositor (responsable, fecha, prioridad, referencia).
 *
 * Reenvía ref y props porque varios de estos chips son el `PopoverTrigger` de
 * Radix con `asChild`: si no se propagan, el `onClick` que abre el desplegable
 * nunca llega al botón y el chip se queda muerto.
 */
const Chip = forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { relleno?: boolean }
>(({ relleno, className, children, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    {...props}
    className={cn(
      "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[12px] transition-colors duration-150",
      relleno
        ? "bg-secondary text-muted-foreground hover:bg-secondary/80"
        : "border border-dashed border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground",
      className,
    )}
  >
    {children}
  </button>
))
Chip.displayName = "Chip"

export function AvisoComposer({
  draft,
  onDraftChange,
  onSubmit,
  enviando,
  destinoNombre,
  descripcionCorreo,
  onCargarAsignables,
  textareaRef,
}: AvisoComposerProps) {
  const internalRef = useRef<HTMLTextAreaElement | null>(null)
  const ref = textareaRef ?? internalRef
  const referenciaRef = useRef<HTMLInputElement | null>(null)
  const contenedorRef = useRef<HTMLDivElement | null>(null)

  // "Reposo" solo cuando no hay nada que perder: si hay texto o detalles (por
  // ejemplo un borrador recuperado de localStorage) se muestra ya desplegado.
  const [expandidoManual, setExpandidoManual] = useState(false)
  const [destinoAbierto, setDestinoAbierto] = useState(false)
  const [responsableAbierto, setResponsableAbierto] = useState(false)
  const [fechaAbierta, setFechaAbierta] = useState(false)
  const [asignables, setAsignables] = useState<AvisoAsignable[]>([])
  const [cargandoAsignables, setCargandoAsignables] = useState(false)

  const esTarea = draft.tipo === "tarea"
  const puedeEnviar = draft.contenido.trim().length > 0 && !enviando
  const tieneDetalles = Boolean(
    draft.referencia || draft.responsable_id || draft.fecha_limite || draft.urgente,
  )
  const expandido = expandidoManual || Boolean(draft.contenido.trim()) || tieneDetalles

  // Autoajuste de altura: crece hasta 5 líneas y luego hace scroll.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 124)}px`
  }, [draft.contenido, ref, expandido])

  useEffect(() => {
    if (draft.referenciaAbierta) referenciaRef.current?.focus()
  }, [draft.referenciaAbierta])

  // Se carga al abrir el desplegable, no en un efecto: es una reacción directa
  // al clic del usuario, no una sincronización con el render.
  const abrirResponsables = (siguiente: boolean) => {
    setResponsableAbierto(siguiente)
    if (!siguiente) return
    setCargandoAsignables(true)
    onCargarAsignables(draft.destinatario)
      .then(setAsignables)
      .finally(() => setCargandoAsignables(false))
  }

  const abrir = () => {
    setExpandidoManual(true)
    setTimeout(() => ref.current?.focus(), 0)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      if (puedeEnviar) onSubmit()
    }
  }

  const handleBlur = () => {
    // Los desplegables se pintan en un portal fuera de este contenedor, así que
    // el foco puede salir del árbol sin que el usuario haya abandonado el
    // compositor. Se comprueba en el siguiente tick, ya asentado el foco.
    setTimeout(() => {
      if (destinoAbierto || responsableAbierto || fechaAbierta) return
      if (contenedorRef.current?.contains(document.activeElement)) return
      if (draft.contenido.trim() || tieneDetalles) return
      setExpandidoManual(false)
    }, 0)
  }

  // ── Reposo: el compositor plegado, la lista manda ──────────────────────────
  if (!expandido) {
    return (
      <div className="px-4 pb-3.5">
        <button
          type="button"
          onClick={abrir}
          className={cn(
            // Móvil: acción principal de la barra inferior, sólida y a 48px.
            "flex w-full items-center justify-center gap-2.5 rounded-[14px]",
            "h-12 bg-primary text-[15px] font-semibold text-primary-foreground",
            "transition-colors duration-150 hover:bg-primary/90",
            // Escritorio: discreta, la lista manda.
            "sm:h-auto sm:justify-start sm:rounded-[14px] sm:border sm:border-dashed sm:border-border",
            "sm:bg-background sm:px-3.5 sm:py-3 sm:text-left sm:text-[13.5px] sm:font-normal sm:text-muted-foreground",
            "sm:hover:border-foreground/25 sm:hover:bg-background sm:hover:text-foreground",
          )}
        >
          <Plus className="h-[18px] w-[18px] shrink-0 sm:h-4 sm:w-4" aria-hidden />
          <span className="truncate sm:hidden">Escribir un aviso</span>
          <span className="hidden truncate sm:inline">Escribir un aviso a {destinoNombre}…</span>
        </button>
      </div>
    )
  }

  // ── Escribiendo ────────────────────────────────────────────────────────────
  return (
    <div className="px-4 pb-3.5" ref={contenedorRef} onBlur={handleBlur}>
      <div className="rounded-2xl border border-primary/45 bg-card shadow-[0_0_0_3.5px_hsl(var(--primary)/0.10)]">
        {/* Tipo + destinatario */}
        <div className="flex items-center gap-1 px-2.5 pt-2.5">
          {(
            [
              { tipo: "tarea" as const, label: "Tarea", Icono: SquareCheckBig },
              { tipo: "nota" as const, label: "Nota", Icono: MessageSquare },
            ]
          ).map(({ tipo, label, Icono }) => {
            const activo = draft.tipo === tipo
            return (
              <button
                key={tipo}
                type="button"
                onClick={() => onDraftChange({ tipo })}
                aria-pressed={activo}
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 rounded-lg px-[11px] text-[12px]",
                  "transition-colors duration-150",
                  activo
                    ? tipo === "tarea"
                      ? "bg-amber-500/[0.14] font-semibold text-amber-800 dark:text-amber-300"
                      : "bg-primary/[0.14] font-semibold text-blue-700 dark:text-blue-300"
                    : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                <Icono className="h-[13px] w-[13px]" aria-hidden />
                {label}
              </button>
            )
          })}

          <span className="flex-1" />

          <Popover open={destinoAbierto} onOpenChange={setDestinoAbierto}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className={cn(
                  "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2.5",
                  "text-[11.5px] font-medium text-foreground transition-colors duration-150 hover:bg-muted",
                )}
              >
                {DESTINATARIO_OPCIONES.find((o) => o.value === draft.destinatario)?.label}
                <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-60 p-1">
              {DESTINATARIO_OPCIONES.map(({ value, label, icono: Icono }) => {
                const activo = draft.destinatario === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => {
                      // El responsable se elige entre la gente del lado que
                      // recibe: si cambia el destinatario, deja de ser válido.
                      onDraftChange({
                        destinatario: value,
                        responsable_id: null,
                        responsable_nombre: null,
                      })
                      setDestinoAbierto(false)
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px]",
                      "transition-colors duration-150 hover:bg-muted",
                      activo && "font-medium text-foreground",
                    )}
                  >
                    <Icono className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                    <span className="flex-1">{label}</span>
                    {activo && <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />}
                  </button>
                )
              })}
            </PopoverContent>
          </Popover>
        </div>

        {/* Texto */}
        <textarea
          ref={ref}
          rows={1}
          value={draft.contenido}
          maxLength={AVISO_MAX_CONTENIDO}
          onChange={(event) => onDraftChange({ contenido: event.target.value })}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDERS[draft.tipo]}
          aria-label={esTarea ? "Nueva tarea" : "Nueva nota"}
          className={cn(
            "scrollbar-thin block w-full resize-none bg-transparent px-3.5 pb-0.5 pt-2",
            "text-[13.5px] leading-[1.55] outline-none placeholder:text-muted-foreground/60",
          )}
        />

        {draft.referenciaAbierta && (
          <div className="flex items-center gap-1.5 px-3.5 pt-1.5">
            <Tag className="h-3 w-3 shrink-0 text-muted-foreground/70" aria-hidden />
            <input
              ref={referenciaRef}
              value={draft.referencia}
              maxLength={AVISO_MAX_REFERENCIA}
              onChange={(event) => onDraftChange({ referencia: event.target.value })}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault()
                  if (puedeEnviar) onSubmit()
                }
                if (event.key === "Escape") {
                  event.preventDefault()
                  onDraftChange({ referenciaAbierta: false, referencia: "" })
                  ref.current?.focus()
                }
              }}
              placeholder="Hablar con David, con Lucía…"
              aria-label="Referencia"
              className="min-w-0 flex-1 bg-transparent text-[12px] leading-none outline-none placeholder:text-muted-foreground/50"
            />
            <button
              type="button"
              title="Quitar referencia"
              aria-label="Quitar referencia"
              onClick={() => {
                onDraftChange({ referenciaAbierta: false, referencia: "" })
                ref.current?.focus()
              }}
              className="relative flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/60 before:absolute before:-inset-2.5 before:content-[''] transition-colors duration-150 hover:bg-muted hover:text-foreground"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </div>
        )}

        {/* Detalles opcionales: solo tienen sentido en una tarea */}
        <div className="flex flex-wrap items-center gap-1.5 px-3 pt-2.5">
          {esTarea && (
            <Popover open={responsableAbierto} onOpenChange={abrirResponsables}>
              <PopoverTrigger asChild>
                <Chip relleno={Boolean(draft.responsable_id)}>
                  <User className="h-[13px] w-[13px]" aria-hidden />
                  Responsable
                  {draft.responsable_id && (
                    <span className="font-semibold text-foreground">
                      {draft.responsable_nombre ?? "Asignado"}
                    </span>
                  )}
                </Chip>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-60 p-1">
                {cargandoAsignables ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-[12px] text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Cargando…
                  </div>
                ) : asignables.length === 0 ? (
                  <p className="px-2 py-3 text-[12px] leading-snug text-muted-foreground">
                    No hay nadie a quien asignar en ese lado todavía.
                  </p>
                ) : (
                  <>
                    {asignables.map((persona) => (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => {
                          onDraftChange({
                            responsable_id: persona.id,
                            responsable_nombre: persona.nombre,
                          })
                          setResponsableAbierto(false)
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px]",
                          "transition-colors duration-150 hover:bg-muted",
                          draft.responsable_id === persona.id && "font-medium",
                        )}
                      >
                        <span className="flex-1 truncate">{persona.nombre}</span>
                        {draft.responsable_id === persona.id && (
                          <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                        )}
                      </button>
                    ))}
                    {draft.responsable_id && (
                      <button
                        type="button"
                        onClick={() => {
                          onDraftChange({ responsable_id: null, responsable_nombre: null })
                          setResponsableAbierto(false)
                        }}
                        className="mt-1 w-full rounded-md border-t border-border px-2 pb-1.5 pt-2 text-left text-[12.5px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                      >
                        Quitar responsable
                      </button>
                    )}
                  </>
                )}
              </PopoverContent>
            </Popover>
          )}

          {esTarea && (
            <Popover open={fechaAbierta} onOpenChange={setFechaAbierta}>
              <PopoverTrigger asChild>
                <Chip relleno={Boolean(draft.fecha_limite)}>
                  <CalendarIcon className="h-[13px] w-[13px]" aria-hidden />
                  {draft.fecha_limite ? (
                    <>
                      Antes del{" "}
                      <span className="font-semibold text-foreground">
                        {formatFechaLimiteCorta(draft.fecha_limite)}
                      </span>
                    </>
                  ) : (
                    "Fecha límite"
                  )}
                </Chip>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={draft.fecha_limite ? new Date(`${draft.fecha_limite}T12:00:00`) : undefined}
                  defaultMonth={
                    draft.fecha_limite ? new Date(`${draft.fecha_limite}T12:00:00`) : new Date()
                  }
                  locale={es}
                  onSelect={(date) => {
                    if (!date) return
                    const y = date.getFullYear()
                    const m = String(date.getMonth() + 1).padStart(2, "0")
                    const d = String(date.getDate()).padStart(2, "0")
                    onDraftChange({ fecha_limite: `${y}-${m}-${d}` })
                    setFechaAbierta(false)
                  }}
                  autoFocus
                />
                {draft.fecha_limite && (
                  <div className="border-t border-border p-2">
                    <button
                      type="button"
                      onClick={() => {
                        onDraftChange({ fecha_limite: null })
                        setFechaAbierta(false)
                      }}
                      className="w-full rounded-md px-2 py-1.5 text-center text-[12.5px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                    >
                      Quitar fecha
                    </button>
                  </div>
                )}
              </PopoverContent>
            </Popover>
          )}

          {esTarea && (
            <Chip
              relleno={draft.urgente}
              onClick={() => onDraftChange({ urgente: !draft.urgente })}
              aria-pressed={draft.urgente}
              className={
                draft.urgente
                  ? "bg-destructive/[0.12] font-semibold text-red-700 hover:bg-destructive/[0.18] dark:text-red-400"
                  : undefined
              }
            >
              <Flag className="h-[13px] w-[13px]" aria-hidden />
              Urgente
            </Chip>
          )}

          {!draft.referenciaAbierta && (
            <Chip onClick={() => onDraftChange({ referenciaAbierta: true })}>
              <Tag className="h-[13px] w-[13px]" aria-hidden />
              Referencia
            </Chip>
          )}
        </div>

        {/* Pie: a qué buzón va y enviar */}
        <div
          className={cn(
            "mt-3 flex items-center gap-2.5 rounded-b-[15px] border-t border-border bg-primary/[0.04] px-3 py-2.5",
          )}
        >
          <Switch
            checked={draft.notificar}
            onCheckedChange={(checked) => onDraftChange({ notificar: checked })}
            aria-label="Avisar por correo al enviar"
          />
          <span className="min-w-0 text-[12px] leading-[1.35] text-muted-foreground">
            Avisar por correo a
            <br />
            <span className="font-semibold text-foreground">{descripcionCorreo}</span>
          </span>
          <span className="flex-1" />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!puedeEnviar}
            title="Enviar (Intro)"
            className={cn(
              "inline-flex h-[34px] shrink-0 items-center gap-1.5 rounded-[10px] px-3.5 text-[13px] font-semibold",
              "bg-primary text-primary-foreground transition-colors duration-150 hover:bg-primary/90",
              "disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground/60",
            )}
          >
            {enviando ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <>
                Enviar
                <ArrowUp className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
              </>
            )}
          </button>
        </div>
      </div>

      <p className="mt-1.5 px-1.5 text-[10.5px] leading-none text-muted-foreground/70">
        Intro para enviar · Mayús+Intro para otra línea
      </p>
    </div>
  )
}
