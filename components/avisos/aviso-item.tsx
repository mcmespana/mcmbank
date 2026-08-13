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
  MailCheck,
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

/** Insignia corta en mayúsculas de la fila superior de la tarjeta. */
function Insignia({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-md px-2",
        "text-[10.5px] font-bold uppercase leading-none tracking-[0.05em]",
        className,
      )}
    >
      {children}
    </span>
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

  // Se carga al abrir el desplegable, no en un efecto: es una reacción directa
  // al clic del usuario, no una sincronización con el render.
  const abrirAsignar = (siguiente: boolean) => {
    setAsignarAbierto(siguiente)
    if (!siguiente) return
    setCargandoAsignables(true)
    onCargarAsignables(aviso.destinatario)
      .then(setAsignables)
      .finally(() => setCargandoAsignables(false))
  }

  const esTarea = aviso.tipo === "tarea"
  const hecha = aviso.estado === "hecha"
  const autor = primerNombre(aviso.autorNombre)
  const notificado = Boolean(aviso.notificado_en)
  const vencida = !hecha && estaVencida(aviso.fecha_limite)
  const saliente = !aviso.esParaMi
  const origenLado: AvisoDestinatario =
    aviso.destinatario === "delegacion" ? "oficina_tecnica" : "delegacion"

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

  const ejecutar = async (accion: "completar" | "notificar", fn: () => Promise<void> | void) => {
    setOcupado(accion)
    try {
      await fn()
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

  const listaAsignables = (
    <PopoverContent align="end" className="w-60 p-1">
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
              onClick={() => void asignar(persona.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-[13px]",
                "transition-colors duration-150 hover:bg-muted",
                persona.id === aviso.responsable_id && "font-medium",
              )}
            >
              <span className="flex-1 truncate">{persona.nombre}</span>
              {persona.id === aviso.responsable_id && (
                <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              )}
            </button>
          ))}
          {aviso.responsable_id && (
            <button
              type="button"
              onClick={() => void asignar(null)}
              className="mt-1 w-full rounded-md border-t border-border px-2 pb-1.5 pt-2 text-left text-[12.5px] text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground"
            >
              Quitar responsable
            </button>
          )}
        </>
      )}
    </PopoverContent>
  )

  return (
    <div
      onClick={aviso.noLeido ? () => onMarcarLeido(aviso.id) : undefined}
      className={cn(
        "relative flex flex-col gap-[11px] rounded-[18px] border p-[15px] transition-colors duration-150",
        "sm:gap-2.5 sm:rounded-2xl sm:p-3.5",
        hecha
          ? "border-border bg-muted/25"
          : aviso.noLeido
            ? "cursor-pointer border-primary/30 bg-primary/[0.045] dark:bg-primary/[0.07]"
            : "border-border bg-card",
      )}
    >
      {/* Insignias a la izquierda (envuelven si no caben), estado fijo a la derecha */}
      <div className="flex items-start gap-2">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-[7px] gap-y-1.5">
          {esTarea ? (
            <Insignia className="bg-amber-500/[0.16] text-amber-800 dark:text-amber-300">Tarea</Insignia>
          ) : (
            <Insignia className="bg-primary/[0.14] text-blue-700 dark:text-blue-300">Nota</Insignia>
          )}

          {esTarea && aviso.urgente && !hecha && (
            <Insignia className="bg-destructive/[0.12] text-red-700 dark:text-red-400">
              <Flag className="h-[11px] w-[11px]" aria-hidden />
              Urgente
            </Insignia>
          )}

          {/* Solo si no lo va a decir ya el indicador "Esperando" de la derecha */}
          {saliente && !hecha && !esTarea && (
            <Insignia className="bg-muted font-semibold tracking-[0.04em] text-muted-foreground">
              Enviada por nosotros
            </Insignia>
          )}
        </div>

        {/* Estado a la derecha: sin leer / esperando / leído */}
        {aviso.noLeido && !hecha ? (
          <span className="inline-flex h-5 shrink-0 items-center gap-1.5 text-[11px] font-semibold leading-none text-blue-600 dark:text-blue-300">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-primary" />
            Sin leer
          </span>
        ) : saliente && esTarea && !hecha ? (
          <span className="inline-flex h-5 shrink-0 items-center gap-1.5 text-[11px] font-medium leading-none text-muted-foreground">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            Esperando
          </span>
        ) : !esTarea && !hecha ? (
          <span className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[12px] font-medium text-muted-foreground sm:h-7">
            <Check className="h-[13px] w-[13px]" aria-hidden />
            Leído
          </span>
        ) : null}
      </div>

      {/* Contenido */}
      <p
        className={cn(
          "whitespace-pre-wrap break-words text-[15px] leading-[1.5] text-pretty sm:text-[14px]",
          aviso.noLeido && !hecha ? "font-medium text-foreground" : "text-foreground/90",
          hecha && "text-muted-foreground line-through decoration-muted-foreground/40",
        )}
      >
        {aviso.contenido}
      </p>

      {/* Responsable y fecha límite (solo tareas) */}
      {esTarea && aviso.responsable_id && (
        <div
          className={cn(
            "flex items-center gap-2.5 rounded-xl border p-2.5 sm:gap-2.5 sm:rounded-[11px] sm:px-[11px] sm:py-[9px]",
            aviso.esParaMi && !hecha ? "border-primary/35 bg-card" : "border-border bg-card",
          )}
        >
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-full sm:h-[26px] sm:w-[26px]",
              aviso.esParaMi && !hecha
                ? "bg-primary/[0.12] text-blue-700 dark:text-blue-300"
                : "bg-muted text-muted-foreground",
            )}
          >
            <User className="h-[15px] w-[15px] sm:h-3.5 sm:w-3.5" aria-hidden />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span
              className={cn(
                "truncate text-[10.5px] font-semibold uppercase leading-none tracking-[0.05em]",
                aviso.esParaMi && !hecha
                  ? "text-blue-700 dark:text-blue-300"
                  : "text-muted-foreground",
              )}
            >
              {aviso.esParaMi && !hecha ? "Os lo han asignado a" : "Responsable"}
            </span>
            <span className="truncate text-[13.5px] font-semibold leading-[1.1] sm:text-[13px]">
              {aviso.responsableNombre ?? "—"}
            </span>
          </span>
          {aviso.fecha_limite && (
            <span
              className={cn(
                "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[11.5px] font-semibold",
                vencida || aviso.urgente
                  ? "bg-destructive/[0.10] text-red-700 dark:text-red-400"
                  : "bg-muted text-muted-foreground",
              )}
            >
              <Calendar className="h-3 w-3" aria-hidden />
              <span className="hidden sm:inline">{hecha ? "" : "Antes del "}</span>
              {formatFechaLimiteCorta(aviso.fecha_limite)}
            </span>
          )}
        </div>
      )}

      {/* Sin responsable: invitación a asignar */}
      {esTarea && !aviso.responsable_id && !hecha && puedeEscribir && (
        <Popover open={asignarAbierto} onOpenChange={abrirAsignar}>
          <div className="flex items-center gap-2.5 rounded-xl border border-dashed border-border bg-secondary/60 p-2.5 sm:rounded-[11px] sm:px-[11px] sm:py-[9px]">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground sm:h-[26px] sm:w-[26px]">
              <UserPlus className="h-[15px] w-[15px] sm:h-3.5 sm:w-3.5" aria-hidden />
            </span>
            <span className="text-[12.5px] text-muted-foreground">Sin responsable asignado</span>
            <span className="flex-1" />
            <PopoverTrigger asChild>
              <button
                type="button"
                disabled={ocupado === "asignar"}
                onClick={(event) => event.stopPropagation()}
                className="shrink-0 text-[12px] font-semibold text-blue-600 transition-colors hover:text-blue-700 disabled:opacity-50 dark:text-blue-300"
              >
                {ocupado === "asignar" ? "Asignando…" : "Asignar"}
              </button>
            </PopoverTrigger>
          </div>
          {listaAsignables}
        </Popover>
      )}

      {/* Meta: autor, dirección y cuándo */}
      <div className="flex flex-wrap items-center gap-x-[7px] gap-y-1.5 text-[12px] leading-none text-muted-foreground sm:text-[11.5px]">
        {aviso.referencia && (
          <span className="inline-flex max-w-[160px] items-center truncate rounded-md bg-muted px-1.5 py-[3px] font-medium text-foreground/70">
            {aviso.referencia}
          </span>
        )}
        <span className="font-medium text-foreground/75">{autor ?? "Alguien"}</span>
        <span aria-hidden className="text-muted-foreground/40">·</span>
        <span>{ladoLabel(origenLado, "origen", miLado, delegacionNombre)}</span>
        <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground/60" aria-hidden />
        <span>{ladoLabel(aviso.destinatario, "destino", miLado, delegacionNombre)}</span>
        <span aria-hidden className="text-muted-foreground/40">·</span>
        {/* El tiempo relativo y el formato largo dependen del reloj y del ICU
            de cada entorno: difieren entre el render del servidor y el del
            navegador, y esa diferencia es esperada. */}
        <span
          suppressHydrationWarning
          title={formatFechaCompleta(aviso.creado_en)}
          className="tabular-nums"
        >
          {formatRelativoCorto(aviso.creado_en)}
        </span>
      </div>

      {/* Rastro del correo enviado */}
      {notificado && (
        <div className="flex items-center gap-1.5 rounded-[10px] bg-secondary px-2.5 py-2 text-[11.5px] leading-[1.35] text-muted-foreground sm:rounded-[9px] sm:px-2.5 sm:py-[7px]">
          <MailCheck className="h-[13px] w-[13px] shrink-0" aria-hidden />
          <span className="min-w-0" suppressHydrationWarning>
            Avisado a{" "}
            <span className="font-semibold text-foreground">
              {descripcionDestinoCorreo(aviso.destinatario, delegacionNombre)}
            </span>{" "}
            · {formatRelativoCorto(aviso.notificado_en)}
          </span>
        </div>
      )}

      {/* Acciones */}
      {puedeEscribir && (
        <div className="flex items-center gap-2 sm:gap-1.5">
          {hecha ? (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                void onReabrir(aviso.id)
              }}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-3 text-[13px] font-medium text-foreground/80 transition-colors duration-150 hover:bg-muted sm:h-8 sm:rounded-[9px] sm:px-3 sm:text-[12.5px]"
            >
              <ArrowUpLeft className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden />
              Volver a pendiente
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  void ejecutar("completar", () => onCompletar(aviso.id))
                }}
                disabled={ocupado === "completar"}
                className={cn(
                  "inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3.5 text-[14px] font-semibold",
                  "sm:h-8 sm:flex-none sm:justify-start sm:gap-1.5 sm:rounded-[9px] sm:px-[13px] sm:text-[12.5px]",
                  "bg-foreground text-background transition-colors duration-150 hover:bg-foreground/90",
                  "disabled:pointer-events-none disabled:opacity-60",
                )}
              >
                {ocupado === "completar" ? (
                  <Loader2 className="h-4 w-4 animate-spin sm:h-3.5 sm:w-3.5" aria-hidden />
                ) : esTarea ? (
                  <Check className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden />
                ) : (
                  <Archive className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden />
                )}
                {esTarea ? "Marcar hecha" : "Archivar"}
              </button>

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation()
                  void ejecutar("notificar", () => onNotificar(aviso.id))
                }}
                disabled={ocupado === "notificar"}
                title={notificado ? "Volver a avisar por correo" : "Avisar por correo"}
                aria-label={notificado ? "Volver a avisar por correo" : "Avisar por correo"}
                className={cn(
                  "inline-flex h-11 w-11 items-center justify-center gap-2 rounded-xl border border-border text-foreground/80",
                  "sm:h-8 sm:w-auto sm:rounded-[9px] sm:px-3 sm:text-[12.5px] sm:font-medium",
                  "transition-colors duration-150 hover:bg-muted disabled:pointer-events-none disabled:opacity-60",
                  notificado && "text-blue-600 dark:text-blue-300",
                )}
              >
                {ocupado === "notificar" ? (
                  <Loader2 className="h-4 w-4 animate-spin sm:h-3.5 sm:w-3.5" aria-hidden />
                ) : notificado ? (
                  <BellRing className="h-[17px] w-[17px] sm:h-3.5 sm:w-3.5" aria-hidden />
                ) : (
                  <Bell className="h-[17px] w-[17px] sm:h-3.5 sm:w-3.5" aria-hidden />
                )}
                <span className="hidden sm:inline">Recordar</span>
              </button>
            </>
          )}

          <span className="hidden flex-1 sm:block" />

          {aviso.esMio && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                pedirBorrado()
              }}
              title={confirmandoBorrado ? "Pulsa otra vez para borrar" : "Borrar"}
              aria-label={confirmandoBorrado ? "Pulsa otra vez para borrar" : "Borrar"}
              className={cn(
                "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border text-muted-foreground",
                "sm:h-8 sm:w-8 sm:rounded-[9px] sm:border-transparent",
                "transition-colors duration-150 hover:bg-muted hover:text-foreground",
                confirmandoBorrado &&
                  "border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15 hover:text-destructive",
              )}
            >
              {confirmandoBorrado ? (
                <Check className="h-[17px] w-[17px] sm:h-[15px] sm:w-[15px]" aria-hidden />
              ) : (
                <Trash2 className="h-[17px] w-[17px] sm:h-[15px] sm:w-[15px]" aria-hidden />
              )}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
