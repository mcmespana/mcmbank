"use client"

import { useCallback, useMemo, useState } from "react"
import { CheckCheck, ClipboardList, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Aviso, AvisoContadores } from "@/lib/types/avisos"
import { AvisoComposer, type AvisoDraft } from "./aviso-composer"
import { AvisoItem } from "./aviso-item"

type Pestana = "pendientes" | "hechas"

interface AvisosPanelProps {
  delegacionNombre: string
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
  onCargarHechos: () => Promise<void> | void
  onClose: () => void
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>
}

export function AvisosPanel({
  delegacionNombre,
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
  onCargarHechos,
  onClose,
  textareaRef,
}: AvisosPanelProps) {
  const [pestana, setPestana] = useState<Pestana>("pendientes")

  const cambiarPestana = useCallback(
    (siguiente: Pestana) => {
      setPestana(siguiente)
      if (siguiente === "hechas") void onCargarHechos()
    },
    [onCargarHechos],
  )

  // Lo que no he leído sube arriba; el resto, del más reciente al más antiguo.
  const pendientesOrdenados = useMemo(
    () =>
      [...avisos].sort((a, b) => {
        if (a.noLeido !== b.noLeido) return a.noLeido ? -1 : 1
        return new Date(b.creado_en).getTime() - new Date(a.creado_en).getTime()
      }),
    [avisos],
  )

  const lista = pestana === "pendientes" ? pendientesOrdenados : hechos
  const cargando = pestana === "pendientes" ? loading : loadingHechos

  return (
    <div
      role="dialog"
      aria-label="Avisos y tareas"
      className={cn(
        "flex max-h-[min(78vh,620px)] flex-col overflow-hidden rounded-3xl",
        "border border-border/60 bg-card/95 backdrop-blur-2xl",
        "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_28px_-8px_rgba(0,0,0,0.16),0_32px_60px_-24px_rgba(0,0,0,0.22)]",
      )}
    >
      {/* Cabecera */}
      <div className="flex items-start justify-between gap-2 px-4 pb-1 pt-3.5 duration-200 animate-in fade-in-0">
        <div className="min-w-0">
          <h2 className="text-[13px] font-semibold leading-none tracking-tight text-balance">Avisos y tareas</h2>
          <p className="mt-1 truncate text-[11px] leading-none text-muted-foreground">{delegacionNombre}</p>
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
              "relative flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/70",
              "before:absolute before:-inset-[6.5px] before:content-['']",
              "transition-[background-color,color,transform] duration-150 hover:bg-muted hover:text-foreground active:scale-[0.96]",
            )}
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* Pestañas */}
      <div className="flex items-center gap-1 px-3 pb-1.5 pt-2 duration-200 animate-in fade-in-0 slide-in-from-bottom-1">
        {(
          [
            { id: "pendientes" as const, label: "Pendientes", count: avisos.length },
            { id: "hechas" as const, label: "Hechas", count: null },
          ] satisfies { id: Pestana; label: string; count: number | null }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => cambiarPestana(tab.id)}
            aria-pressed={pestana === tab.id}
            className={cn(
              "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11.5px] font-medium",
              "transition-[background-color,color] duration-150",
              pestana === tab.id
                ? "bg-muted text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {tab.label}
            {tab.count !== null && tab.count > 0 && (
              <span className="tabular-nums text-muted-foreground/70">{tab.count}</span>
            )}
          </button>
        ))}
        {contadores.pendientes > 0 && (
          <span className="ml-auto inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-2 py-[3px] text-[10.5px] font-medium text-amber-700 dark:text-amber-400">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="tabular-nums">{contadores.pendientes}</span> para ti
          </span>
        )}
      </div>

      {/* Compositor */}
      {puedeEscribir && (
        <div className="duration-200 animate-in fade-in-0 slide-in-from-bottom-1 delay-75 fill-mode-backwards">
          <AvisoComposer
            draft={draft}
            onDraftChange={onDraftChange}
            onSubmit={onSubmit}
            enviando={enviando}
            textareaRef={textareaRef}
          />
        </div>
      )}

      <div className="mx-3 h-px bg-border/60" aria-hidden />

      {/* Lista */}
      <div className="scrollbar-thin flex-1 overflow-y-auto overscroll-contain px-1.5 py-1.5 duration-200 animate-in fade-in-0 delay-150 fill-mode-backwards">
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
            <p className="text-[12.5px] font-medium text-foreground/80">
              {pestana === "pendientes" ? "Nada pendiente por aquí" : "Todavía no hay nada hecho"}
            </p>
            <p className="text-pretty text-[11.5px] leading-snug text-muted-foreground">
              {pestana === "pendientes"
                ? "Apunta una tarea o deja una nota de lo que habéis tocado."
                : "Lo que marquéis como hecho aparecerá aquí."}
            </p>
          </div>
        ) : (
          <div className="flex flex-col">
            {lista.map((aviso) => (
              <AvisoItem
                key={aviso.id}
                aviso={aviso}
                puedeEscribir={puedeEscribir}
                onCompletar={onCompletar}
                onReabrir={onReabrir}
                onEliminar={onEliminar}
                onMarcarLeido={onMarcarLeido}
                onNotificar={onNotificar}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
