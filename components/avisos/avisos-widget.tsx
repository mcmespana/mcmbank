"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { ClipboardList, X } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { useAuth } from "@/contexts/auth-context"
import { useDelegationContext } from "@/contexts/delegation-context"
import { useAvisos } from "@/hooks/use-avisos"
import { useLocalStorageState } from "@/hooks/use-local-storage"
import { AVISO_DRAFT_VACIO, type AvisoDraft } from "./aviso-composer"
import { AvisosPanel } from "./avisos-panel"

const CIERRE_MS = 160

/**
 * Botón flotante (abajo a la derecha, lejos de la sidebar) con el panel de
 * avisos y tareas de la delegación activa. Se abre desde cualquier página con
 * ⌘/Ctrl + I, se cierra con Esc y el borrador aguanta cierres y recargas.
 */
export function AvisosWidget() {
  const { user } = useAuth()
  const { selectedDelegation, getCurrentDelegation } = useDelegationContext()
  const {
    avisos,
    hechos,
    loading,
    loadingHechos,
    error,
    contadores,
    miLado,
    rolConocido,
    puedeEscribir,
    cargarHechos,
    crear,
    completar,
    reabrir,
    eliminar,
    marcarLeidos,
    notificar,
    actualizarCambios,
    listarAsignables,
  } = useAvisos(selectedDelegation)

  const [open, setOpen] = useState(false)
  const [montado, setMontado] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [esMac, setEsMac] = useState(false)

  const [draft, setDraft] = useLocalStorageState<AvisoDraft>("mcmbank-aviso-draft", AVISO_DRAFT_VACIO)

  const panelRef = useRef<HTMLDivElement | null>(null)
  const botonRef = useRef<HTMLButtonElement | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)
  const cierreTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const destinatarioAplicado = useRef(false)

  const delegacionNombre = getCurrentDelegation()?.nombre ?? "Tu delegación"

  useEffect(() => {
    if (typeof navigator !== "undefined") {
      setEsMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent))
    }
  }, [])

  // Por defecto se escribe "al otro lado": la oficina técnica apunta cosas a la
  // delegación y los tesoreros a la oficina técnica.
  useEffect(() => {
    if (destinatarioAplicado.current) return
    // Hasta saber el rol, miLado no es fiable (por defecto sería "delegacion").
    if (!rolConocido) return
    destinatarioAplicado.current = true
    if (draft.contenido.trim()) return
    setDraft((prev) => ({
      ...prev,
      destinatario: miLado === "delegacion" ? "oficina_tecnica" : "delegacion",
      responsable_id: null,
      responsable_nombre: null,
    }))
  }, [miLado, rolConocido, draft.contenido, setDraft])

  const cerrar = useCallback(() => {
    setOpen(false)
    if (cierreTimer.current) clearTimeout(cierreTimer.current)
    cierreTimer.current = setTimeout(() => setMontado(false), CIERRE_MS)
    botonRef.current?.focus()
  }, [])

  const abrir = useCallback(() => {
    if (cierreTimer.current) clearTimeout(cierreTimer.current)
    setMontado(true)
    setOpen(true)
    setTimeout(() => textareaRef.current?.focus(), 90)
  }, [])

  const alternar = useCallback(() => {
    if (open) cerrar()
    else abrir()
  }, [open, abrir, cerrar])

  useEffect(() => {
    return () => {
      if (cierreTimer.current) clearTimeout(cierreTimer.current)
    }
  }, [])

  // Atajo global: ⌘/Ctrl + I abre y cierra. Esc cierra.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && !event.altKey && event.key.toLowerCase() === "i") {
        event.preventDefault()
        alternar()
        return
      }
      if (event.key === "Escape" && open) {
        event.preventDefault()
        cerrar()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [alternar, cerrar, open])

  // Clic fuera: cerrar sin perder el borrador.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (panelRef.current?.contains(target)) return
      if (botonRef.current?.contains(target)) return
      cerrar()
    }
    document.addEventListener("pointerdown", onPointerDown)
    return () => document.removeEventListener("pointerdown", onPointerDown)
  }, [open, cerrar])

  const actualizarDraft = useCallback(
    (cambios: Partial<AvisoDraft>) => setDraft((prev) => ({ ...prev, ...cambios })),
    [setDraft],
  )

  const enviar = useCallback(async () => {
    if (!draft.contenido.trim() || enviando) return
    setEnviando(true)
    const avisarPorCorreo = draft.notificar
    try {
      await crear({
        tipo: draft.tipo,
        contenido: draft.contenido,
        referencia: draft.referencia.trim() || null,
        destinatario: draft.destinatario,
        notificar: avisarPorCorreo,
        responsable_id: draft.responsable_id,
        fecha_limite: draft.fecha_limite,
        urgente: draft.urgente,
      })
      // Se limpia el texto y los detalles de la tarea, pero se conservan tipo
      // y destinatario: lo normal es apuntar varias cosas seguidas para el
      // mismo destinatario.
      setDraft((prev) => ({
        ...prev,
        contenido: "",
        referencia: "",
        referenciaAbierta: false,
        responsable_id: null,
        responsable_nombre: null,
        fecha_limite: null,
        urgente: false,
      }))
      toast.success(
        draft.tipo === "tarea" ? "Tarea apuntada" : "Nota publicada",
        avisarPorCorreo ? { description: "Y avisada por correo" } : undefined,
      )
      textareaRef.current?.focus()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo guardar")
    } finally {
      setEnviando(false)
    }
  }, [crear, draft, enviando, setDraft])

  const manejarNotificar = useCallback(
    async (id: string) => {
      try {
        const destinatarios = await notificar(id)
        toast.success(
          destinatarios.length === 1 ? "Avisado por correo" : `Avisadas ${destinatarios.length} personas`,
        )
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudo enviar el correo")
      }
    },
    [notificar],
  )

  const manejarCompletar = useCallback(
    async (id: string) => {
      try {
        await completar(id)
      } catch {
        toast.error("No se pudo marcar como hecha")
      }
    },
    [completar],
  )

  const manejarEliminar = useCallback(
    async (id: string) => {
      try {
        await eliminar(id)
      } catch {
        toast.error("No se pudo borrar")
      }
    },
    [eliminar],
  )

  const manejarMarcarTodoLeido = useCallback(
    () => marcarLeidos(avisos.filter((a) => a.noLeido).map((a) => a.id)),
    [avisos, marcarLeidos],
  )

  if (!user || !selectedDelegation) return null

  const badgeNoLeidos = contadores.noLeidos > 0
  const badge = badgeNoLeidos ? contadores.noLeidos : contadores.pendientes
  const atajo = esMac ? "⌘I" : "Ctrl+I"

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2.5 sm:bottom-6 sm:right-6 print:hidden">
      {/* Velo solo en móvil: la hoja tapa la pantalla, pero sigues en la misma página */}
      {montado && (
        <div
          aria-hidden
          onClick={cerrar}
          className={cn(
            "pointer-events-auto fixed inset-0 z-40 bg-foreground/20 backdrop-blur-[2px] sm:hidden",
            open ? "duration-200 animate-in fade-in-0" : "duration-150 animate-out fade-out-0",
          )}
        />
      )}

      {montado && (
        <div
          ref={panelRef}
          className={cn(
            // Móvil: hoja a pantalla completa, sin salir de donde estabas (es
            // una superposición, no una navegación). Escritorio: panel flotante
            // anclado junto al botón.
            "pointer-events-auto fixed inset-0 z-50 sm:static sm:inset-auto sm:z-auto sm:w-[27.25rem]",
            open
              ? "duration-200 ease-panel animate-in fade-in-0 slide-in-from-bottom-4 sm:zoom-in-[0.98] sm:slide-in-from-bottom-3"
              : "duration-150 ease-out animate-out fade-out-0 slide-out-to-bottom-4 sm:slide-out-to-bottom-1",
          )}
        >
          <AvisosPanel
            delegacionNombre={delegacionNombre}
            miLado={miLado}
            avisos={avisos}
            hechos={hechos}
            loading={loading}
            loadingHechos={loadingHechos}
            error={error}
            contadores={contadores}
            puedeEscribir={puedeEscribir}
            draft={draft}
            enviando={enviando}
            onDraftChange={actualizarDraft}
            onSubmit={() => void enviar()}
            onCompletar={manejarCompletar}
            onReabrir={reabrir}
            onEliminar={manejarEliminar}
            onMarcarLeido={(id) => marcarLeidos([id])}
            onMarcarTodoLeido={manejarMarcarTodoLeido}
            onNotificar={manejarNotificar}
            onActualizarCambios={actualizarCambios}
            onCargarAsignables={listarAsignables}
            onCargarHechos={cargarHechos}
            onClose={cerrar}
            textareaRef={textareaRef}
          />
        </div>
      )}

      <button
        ref={botonRef}
        type="button"
        onClick={alternar}
        aria-expanded={open}
        aria-label={`Avisos y tareas (${atajo})`}
        title={`Avisos y tareas · ${atajo}`}
        className={cn(
          "pointer-events-auto relative flex h-11 w-11 items-center justify-center rounded-full sm:h-12 sm:w-12",
          "bg-foreground text-background",
          "shadow-[0_1px_2px_rgba(0,0,0,0.05),0_10px_24px_-6px_rgba(0,0,0,0.32)]",
          "transition-[background-color,color,box-shadow,transform,opacity] duration-150",
          "hover:shadow-[0_1px_2px_rgba(0,0,0,0.05),0_14px_30px_-8px_rgba(0,0,0,0.40)]",
          "active:scale-[0.96]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
          // La hoja a pantalla completa en móvil ya tiene su propio botón de
          // cerrar; el flotante solo estorbaría (y quedaría debajo, tapado).
          montado && "hidden sm:flex",
        )}
      >
        {/* Los dos iconos conviven y se cruzan con opacidad, escala y desenfoque */}
        <ClipboardList
          aria-hidden
          className={cn(
            "absolute h-[18px] w-[18px] transition-[opacity,transform,filter] duration-200 ease-panel sm:h-[19px] sm:w-[19px]",
            open ? "scale-[0.25] opacity-0 blur-[4px]" : "scale-100 opacity-100 blur-0",
          )}
        />
        <X
          aria-hidden
          className={cn(
            "absolute h-[18px] w-[18px] transition-[opacity,transform,filter] duration-200 ease-panel sm:h-[19px] sm:w-[19px]",
            open ? "scale-100 opacity-100 blur-0" : "scale-[0.25] opacity-0 blur-[4px]",
          )}
        />

        {badge > 0 && !open && (
          <span
            className={cn(
              "absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1",
              "text-[10px] font-semibold leading-none tabular-nums text-white",
              "ring-2 ring-background duration-200 animate-in fade-in-0 zoom-in-75",
              badgeNoLeidos ? "bg-primary" : "bg-amber-500",
            )}
          >
            {badge > 9 ? "9+" : badge}
            <span className="sr-only">{badgeNoLeidos ? " sin leer" : " pendientes para ti"}</span>
          </span>
        )}
      </button>
    </div>
  )
}
