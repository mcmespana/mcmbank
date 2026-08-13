"use client"

import { useEffect, useRef, useState } from "react"
import {
  Archive,
  ArrowRight,
  ArrowUpLeft,
  Bell,
  BellRing,
  Calendar,
  Check,
  Flag,
  Loader2,
  Mail,
  Trash2,
  User,
  UserPlus,
} from "lucide-react"
import { cn } from "@/lib/utils"
import type { Aviso, AvisoAsignable, AvisoDestinatario } from "@/lib/types/avisos"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  descripcionDestinoCorreo,
  estaVencida,
  formatFechaCompleta,
  formatFechaLimiteCorta,
  formatRelativoCorto,
  ladoLabel,
  primerNombre,
} from "./utils"

interface AvisoItemProps {
  aviso: Aviso
  puedeEscribir: boolean
  delegacionNombre: string
  miLado: AvisoDestinatario
  onCompletar: (id: string) => Promise<void> | void
  onReabrir: (id: string) => Promise<void> | void
  onEliminar: (id: string) => Promise<void> | void
  onMarcarLeido: (id: string) => Promise<void> | void
  onNotificar: (id: string) => Promise<void> | void
  onAsignar: (id: string, responsableId: string | null) => Promise<void> | void
  onCargarAsignables: (destinatario: AvisoDestinatario) => Promise<AvisoAsignable[]>
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
  delegacionNombre,
  miLado,
  onCompletar,
  onReabrir,
  onEliminar,
  onMarcarLeido,
  onNotificar,
  onAsignar,
  onCargarAsignables,
}: AvisoItemProps) {
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)
  const [ocupado, setOcupado] = useState<"completar" | "notificar" | "asignar" | null>(null)
  const [asignarAbierto, setAsignarAbierto] = useState(false)
  const [asignables, setAsignables] = useState<AvisoAsignable[]>([])
  const [cargandoAsignables, setCargandoAsignables] = useState(false)
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (confirmTimer.current) clearTimeout(confirmTimer.current)
    }
  }, [])

  // Se carga al abrir el popover (no en un efecto): es una reacción directa al
  // clic del usuario, no una sincronización con el render.
  const abrirAsignarPicker = (siguiente: boolean) => {
    setAsignarAbierto(siguiente)
    if (!siguiente) return
    setCargandoAsignables(true)
    onCargarAsignables(aviso.destinatario)
      .then(setAsignables)
      .finally(() => setCargandoAsignables(false))
  }

  const esTarea = aviso.tipo === "tarea"
  const esNota = !esTarea
  const hecha = aviso.estado === "hecha"
  const autor = primerNombre(aviso.autorNombre)
  const notificado = Boolean(aviso.notificado_en)
  const vencida = !hecha && estaVencida(aviso.fecha_limite)
  const origenLado: AvisoDestinatario = aviso.destinatario === "delegacion" ? "oficina_tecnica" : "delegacion"

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

  const asignar = async (responsableId: string | null) => {
    setAsignarAbierto(false)
    setOcupado("asignar")
    try {
      await onAsignar(aviso.id, responsableId)
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div
      onClick={aviso.noLeido && esTarea ? () => onMarcarLeido(aviso.id) : undefined}
      className={cn(
        "group relative flex flex-col gap-2.5 rounded-2xl border p-3.5 transition-colors duration-150",
        hecha
          ? "border-border/60 bg-muted/20 opacity-75"
          : aviso.noLeido
            ? cn("border-primary/30 bg-primary/[0.045] dark:bg-primary/[0.08]", esTarea && "cursor-pointer")
            : "border-border/70 bg-card/40 hover:border-border",
      )}
    >
      {/* Badges */}
      <div className="flex items-center gap-1.5">
        <span
          className={cn(
            "inline-flex h-5 items-center rounded-md px-2 text-[10.5px] font-bold uppercase tracking-wide",
            esTarea ? "bg-amber-500/15 text-amber-700 dark:text-amber-400" : "bg-primary/12 text-primary",
          )}
        >
          {esTarea ? "Tarea" : "Nota"}
        </span>

        {esTarea && aviso.urgente && !hecha && (
          <span className="inline-flex h-5 items-center gap-1 rounded-md bg-destructive/12 px-2 text-[10.5px] font-bold uppercase tracking-wide text-destructive">
            <Flag className="h-2.5 w-2.5" aria-hidden />
            Urgente
          </span>
        )}

        <div className="flex-1" />

        {esNota && !hecha && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              if (aviso.noLeido) void onMarcarLeido(aviso.id)
            }}
            className={cn(
              "inline-flex h-6 items-center gap-1.5 rounded-lg border px-2 text-[11.5px] font-medium transition-colors duration-150",
              aviso.noLeido
                ? "border-primary/40 text-primary hover:bg-primary/10"
                : "border-border/70 text-muted-foreground",
            )}
          >
            <Check className="h-3 w-3" aria-hidden />
            Leído
          </button>
        )}

        {esTarea && !hecha && aviso.noLeido && (
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-primary">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
            Sin leer
          </span>
        )}

        {/* Acciones discretas de nota: visibles al pasar por encima */}
        {esNota && puedeEscribir && (
          <div
            className={cn(
              "flex shrink-0 items-center gap-0.5",
              "opacity-100 transition-opacity duration-150",
              "sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
            )}
          >
            {hecha ? (
              <AccionIcono label="Volver a pendiente" onClick={() => void onReabrir(aviso.id)}>
                <ArrowUpLeft className="h-3.5 w-3.5" aria-hidden />
              </AccionIcono>
            ) : (
              <AccionIcono label="Archivar nota" onClick={() => void completar()} disabled={ocupado === "completar"}>
                {ocupado === "completar" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Archive className="h-3.5 w-3.5" aria-hidden />
                )}
              </AccionIcono>
            )}
            <AccionIcono
              label={notificado ? "Volver a avisar por correo" : "Avisar por correo"}
              onClick={() => void notificar()}
              disabled={ocupado === "notificar"}
              className={notificado ? "text-primary/70" : undefined}
            >
              {ocupado === "notificar" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : notificado ? (
                <BellRing className="h-3.5 w-3.5" aria-hidden />
              ) : (
                <Bell className="h-3.5 w-3.5" aria-hidden />
              )}
            </AccionIcono>
            {aviso.esMio && (
              <AccionIcono
                label={confirmandoBorrado ? "Pulsa otra vez para borrar" : "Borrar"}
                onClick={pedirBorrado}
                className={confirmandoBorrado ? "bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive" : undefined}
              >
                {confirmandoBorrado ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Trash2 className="h-3.5 w-3.5" aria-hidden />}
              </AccionIcono>
            )}
          </div>
        )}
      </div>

      {/* Contenido */}
      <p
        className={cn(
          "whitespace-pre-wrap break-words text-[13.5px] leading-[1.5] text-pretty",
          aviso.noLeido && !hecha ? "font-medium text-foreground" : "text-foreground/90",
          hecha && "text-muted-foreground line-through decoration-muted-foreground/40",
        )}
      >
        {aviso.contenido}
      </p>

      {/* Responsable / asignar (solo tareas) */}
      {esTarea && aviso.responsable_id && (
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-xl border p-2.5",
            aviso.esParaMi ? "border-primary/30 bg-primary/[0.06]" : "border-border/70 bg-muted/30",
          )}
        >
          <span
            className={cn(
              "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full",
              aviso.esParaMi ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground",
            )}
          >
            <User className="h-3.5 w-3.5" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-col gap-0.5">
            <span
              className={cn(
                "text-[10px] font-semibold uppercase tracking-wide",
                aviso.esParaMi ? "text-primary" : "text-muted-foreground",
              )}
            >
              {aviso.esParaMi ? "Os lo han asignado a" : "Responsable"}
            </span>
            <span className="truncate text-[13px] font-semibold leading-tight">{aviso.responsableNombre ?? "—"}</span>
          </span>
          <div className="flex-1" />
          {aviso.fecha_limite && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 text-[11.5px] font-semibold",
                vencida || aviso.urgente ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground",
              )}
            >
              <Calendar className="h-3 w-3" aria-hidden />
              {hecha ? formatFechaLimiteCorta(aviso.fecha_limite) : `Antes del ${formatFechaLimiteCorta(aviso.fecha_limite)}`}
            </span>
          )}
        </div>
      )}

      {esTarea && !aviso.responsable_id && !hecha && puedeEscribir && (
        <Popover open={asignarAbierto} onOpenChange={abrirAsignarPicker}>
          <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border p-2.5">
            <span className="flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground">
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="text-[12.5px] text-muted-foreground">Sin responsable asignado</span>
            <div className="flex-1" />
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={ocupado === "asignar"}
                className="shrink-0 text-[12px] font-semibold text-primary hover:underline disabled:opacity-50"
              >
                {ocupado === "asignar" ? "Asignando…" : "Asignar"}
              </button>
            </PopoverTrigger>
          </div>
          <PopoverContent align="end" className="w-56 p-1">
            {cargandoAsignables ? (
              <div className="flex items-center justify-center gap-2 py-4 text-[12px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Cargando…
              </div>
            ) : asignables.length === 0 ? (
              <p className="px-2 py-3 text-[12px] text-muted-foreground">No hay nadie a quien asignar todavía.</p>
            ) : (
              asignables.map((persona) => (
                <button
                  key={persona.id}
                  type="button"
                  onClick={() => void asignar(persona.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors duration-150 hover:bg-muted"
                >
                  {persona.nombre}
                </button>
              ))
            )}
          </PopoverContent>
        </Popover>
      )}
      {esTarea && aviso.responsable_id && !hecha && puedeEscribir && (
        <Popover open={asignarAbierto} onOpenChange={abrirAsignarPicker}>
          <PopoverTrigger asChild>
            <button
              type="button"
              className="self-start text-[11.5px] font-medium text-muted-foreground hover:text-foreground hover:underline"
            >
              Cambiar responsable
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-56 p-1">
            {cargandoAsignables ? (
              <div className="flex items-center justify-center gap-2 py-4 text-[12px] text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                Cargando…
              </div>
            ) : (
              <>
                {asignables.map((persona) => (
                  <button
                    key={persona.id}
                    type="button"
                    onClick={() => void asignar(persona.id)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors duration-150 hover:bg-muted",
                      persona.id === aviso.responsable_id && "font-medium",
                    )}
                  >
                    <span className="flex-1 truncate">{persona.nombre}</span>
                    {persona.id === aviso.responsable_id && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => void asignar(null)}
                  className="mt-0.5 flex w-full items-center gap-2 rounded-md border-t border-border px-2 py-1.5 pt-2 text-left text-[12.5px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
                >
                  Quitar responsable
                </button>
              </>
            )}
          </PopoverContent>
        </Popover>
      )}

      {/* Meta: autor, dirección, tiempo */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[11.5px] leading-none text-muted-foreground">
        {aviso.referencia && (
          <span className="inline-flex max-w-[160px] items-center truncate rounded-md bg-muted px-1.5 py-[3px] font-medium text-foreground/70">
            {aviso.referencia}
          </span>
        )}
        <span className="font-medium text-foreground/75">{autor ?? "Alguien"}</span>
        <span aria-hidden className="text-muted-foreground/40">·</span>
        <span>{ladoLabel(origenLado, "origen", miLado, delegacionNombre)}</span>
        <ArrowRight className="h-3 w-3 text-muted-foreground/50" aria-hidden />
        <span>{ladoLabel(aviso.destinatario, "destino", miLado, delegacionNombre)}</span>
        <span aria-hidden className="text-muted-foreground/40">·</span>
        <span title={formatFechaCompleta(aviso.creado_en)} className="tabular-nums">
          {formatRelativoCorto(aviso.creado_en)}
        </span>
      </div>

      {notificado && (
        <div className="flex items-center gap-1.5 rounded-lg bg-muted/50 px-2.5 py-1.5 text-[11.5px] text-muted-foreground">
          <Mail className="h-3 w-3 shrink-0" aria-hidden />
          <span className="min-w-0 truncate">
            Avisado a{" "}
            <span className="font-semibold text-foreground/80">
              {descripcionDestinoCorreo(aviso.destinatario, delegacionNombre)}
            </span>
            {" · "}
            {formatRelativoCorto(aviso.notificado_en)}
          </span>
        </div>
      )}

      {/* Acciones de tarea */}
      {esTarea && puedeEscribir && (
        <div className="flex items-center gap-1.5">
          {hecha ? (
            <button
              type="button"
              onClick={() => void onReabrir(aviso.id)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12px] font-medium text-foreground/80 transition-colors duration-150 hover:bg-muted"
            >
              <ArrowUpLeft className="h-3.5 w-3.5" aria-hidden />
              Reabrir
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => void completar()}
                disabled={ocupado === "completar"}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-foreground px-3 text-[12.5px] font-semibold text-background transition-colors duration-150 hover:bg-foreground/90 disabled:pointer-events-none disabled:opacity-60"
              >
                {ocupado === "completar" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Check className="h-3.5 w-3.5" aria-hidden />
                )}
                Marcar hecha
              </button>
              <button
                type="button"
                onClick={() => void notificar()}
                disabled={ocupado === "notificar"}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12px] font-medium text-foreground/80 transition-colors duration-150 hover:bg-muted disabled:pointer-events-none disabled:opacity-60"
              >
                {ocupado === "notificar" ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : notificado ? (
                  <BellRing className="h-3.5 w-3.5" aria-hidden />
                ) : (
                  <Bell className="h-3.5 w-3.5" aria-hidden />
                )}
                Recordar
              </button>
            </>
          )}
          <div className="flex-1" />
          {aviso.esMio && (
            <AccionIcono
              label={confirmandoBorrado ? "Pulsa otra vez para borrar" : "Borrar"}
              onClick={pedirBorrado}
              className={confirmandoBorrado ? "bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive" : undefined}
            >
              {confirmandoBorrado ? <Check className="h-4 w-4" aria-hidden /> : <Trash2 className="h-4 w-4" aria-hidden />}
            </AccionIcono>
          )}
        </div>
      )}
    </div>
  )
}
