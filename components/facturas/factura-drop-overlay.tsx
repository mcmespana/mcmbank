"use client"

import { useEffect, useState } from "react"
import { Inbox } from "lucide-react"

interface FacturaDropOverlayProps {
  /** Nombre de la delegación, para dejar claro dónde van a caer. */
  delegacionNombre?: string | null
  disabled?: boolean
  onFiles: (files: File[]) => void
}

/**
 * Soltar facturas en cualquier punto de la página.
 *
 * La zona de subida estaba arriba del todo y era el único sitio válido: con la
 * bandeja llena había que subir hasta ella con los archivos cogidos. Aquí se
 * escucha el arrastre en toda la ventana y se enseña una diana a pantalla
 * completa en cuanto entran ficheros, así que la puntería deja de importar.
 *
 * El contador de `dragenter`/`dragleave` no es un capricho: esos eventos
 * disparan también al cruzar cada elemento hijo, y sin llevar la cuenta el
 * overlay parpadea al mover el ratón por encima de la propia página.
 */
export function FacturaDropOverlay({ delegacionNombre, disabled, onFiles }: FacturaDropOverlayProps) {
  const [profundidad, setProfundidad] = useState(0)

  useEffect(() => {
    if (disabled) return

    const traeFicheros = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types ?? []).includes("Files")

    const onDragEnter = (e: DragEvent) => {
      if (!traeFicheros(e)) return
      e.preventDefault()
      setProfundidad((n) => n + 1)
    }

    const onDragOver = (e: DragEvent) => {
      if (!traeFicheros(e)) return
      // Sin esto el navegador abre el PDF en la pestaña en vez de dárnoslo.
      e.preventDefault()
      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy"
    }

    const onDragLeave = (e: DragEvent) => {
      if (!traeFicheros(e)) return
      setProfundidad((n) => Math.max(0, n - 1))
    }

    const onDrop = (e: DragEvent) => {
      if (!traeFicheros(e)) return
      e.preventDefault()
      setProfundidad(0)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (files.length > 0) onFiles(files)
    }

    window.addEventListener("dragenter", onDragEnter)
    window.addEventListener("dragover", onDragOver)
    window.addEventListener("dragleave", onDragLeave)
    window.addEventListener("drop", onDrop)
    return () => {
      window.removeEventListener("dragenter", onDragEnter)
      window.removeEventListener("dragover", onDragOver)
      window.removeEventListener("dragleave", onDragLeave)
      window.removeEventListener("drop", onDrop)
    }
  }, [disabled, onFiles])

  if (disabled || profundidad === 0) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-background/85 backdrop-blur-sm animate-in fade-in-0 duration-150">
      <div className="pointer-events-none m-6 flex w-full max-w-lg flex-col items-center gap-4 rounded-3xl border-2 border-dashed border-primary bg-primary/[0.04] px-8 py-14 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Inbox className="h-7 w-7" aria-hidden />
        </div>
        <div className="text-lg font-semibold tracking-tight">Suelta las facturas donde quieras</div>
        <p className="max-w-sm text-sm text-muted-foreground">
          Van a la bandeja de {delegacionNombre || "la delegación"} y la IA las lee sola para
          rellenar proveedor, número, fecha e importe.
        </p>
      </div>
    </div>
  )
}
