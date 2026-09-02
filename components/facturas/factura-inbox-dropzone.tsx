"use client"

import { useDropzone } from "react-dropzone"
import { Inbox, Loader2, Sparkles } from "lucide-react"
import { cn } from "@/lib/utils"

interface FacturaInboxDropzoneProps {
  onFiles: (files: File[]) => void
  uploading: boolean
  leyendo: boolean
  progreso: { done: number; total: number } | null
  disabled?: boolean
}

/**
 * El recuadro de subida de la página. Sigue existiendo aunque se pueda soltar
 * en cualquier sitio: es lo que hace visible que la bandeja acepta archivos, y
 * lo único que se puede pulsar para abrir el explorador de ficheros.
 *
 * Ya no sube por su cuenta —de eso se encarga `useSubirFacturas`, compartido
 * con el arrastre a pantalla completa— para que las dos puertas cuenten el
 * mismo progreso.
 */
export function FacturaInboxDropzone({
  onFiles,
  uploading,
  leyendo,
  progreso,
  disabled,
}: FacturaInboxDropzoneProps) {
  const bloqueado = Boolean(disabled) || uploading || leyendo

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: onFiles,
    multiple: true,
    disabled: bloqueado,
    maxSize: 20 * 1024 * 1024,
    // Sin esto el evento sigue subiendo hasta `window`, donde también escucha
    // `FacturaDropOverlay`, y soltar los archivos justo encima de este recuadro
    // los subiría dos veces.
    noDragEventsBubbling: true,
  })

  return (
    <div
      {...getRootProps()}
      className={cn(
        "group/dz relative flex cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-lg border-2 border-dashed border-border/70 bg-gradient-to-br from-muted/40 via-background to-muted/20 px-4 py-6 text-center transition-[border-color,background-color] duration-200",
        isDragActive ? "border-primary bg-primary/5" : "hover:border-primary/50 hover:bg-primary/[0.03]",
        bloqueado && "cursor-not-allowed opacity-60",
      )}
    >
      <input {...getInputProps()} />
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-200",
          isDragActive ? "scale-110" : "group-hover/dz:scale-105",
        )}
      >
        {uploading || leyendo ? <Loader2 className="h-5 w-5 animate-spin" /> : <Inbox className="h-5 w-5" />}
      </div>
      {leyendo ? (
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden /> Leyendo las facturas con IA…
        </div>
      ) : uploading && progreso ? (
        <div className="text-sm font-medium">
          Subiendo {Math.min(progreso.done + 1, progreso.total)} de {progreso.total}…
        </div>
      ) : (
        <>
          <div className="text-sm font-semibold tracking-tight">
            {isDragActive ? "Suelta las facturas aquí" : "Arrastra facturas a la bandeja"}
          </div>
          <p className="max-w-md text-xs leading-relaxed text-muted-foreground">
            Suelta uno o varios PDF o imágenes —aquí o en cualquier punto de la página— y se crea una
            factura por archivo, ya leída con IA. También puedes pulsar para elegir archivos.
          </p>
        </>
      )}
    </div>
  )
}
