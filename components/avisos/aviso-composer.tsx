"use client"

import { useEffect, useRef } from "react"
import { ArrowUp, Bell, Building2, Loader2, Tag, Users, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AvisoDestinatario, AvisoTipo } from "@/lib/types/avisos"
import { AVISO_MAX_CONTENIDO, AVISO_MAX_REFERENCIA } from "@/lib/types/avisos"

export interface AvisoDraft {
  tipo: AvisoTipo
  destinatario: AvisoDestinatario
  contenido: string
  referencia: string
  notificar: boolean
  referenciaAbierta: boolean
}

export const AVISO_DRAFT_VACIO: AvisoDraft = {
  tipo: "tarea",
  destinatario: "delegacion",
  contenido: "",
  referencia: "",
  notificar: false,
  referenciaAbierta: false,
}

interface AvisoComposerProps {
  draft: AvisoDraft
  onDraftChange: (cambios: Partial<AvisoDraft>) => void
  onSubmit: () => void
  enviando: boolean
  /** Ref al textarea para poder enfocarlo al abrir el panel. */
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
}

const PLACEHOLDERS: Record<AvisoTipo, string> = {
  tarea: "Qué hay que hacer…",
  nota: "Qué queremos contar…",
}

const DESTINATARIO_ICONO: Record<AvisoDestinatario, typeof Building2> = {
  oficina_tecnica: Users,
  delegacion: Building2,
}

const DESTINATARIO_TEXTO: Record<AvisoDestinatario, string> = {
  oficina_tecnica: "Oficina técnica",
  delegacion: "Delegación",
}

export function AvisoComposer({ draft, onDraftChange, onSubmit, enviando, textareaRef }: AvisoComposerProps) {
  const internalRef = useRef<HTMLTextAreaElement | null>(null)
  const ref = textareaRef ?? internalRef
  const referenciaRef = useRef<HTMLInputElement | null>(null)

  // Autoajuste de altura: crece hasta 5 líneas y luego hace scroll.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 124)}px`
  }, [draft.contenido, ref])

  useEffect(() => {
    if (draft.referenciaAbierta) referenciaRef.current?.focus()
  }, [draft.referenciaAbierta])

  const puedeEnviar = draft.contenido.trim().length > 0 && !enviando
  const DestinatarioIcono = DESTINATARIO_ICONO[draft.destinatario]

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault()
      if (puedeEnviar) onSubmit()
    }
  }

  const alternarDestinatario = () =>
    onDraftChange({
      destinatario: draft.destinatario === "delegacion" ? "oficina_tecnica" : "delegacion",
    })

  return (
    <div className="px-2.5 pb-2.5">
      <div
        className={cn(
          "rounded-2xl border border-border/70 bg-background/70",
          "transition-[border-color,box-shadow] duration-150",
          "focus-within:border-primary/45 focus-within:shadow-[0_0_0_3.5px_hsl(var(--primary)/0.10)]",
        )}
      >
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
            "block w-full resize-none bg-transparent px-3 pt-2.5 text-[13px] leading-[1.5]",
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

        <div className="flex items-center gap-1 px-2 pb-2 pt-2">
          {/* Tipo: tarea o nota */}
          <div className="flex rounded-lg bg-muted/70 p-[2px]">
            {(["tarea", "nota"] as const).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => onDraftChange({ tipo })}
                aria-pressed={draft.tipo === tipo}
                className={cn(
                  "rounded-md px-2 py-1 text-[11px] font-medium capitalize",
                  "transition-[background-color,color,box-shadow] duration-150",
                  draft.tipo === tipo
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tipo}
              </button>
            ))}
          </div>

          {/* Destinatario */}
          <button
            type="button"
            onClick={alternarDestinatario}
            title="Cambiar destinatario"
            className={cn(
              "inline-flex min-w-0 items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-muted-foreground",
              "transition-[background-color,color] duration-150 hover:bg-muted hover:text-foreground",
            )}
          >
            <DestinatarioIcono className="h-3 w-3 shrink-0" aria-hidden />
            <span className="truncate">{DESTINATARIO_TEXTO[draft.destinatario]}</span>
          </button>

          <div className="flex-1" />

          {!draft.referenciaAbierta && (
            <button
              type="button"
              onClick={() => onDraftChange({ referenciaAbierta: true })}
              title="Añadir una referencia corta"
              aria-label="Añadir una referencia corta"
              className="relative flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/70 before:absolute before:-inset-[6.5px] before:content-[''] transition-[background-color,color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96]"
            >
              <Tag className="h-[15px] w-[15px]" aria-hidden />
            </button>
          )}

          <button
            type="button"
            onClick={() => onDraftChange({ notificar: !draft.notificar })}
            aria-pressed={draft.notificar}
            title={draft.notificar ? "Se avisará por correo al enviar" : "Avisar por correo al enviar"}
            aria-label="Avisar por correo al enviar"
            className={cn(
              "relative flex h-7 w-7 items-center justify-center rounded-lg",
              "before:absolute before:-inset-[6.5px] before:content-['']",
              "transition-[background-color,color,transform] duration-150 active:scale-[0.96]",
              draft.notificar
                ? "bg-primary/10 text-primary hover:bg-primary/15"
                : "text-muted-foreground/70 hover:bg-muted hover:text-foreground",
            )}
          >
            <Bell className="h-[15px] w-[15px]" aria-hidden />
          </button>

          <button
            type="button"
            onClick={onSubmit}
            disabled={!puedeEnviar}
            title="Enviar (Intro)"
            aria-label="Enviar"
            className={cn(
              "relative flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground",
              "before:absolute before:-inset-[6.5px] before:content-['']",
              "transition-[background-color,opacity,transform] duration-150",
              "hover:bg-primary/90 active:scale-[0.96]",
              "disabled:pointer-events-none disabled:bg-muted disabled:text-muted-foreground/50",
            )}
          >
            {enviando ? (
              <Loader2 className="h-[15px] w-[15px] animate-spin" aria-hidden />
            ) : (
              <ArrowUp className="h-[15px] w-[15px]" strokeWidth={2.5} aria-hidden />
            )}
          </button>
        </div>
      </div>

      <p className="mt-1.5 px-1.5 text-[10.5px] leading-none text-muted-foreground/70">
        Intro para enviar · Mayús+Intro para otra línea
        {draft.notificar && " · se avisará por correo"}
      </p>
    </div>
  )
}
