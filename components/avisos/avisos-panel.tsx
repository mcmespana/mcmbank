"use client"

import { useCallback, useMemo, useState } from "react"
import { ArrowLeftRight, CheckCheck, ChevronLeft, ClipboardList, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Aviso, AvisoAsignable, AvisoCambios, AvisoContadores, AvisoDestinatario } from "@/lib/types/avisos"
import { descripcionDestinoCorreo } from "./utils"
import { AvisoComposer, type AvisoDraft } from "./aviso-composer"
import { AvisoItem } from "./aviso-item"

type Pestana = "para_delegacion" | "para_oficina" | "hechas"

interface AvisosPanelProps {
  delegacionNombre: string
  /** Lado del usuario en esta delegación: define el lenguaje de cabecera y pestañas. */
  miLado: AvisoDestinatario
  avisos: Aviso[]
  hechos: Aviso[]
  loading: boolean
  loadingHechos: boolean
  error: string | null
  contadores: AvisoContadores
  puedeEscribir: boolean
  draft: AvisoDraft
  enviando: boolean
  onDraftChange: (cambios: Partial<AvisoDraft>) => void
  onSubmit: () => void
  onCompletar: (id: string) => Promise<void> | void
  onReabrir: (id: string) => Promise<void> | void
  onEliminar: (id: string) => Promise<void> | void
  onMarcarLeido: (id: string) => Promise<void> | void
  onMarcarTodoLeido: () => Promise<void> | void
  onNotificar: (id: string) => Promise<void> | void
  onActualizarCambios: (id: string, cambios: AvisoCambios) => Promise<void>
  onCargarAsignables: (destinatario: AvisoDestinatario) => Promise<AvisoAsignable[]>
  onCargarHechos: () => Promise<void> | void
  onClose: () => void
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
}

export function AvisosPanel({
  delegacionNombre,
  miLado,
  avisos,
  hechos,
  loading,
  loadingHechos,
  error,
  contadores,
  puedeEscribir,
  draft,
  enviando,
  onDraftChange,
  onSubmit,
  onCompletar,
  onReabrir,
  onEliminar,
  onMarcarLeido,
  onMarcarTodoLeido,
  onNotificar,
  onActualizarCambios,
  onCargarAsignables,
  onCargarHechos,
  onClose,
  textareaRef,
}: AvisosPanelProps) {
  const [pestana, setPestana] = useState<Pestana>("para_delegacion")

  const cambiarPestana = useCallback(
    (siguiente: Pestana) => {
      setPestana(siguiente)
      if (siguiente === "hechas") void onCargarHechos()
    },
    [onCargarHechos],
  )

  const ordenar = (lista: Aviso[]) =>
    [...lista].sort((a, b) => {
      if (a.noLeido !== b.noLeido) return a.noLeido ? -1 : 1
      return new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
    })

  // "Para vosotros/nosotros": lo dirigido a la delegación. "Enviados"/"Pedido a
  // la oficina": lo dirigido a la oficina técnica. Da igual quién lo escribió:
  // es la dirección del aviso la que decide en qué pestaña vive.
  const paraDelegacion = useMemo(
    () => ordenar(avisos.filter((a) => a.destinatario === "delegacion")),
    [avisos],
  )
  const paraOficina = useMemo(
    () => ordenar(avisos.filter((a) => a.destinatario === "oficina_tecnica")),
    [avisos],
  )

  const etiquetas =
    miLado === "oficina_tecnica"
      ? { paraDelegacion: "Para vosotros", paraOficina: "Enviados" }
      : { paraDelegacion: "Para nosotros", paraOficina: "Pedido a la oficina" }

  const tabs: { id: Pestana; label: string; count: number }[] = [
    { id: "para_delegacion", label: etiquetas.paraDelegacion, count: paraDelegacion.length },
    { id: "para_oficina", label: etiquetas.paraOficina, count: paraOficina.length },
    { id: "hechas", label: "Hechas", count: 0 },
  ]

  const lista = pestana === "para_delegacion" ? paraDelegacion : pestana === "para_oficina" ? paraOficina : hechos
  const cargando = pestana === "hechas" ? loadingHechos : loading

  const miLadoLabel = miLado === "oficina_tecnica" ? "Oficina técnica" : delegacionNombre
  const otroLadoLabel = miLado === "oficina_tecnica" ? delegacionNombre : "Oficina técnica"

  const asignar = useCallback(
    (id: string, responsableId: string | null) => onActualizarCambios(id, { responsable_id: responsableId }),
    [onActualizarCambios],
  )

  const vacioTitulo = pestana === "hechas" ? "Todavía no hay nada hecho" : "Nada por aquí"
  const vacioTexto =
    pestana === "hechas"
      ? "Lo que marquéis como hecho aparecerá aquí."
      : "Cuando haya algo en esta dirección, aparecerá aquí."

  return (
    <div
      role="dialog"
      aria-label="Avisos y tareas"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden bg-card",
        "sm:h-auto sm:max-h-[min(78vh,620px)] sm:rounded-3xl sm:border sm:border-border/60 sm:bg-card/95 sm:backdrop-blur-2xl",
        "sm:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_28px_-8px_rgba(0,0,0,0.16),0_32px_60px_-24px_rgba(0,0,0,0.22)]",
      )}
    >
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-2 border-b border-border/60 px-4 py-3.5 duration-200 animate-in fade-in-0 sm:border-b-0 sm:pb-1 sm:pt-3.5">
        <div className="flex min-w-0 items-center gap-1 sm:gap-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar (Esc)"
            className="relative -ml-2 mr-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-foreground transition-colors duration-150 hover:bg-muted sm:hidden"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </button>
          <div className="min-w-0">
            <h2 className="text-[14px] font-semibold leading-none tracking-tight text-balance sm:text-[13px]">
              Avisos y tareas
            </h2>
            <div className="mt-1.5 flex items-center gap-1.5 text-[11.5px] leading-none text-muted-foreground sm:mt-1">
              <span className="truncate font-medium text-foreground/80">{miLadoLabel}</span>
              <ArrowLeftRight className="h-3 w-3 shrink-0" aria-hidden />
              <span className="truncate font-medium text-foreground/80">{otroLadoLabel}</span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          {contadores.noLeidos > 0 && (
            <button
              type="button"
              onClick={() => void onMarcarTodoLeido()}
              title="Marcar todo como leído"
              className={cn(
                "relative inline-flex items-center gap-1 rounded-lg px-1.5 py-1 text-[11px] font-medium text-muted-foreground",
                "transition-[background-color,color] duration-150 hover:bg-muted hover:text-foreground",
              )}
            >
              <CheckCheck className="h-3.5 w-3.5" aria-hidden />
              <span className="hidden sm:inline">Marcar leído</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            title="Cerrar (Esc)"
            aria-label="Cerrar"
            className={cn(
              "relative hidden h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/70 sm:flex",
              "before:absolute before:-inset-[6.5px] before:content-['']",
              "transition-[background-color,color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96]",
            )}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex items-center gap-1 overflow-x-auto px-3 pb-1.5 pt-2 duration-200 animate-in fade-in-0 slide-in-from-bottom-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => cambiarPestana(tab.id)}
            aria-pressed={pestana === tab.id}
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[12px] font-medium sm:px-2 sm:py-1 sm:text-[11.5px]",
              "transition-[background-color,color] duration-150",
              pestana === tab.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.id !== "hechas" && tab.count > 0 && (
              <span className="tabular-nums text-muted-foreground/70">{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Compositor */}
      {puedeEscribir && (
        <div className="duration-200 animate-in fade-in-0 slide-in-from-bottom-1 delay-75 fill-mode-backwards">
          <AvisoComposer
            draft={draft}
            onDraftChange={onDraftChange}
            onSubmit={onSubmit}
            enviando={enviando}
            descripcionCorreo={descripcionDestinoCorreo(draft.destinatario, delegacionNombre)}
            onCargarAsignables={onCargarAsignables}
            textareaRef={textareaRef}
          />
        </div>
      )}

      <div className="mx-3 h-px bg-border/60" aria-hidden />

      {/* Lista */}
      <div className="scrollbar-thin flex-1 overflow-y-auto overscroll-contain px-2 py-2 duration-200 animate-in fade-in-0 delay-150 fill-mode-backwards sm:px-1.5 sm:py-1.5">
        {error && (
          <p className="mx-2 my-3 rounded-xl bg-destructive/10 px-3 py-2 text-[12px] leading-snug text-destructive">
            {error}
          </p>
        )}

        {cargando && lista.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Cargando…
          </div>
        ) : lista.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
            <ClipboardList className="h-5 w-5 text-muted-foreground/40" aria-hidden />
            <p className="text-[12.5px] font-medium text-foreground/80">{vacioTitulo}</p>
            <p className="text-pretty text-[11.5px] leading-snug text-muted-foreground">{vacioTexto}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {lista.map((aviso) => (
              <AvisoItem
                key={aviso.id}
                aviso={aviso}
                puedeEscribir={puedeEscribir}
                delegacionNombre={delegacionNombre}
                miLado={miLado}
                onCompletar={onCompletar}
                onReabrir={onReabrir}
                onEliminar={onEliminar}
                onMarcarLeido={onMarcarLeido}
                onNotificar={onNotificar}
                onAsignar={asignar}
                onCargarAsignables={onCargarAsignables}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
