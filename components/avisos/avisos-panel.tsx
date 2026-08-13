"use client"

import { useCallback, useMemo, useState } from "react"
import { ArrowLeftRight, CheckCheck, ChevronLeft, ClipboardList, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type {
  Aviso,
  AvisoAsignable,
  AvisoCambios,
  AvisoContadores,
  AvisoDestinatario,
} from "@/lib/types/avisos"
import { descripcionDestinoCorreo } from "./utils"
import { AvisoComposer, type AvisoDraft } from "./aviso-composer"
import { AvisoItem } from "./aviso-item"

type Pestana = "para_delegacion" | "para_oficina" | "hechas"

interface AvisosPanelProps {
  delegacionNombre: string
  /** Lado del usuario en esta delegación: define el lenguaje de cabecera y filtros. */
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

  // Sin leer arriba; luego lo urgente; luego de más reciente a más antiguo.
  const ordenar = (lista: Aviso[]) =>
    [...lista].sort((a, b) => {
      if (a.noLeido !== b.noLeido) return a.noLeido ? -1 : 1
      if (a.urgente !== b.urgente) return a.urgente ? -1 : 1
      return new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
    })

  // Los filtros separan por la dirección del aviso, no por quién lo escribió.
  const paraDelegacion = useMemo(
    () => ordenar(avisos.filter((a) => a.destinatario === "delegacion")),
    [avisos],
  )
  const paraOficina = useMemo(
    () => ordenar(avisos.filter((a) => a.destinatario === "oficina_tecnica")),
    [avisos],
  )

  const soyOficina = miLado === "oficina_tecnica"
  const tabs: { id: Pestana; label: string; count: number | null }[] = [
    {
      id: "para_delegacion",
      label: soyOficina ? "Para vosotros" : "Para nosotros",
      count: paraDelegacion.length,
    },
    {
      id: "para_oficina",
      label: soyOficina ? "Enviados" : "Pedido a la oficina",
      count: paraOficina.length,
    },
    { id: "hechas", label: "Hechas", count: null },
  ]

  const lista =
    pestana === "para_delegacion" ? paraDelegacion : pestana === "para_oficina" ? paraOficina : hechos
  const cargando = pestana === "hechas" ? loadingHechos : loading

  const miLadoLabel = soyOficina ? "Oficina técnica" : delegacionNombre
  const otroLadoLabel = soyOficina ? delegacionNombre : "Oficina técnica"
  const destinoNombre =
    draft.destinatario === "delegacion" ? delegacionNombre : "la oficina técnica"

  const asignar = useCallback(
    (id: string, responsableId: string | null) =>
      onActualizarCambios(id, { responsable_id: responsableId }),
    [onActualizarCambios],
  )

  return (
    <div
      role="dialog"
      aria-label="Avisos y tareas"
      className={cn(
        "flex h-full w-full flex-col overflow-hidden bg-card",
        "sm:h-auto sm:max-h-[min(80vh,680px)] sm:rounded-3xl sm:border sm:border-border",
        "sm:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_18px_40px_-12px_rgba(0,0,0,0.18),0_40px_80px_-32px_rgba(0,0,0,0.26)]",
      )}
    >
      {/* Cabecera */}
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-4 py-3.5 sm:px-5 sm:pb-3.5 sm:pt-[18px]">
        <div className="flex min-w-0 items-center gap-1 sm:gap-0">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-ml-2.5 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-foreground transition-colors duration-150 hover:bg-muted sm:hidden"
          >
            <ChevronLeft className="h-[22px] w-[22px]" aria-hidden />
          </button>
          <div className="flex min-w-0 flex-col gap-1.5">
            <h2 className="text-[17px] font-semibold leading-[1.1] tracking-[-0.01em] sm:text-[16px] sm:leading-[1.2]">
              Avisos y tareas
            </h2>
            <div className="flex items-center gap-[7px] text-[12px] leading-none text-muted-foreground">
              <span className="truncate font-medium text-foreground">{miLadoLabel}</span>
              <ArrowLeftRight className="h-[13px] w-[13px] shrink-0" aria-hidden />
              <span className="truncate font-medium text-foreground">{otroLadoLabel}</span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          {contadores.noLeidos > 0 && (
            <button
              type="button"
              onClick={() => void onMarcarTodoLeido()}
              title="Marcar todo como leído"
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium text-muted-foreground",
                "transition-colors duration-150 hover:bg-muted hover:text-foreground",
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
              "relative hidden h-7 w-7 items-center justify-center rounded-lg text-muted-foreground sm:flex",
              "before:absolute before:-inset-[6.5px] before:content-['']",
              "transition-colors duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96]",
            )}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Filtros por dirección */}
      <div className="scrollbar-none flex shrink-0 items-center gap-1.5 overflow-x-auto px-4 pb-2.5 pt-3">
        {tabs.map((tab) => {
          const activa = pestana === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => cambiarPestana(tab.id)}
              aria-pressed={activa}
              className={cn(
                "inline-flex h-[34px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 text-[13px]",
                "transition-colors duration-150 sm:h-[30px] sm:px-3 sm:text-[12.5px]",
                activa
                  ? "bg-foreground font-medium text-background"
                  : "bg-muted font-medium text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
              {tab.count !== null && tab.count > 0 && (
                <span
                  className={cn(
                    "inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1.5",
                    "text-[11px] font-semibold tabular-nums leading-none",
                    activa ? "bg-background/25 text-background" : "text-muted-foreground/70",
                  )}
                >
                  {tab.count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Compositor: en móvil se ancla abajo, en escritorio va sobre la lista */}
      {puedeEscribir && (
        <div
          className={cn(
            "order-last shrink-0 border-t border-border bg-background pt-3.5",
            "pb-[max(1rem,env(safe-area-inset-bottom))]",
            "sm:order-none sm:border-t-0 sm:bg-transparent sm:pb-0 sm:pt-0",
          )}
        >
          <AvisoComposer
            draft={draft}
            onDraftChange={onDraftChange}
            onSubmit={onSubmit}
            enviando={enviando}
            destinoNombre={destinoNombre}
            descripcionCorreo={descripcionDestinoCorreo(draft.destinatario, delegacionNombre)}
            onCargarAsignables={onCargarAsignables}
            textareaRef={textareaRef}
          />
        </div>
      )}

      {/* Lista */}
      <div className="scrollbar-thin flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-0.5 sm:pb-[18px]">
        {error && (
          <p className="my-2 rounded-xl bg-destructive/10 px-3 py-2 text-[12px] leading-snug text-destructive">
            {error}
          </p>
        )}

        {cargando && lista.length === 0 ? (
          <div className="flex items-center justify-center gap-2 py-12 text-[12.5px] text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Cargando…
          </div>
        ) : lista.length === 0 ? (
          <div className="flex flex-col items-center gap-1.5 px-6 py-12 text-center">
            <ClipboardList className="h-5 w-5 text-muted-foreground/40" aria-hidden />
            <p className="text-[13px] font-medium text-foreground/80">
              {pestana === "hechas" ? "Todavía no hay nada hecho" : "Nada por aquí"}
            </p>
            <p className="text-pretty text-[12px] leading-snug text-muted-foreground">
              {pestana === "hechas"
                ? "Lo que marquéis como hecho aparecerá aquí."
                : "Cuando haya algo en esta dirección, aparecerá aquí."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2.5 sm:gap-2">
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
