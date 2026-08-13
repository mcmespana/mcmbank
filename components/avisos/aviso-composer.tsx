"use client"

import { useEffect, useRef, useState } from "react"
import { es } from "date-fns/locale"
import {
  ArrowUp,
  Building2,
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  Flag,
  Loader2,
  Plus,
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
  fecha_limite: null,
  urgente: false,
}

interface AvisoComposerProps {
  draft: AvisoDraft
  onDraftChange: (cambios: Partial<AvisoDraft>) => void
  onSubmit: () => void
  enviando: boolean
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

function Chip({
  active,
  dashed,
  onClick,
  children,
  className,
}: {
  active?: boolean
  dashed?: boolean
  onClick?: () => void
  children: React.ReactNode
  className?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[12px] font-medium transition-colors duration-150",
        dashed ? "border border-dashed border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground" : "",
        !dashed && !active && "bg-muted text-muted-foreground hover:text-foreground",
        active && "bg-primary/10 text-primary hover:bg-primary/15",
        className,
      )}
    >
      {children}
    </button>
  )
}

export function AvisoComposer({
  draft,
  onDraftChange,
  onSubmit,
  enviando,
  descripcionCorreo,
  onCargarAsignables,
  textareaRef,
}: AvisoComposerProps) {
  const internalRef = useRef<HTMLTextAreaElement | null>(null)
  const ref = textareaRef ?? internalRef
  const referenciaRef = useRef<HTMLInputElement | null>(null)
  const contenedorRef = useRef<HTMLDivElement | null>(null)

  // "Reposo" solo cuando no hay nada que perder: si hay texto o metadatos
  // (por ejemplo, un borrador recuperado de localStorage tras hidratar) el
  // compositor se muestra abierto sin esperar a que el usuario haga clic.
  const [expandidoManual, setExpandidoManual] = useState(false)
  const [destinoAbierto, setDestinoAbierto] = useState(false)
  const [responsableAbierto, setResponsableAbierto] = useState(false)
  const [fechaAbierta, setFechaAbierta] = useState(false)
  const [asignables, setAsignables] = useState<AvisoAsignable[]>([])
  const [cargandoAsignables, setCargandoAsignables] = useState(false)

  const esTarea = draft.tipo === "tarea"
  const puedeEnviar = draft.contenido.trim().length > 0 && !enviando
  const tieneMetadatos = Boolean(draft.referencia || draft.responsable_id || draft.fecha_limite || draft.urgente)
  const expandido = expandidoManual || Boolean(draft.contenido.trim()) || tieneMetadatos

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

  // Se carga al abrir el popover (no en un efecto): es una reacción directa al
  // clic del usuario, no una sincronización con el render.
  const abrirResponsablePicker = (siguiente: boolean) => {
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

  const handleBlurContenedor = () => {
    // Los popovers (destinatario, responsable, fecha) se pintan en un portal
    // fuera de este contenedor, así que el foco puede "salir" del DOM sin que
    // el usuario haya abandonado el compositor. Se comprueba en el siguiente
    // tick, cuando el nuevo elemento activo ya está asentado.
    setTimeout(() => {
      if (destinoAbierto || responsableAbierto || fechaAbierta) return
      if (contenedorRef.current?.contains(document.activeElement)) return
      if (draft.contenido.trim() || tieneMetadatos) return
      setExpandidoManual(false)
    }, 0)
  }

  const responsableActual = draft.responsable_id
    ? asignables.find((a) => a.id === draft.responsable_id)?.nombre
    : null

  if (!expandido) {
    return (
      <div className="px-2.5 pb-2.5">
        <button
          type="button"
          onClick={abrir}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-2xl border border-dashed border-border px-3.5 py-3 text-left text-[13.5px] text-muted-foreground",
            "transition-colors duration-150 hover:border-foreground/25 hover:text-foreground",
          )}
        >
          <Plus className="h-4 w-4 shrink-0" aria-hidden />
          Escribir un aviso…
        </button>
      </div>
    )
  }

  return (
    <div className="px-2.5 pb-2.5" ref={contenedorRef} onBlur={handleBlurContenedor}>
      <div
        className={cn(
          "rounded-2xl border border-primary/45 bg-background/70",
          "shadow-[0_0_0_3.5px_hsl(var(--primary)/0.10)]",
        )}
      >
        {/* Tipo + destinatario */}
        <div className="flex items-center gap-1 px-2.5 pt-2.5">
          <div className="flex rounded-lg bg-muted/70 p-[2px]">
            <button
              type="button"
              onClick={() => onDraftChange({ tipo: "tarea" })}
              aria-pressed={draft.tipo === "tarea"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold",
                "transition-[background-color,color] duration-150",
                draft.tipo === "tarea"
                  ? "bg-amber-500/15 text-amber-700 dark:text-amber-400"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Tarea
            </button>
            <button
              type="button"
              onClick={() => onDraftChange({ tipo: "nota" })}
              aria-pressed={draft.tipo === "nota"}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11.5px] font-semibold",
                "transition-[background-color,color] duration-150",
                draft.tipo === "nota"
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              Nota
            </button>
          </div>

          <div className="flex-1" />

          <Popover open={destinoAbierto} onOpenChange={setDestinoAbierto}>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1.5 whitespace-nowrap rounded-lg border border-border px-2 text-[11.5px] font-medium text-foreground transition-colors duration-150 hover:bg-muted"
              >
                {DESTINATARIO_OPCIONES.find((o) => o.value === draft.destinatario)?.label}
                <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
              </button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-56 p-1">
              {DESTINATARIO_OPCIONES.map((opcion) => {
                const Icono = opcion.icono
                const activo = draft.destinatario === opcion.value
                return (
                  <button
                    key={opcion.value}
                    type="button"
                    onClick={() => {
                      onDraftChange({ destinatario: opcion.value })
                      setDestinoAbierto(false)
                    }}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]",
                      "transition-colors duration-150 hover:bg-muted",
                      activo && "font-medium text-foreground",
                    )}
                  >
                    <Icono className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                    <span className="flex-1">{opcion.label}</span>
                    {activo && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
                  </button>
                )
              })}
            </PopoverContent>
          </Popover>
        </div>

        <textarea
          ref={ref}
          rows={1}
          value={draft.contenido}
          maxLength={AVISO_MAX_CONTENIDO}
          onChange={(event) => onDraftChange({ contenido: event.target.value })}
          onKeyDown={handleKeyDown}
          placeholder={PLACEHOLDERS[draft.tipo]}
          aria-label={draft.tipo === "tarea" ? "Nueva tarea" : "Nueva nota"}
          className={cn(
            "block w-full resize-none bg-transparent px-3 pt-2 text-[13.5px] leading-[1.5]",
            "outline-none placeholder:text-muted-foreground/60",
            "scrollbar-thin",
          )}
        />

        {draft.referenciaAbierta && (
          <div className="flex items-center gap-1.5 px-3 pt-1.5">
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

        {/* Chips opcionales: solo tienen sentido en tareas */}
        <div className="flex flex-wrap items-center gap-1.5 px-2.5 pt-2">
          {esTarea && (
            <Popover open={responsableAbierto} onOpenChange={abrirResponsablePicker}>
              <PopoverTrigger asChild>
                <Chip active={Boolean(draft.responsable_id)} dashed={!draft.responsable_id}>
                  <User className="h-3 w-3" aria-hidden />
                  {draft.responsable_id ? (
                    <>
                      Responsable <span className="font-semibold">{responsableActual ?? "…"}</span>
                    </>
                  ) : (
                    "Responsable"
                  )}
                </Chip>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-56 p-1">
                {cargandoAsignables ? (
                  <div className="flex items-center justify-center gap-2 py-4 text-[12px] text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    Cargando…
                  </div>
                ) : asignables.length === 0 ? (
                  <p className="px-2 py-3 text-[12px] text-muted-foreground">
                    No hay nadie a quien asignar todavía.
                  </p>
                ) : (
                  <>
                    {asignables.map((persona) => (
                      <button
                        key={persona.id}
                        type="button"
                        onClick={() => {
                          onDraftChange({ responsable_id: persona.id })
                          setResponsableAbierto(false)
                        }}
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]",
                          "transition-colors duration-150 hover:bg-muted",
                          draft.responsable_id === persona.id && "font-medium",
                        )}
                      >
                        <span className="flex-1 truncate">{persona.nombre}</span>
                        {draft.responsable_id === persona.id && (
                          <Check className="h-3.5 w-3.5 text-primary" aria-hidden />
                        )}
                      </button>
                    ))}
                    {draft.responsable_id && (
                      <button
                        type="button"
                        onClick={() => {
                          onDraftChange({ responsable_id: null })
                          setResponsableAbierto(false)
                        }}
                        className="mt-0.5 flex w-full items-center gap-2 rounded-md border-t border-border px-2 py-1.5 pt-2 text-left text-[12.5px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
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
                <Chip active={Boolean(draft.fecha_limite)} dashed={!draft.fecha_limite}>
                  <CalendarIcon className="h-3 w-3" aria-hidden />
                  {draft.fecha_limite ? `Antes del ${formatFechaLimiteCorta(draft.fecha_limite)}` : "Fecha límite"}
                </Chip>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={draft.fecha_limite ? new Date(`${draft.fecha_limite}T12:00:00`) : undefined}
                  defaultMonth={draft.fecha_limite ? new Date(`${draft.fecha_limite}T12:00:00`) : new Date()}
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
                  <div className="border-t p-2">
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
              active={draft.urgente}
              dashed={!draft.urgente}
              onClick={() => onDraftChange({ urgente: !draft.urgente })}
              className={draft.urgente ? "bg-destructive/10 text-destructive hover:bg-destructive/15" : undefined}
            >
              <Flag className="h-3 w-3" aria-hidden />
              Urgente
            </Chip>
          )}

          {!draft.referenciaAbierta && (
            <Chip dashed onClick={() => onDraftChange({ referenciaAbierta: true })}>
              <Tag className="h-3 w-3" aria-hidden />
              Referencia
            </Chip>
          )}
        </div>

        {/* Pie: avisar por correo + enviar */}
        <div className="mt-2.5 flex items-center gap-2.5 rounded-b-2xl border-t border-border/70 bg-primary/[0.03] px-3 py-2.5">
          <Switch
            checked={draft.notificar}
            onCheckedChange={(checked) => onDraftChange({ notificar: checked })}
            aria-label="Avisar por correo al enviar"
          />
          <span className="min-w-0 text-[11.5px] leading-[1.35] text-muted-foreground">
            Avisar por correo a
            <br />
            <span className="font-semibold text-foreground">{descripcionCorreo}</span>
          </span>
          <div className="flex-1" />
          <button
            type="button"
            onClick={onSubmit}
            disabled={!puedeEnviar}
            title="Enviar (Intro)"
            className={cn(
              "inline-flex h-[34px] items-center gap-1.5 rounded-[10px] bg-primary px-3.5 text-[13px] font-semibold text-primary-foreground",
              "transition-[background-color,opacity] duration-150 hover:bg-primary/90",
              "disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground/50",
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
