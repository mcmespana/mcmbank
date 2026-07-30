"use client"

import { useEffect, useRef, useState } from "react"
import { Archive, ArrowUpLeft, Bell, BellRing, Check, Loader2, Trash2 } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Aviso } from "@/lib/types/avisos"
import { AVISO_DESTINATARIO_LABELS } from "@/lib/types/avisos"
import { formatFechaCompleta, formatRelativoCorto, primerNombre } from "./utils"

interface AvisoItemProps {
  aviso: Aviso
  puedeEscribir: boolean
  onCompletar: (id: string) => Promise<void> | void
  onReabrir: (id: string) => Promise<void> | void
  onEliminar: (id: string) => Promise<void> | void
  onMarcarLeido: (id: string) => Promise<void> | void
  onNotificar: (id: string) => Promise<void> | void
}

/** Botón de icono discreto con área de pulsación de 40×40 vía pseudoelemento. */
function AccionIcono({
  label,
  onClick,
  children,
  className,
  disabled,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
  className?: string
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation()
        onClick()
      }}
      className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground/70",
        "before:absolute before:-inset-1 before:content-['']",
        "transition-[color,background-color,transform] duration-150",
        "hover:bg-muted hover:text-foreground active:scale-[0.96]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background",
        "disabled:pointer-events-none disabled:opacity-40",
        className,
      )}
    >
      {children}
    </button>
  )
}

export function AvisoItem({
  aviso,
  puedeEscribir,
  onCompletar,
  onReabrir,
  onEliminar,
  onMarcarLeido,
  onNotificar,
}: AvisoItemProps) {
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)
  const [ocupado, setOcupado] = useState<"completar" | "notificar" | null>(null)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
    }
  }, [])

  const esTarea = aviso.tipo === "tarea"
  const hecha = aviso.estado === "hecha"
  const autor = primerNombre(aviso.autorNombre)
  const notificado = Boolean(aviso.notificado_en)

  const pedirBorrado = () => {
    if (confirmandoBorrado) {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
      setConfirmandoBorrado(false)
      void onEliminar(aviso.id)
      return
    }
    setConfirmandoBorrado(true)
    confirmTimer.current = setTimeout(() => setConfirmandoBorrado(false), 3000)
  }

  const completar = async () => {
    setOcupado("completar")
    try {
      await onCompletar(aviso.id)
    } finally {
      setOcupado(null)
    }
  }

  const notificar = async () => {
    setOcupado("notificar")
    try {
      await onNotificar(aviso.id)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div
      onClick={aviso.noLeido ? () => onMarcarLeido(aviso.id) : undefined}
      className={cn(
        "group relative flex gap-2.5 rounded-2xl px-2.5 py-2.5",
        "transition-[background-color] duration-150",
        aviso.noLeido && "bg-primary/[0.055] dark:bg-primary/[0.09]",
        aviso.noLeido ? "hover:bg-primary/[0.09] cursor-pointer" : "hover:bg-muted/60",
      )}
    >
      {/* Marca de no leído: punto en el borde izquierdo */}
      {aviso.noLeido && (
        <span
          aria-label="Sin leer"
          className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-primary"
        />
      )}

      {/* Control principal: casilla en tareas, punto de color en notas */}
      {esTarea && !hecha ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            void completar()
          }}
          title="Marcar como hecha"
          aria-label="Marcar como hecha"
          disabled={!puedeEscribir || ocupado === "completar"}
          className={cn(
            "relative mt-[3px] flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full",
            "border-[1.5px] border-amber-500/60 text-transparent",
            "before:absolute before:-inset-[11px] before:content-['']",
            "transition-[background-color,border-color,color,transform] duration-150",
            "hover:border-amber-500 hover:bg-amber-500/10 hover:text-amber-600 active:scale-[0.96]",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/50 focus-visible:ring-offset-1 focus-visible:ring-offset-background",
            "disabled:pointer-events-none disabled:opacity-50",
          )}
        >
          {ocupado === "completar" ? (
            <Loader2 className="h-3 w-3 animate-spin text-amber-600" />
          ) : (
            <Check className="h-3 w-3" strokeWidth={3} />
          )}
        </button>
      ) : (
        <span
          aria-hidden
          className={cn(
            "mt-[7px] h-[9px] w-[9px] shrink-0 rounded-full",
            hecha ? "bg-emerald-500/70" : "bg-primary/70",
          )}
        />
      )}

      {/* Contenido */}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            "whitespace-pre-wrap break-words text-[13px] leading-[1.5] text-pretty",
            aviso.noLeido ? "font-medium text-foreground" : "text-foreground/90",
            hecha && "text-muted-foreground line-through decoration-muted-foreground/40",
          )}
        >
          {aviso.contenido}
        </p>

        <div className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11px] leading-none text-muted-foreground">
          {aviso.referencia && (
            <span className="inline-flex max-w-[160px] items-center truncate rounded-md bg-muted px-1.5 py-[3px] font-medium text-foreground/70">
              {aviso.referencia}
            </span>
          )}
          <span className="truncate">{autor ?? "Alguien"}</span>
          <span aria-hidden className="text-muted-foreground/40">
            ·
          </span>
          <span title={formatFechaCompleta(aviso.creado_en)} className="tabular-nums">
            {formatRelativoCorto(aviso.creado_en)}
          </span>
          <span aria-hidden className="text-muted-foreground/40">
            ·
          </span>
          <span className={cn(aviso.esParaMi && "text-foreground/70")}>
            {aviso.esParaMi ? "para ti" : `para ${AVISO_DESTINATARIO_LABELS[aviso.destinatario].toLowerCase()}`}
          </span>
          {notificado && (
            <span title={`Avisado por correo · ${formatFechaCompleta(aviso.notificado_en)}`} className="inline-flex items-center gap-1 text-muted-foreground/70">
              <span aria-hidden className="text-muted-foreground/40">
                ·
              </span>
              <BellRing className="h-3 w-3" aria-hidden />
              avisado
            </span>
          )}
        </div>
      </div>

      {/* Acciones: visibles al pasar por encima, siempre en táctil */}
      {puedeEscribir && (
        <div
          className={cn(
            "flex shrink-0 items-start gap-0.5 self-start",
            "opacity-100 transition-opacity duration-150",
            "sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
          )}
        >
          {hecha ? (
            <AccionIcono label="Volver a pendiente" onClick={() => void onReabrir(aviso.id)}>
              <ArrowUpLeft className="h-4 w-4" aria-hidden />
            </AccionIcono>
          ) : (
            <>
              {!esTarea && (
                <AccionIcono label="Archivar nota" onClick={() => void completar()}>
                  <Archive className="h-4 w-4" aria-hidden />
                </AccionIcono>
              )}
              <AccionIcono
                label={notificado ? "Volver a avisar por correo" : "Avisar por correo"}
                onClick={() => void notificar()}
                disabled={ocupado === "notificar"}
                className={notificado ? "text-primary/70" : undefined}
              >
                {ocupado === "notificar" ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : notificado ? (
                  <BellRing className="h-4 w-4" aria-hidden />
                ) : (
                  <Bell className="h-4 w-4" aria-hidden />
                )}
              </AccionIcono>
            </>
          )}
          {aviso.esMio && (
            <AccionIcono
              label={confirmandoBorrado ? "Pulsa otra vez para borrar" : "Borrar"}
              onClick={pedirBorrado}
              className={confirmandoBorrado ? "bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive" : undefined}
            >
              {confirmandoBorrado ? (
                <Check className="h-4 w-4" aria-hidden />
              ) : (
                <Trash2 className="h-4 w-4" aria-hidden />
              )}
            </AccionIcono>
          )}
        </div>
      )}
    </div>
  )
}
