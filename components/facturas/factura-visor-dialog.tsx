"use client"

import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Download, Loader2, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { VisuallyHidden } from "@/components/ui/visually-hidden"
import { descargarArchivo, type BucketArchivo } from "@/lib/utils/signed-file-url"
import { FacturaVisorDocumento, type ArchivoVisible } from "./factura-visor-documento"

interface FacturaVisorDialogProps {
  archivo: (ArchivoVisible & { id?: string }) | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * El documento a pantalla casi completa, dentro de la app.
 *
 * Existe por el móvil. Allí el workspace no tiene sitio para dos columnas, así
 * que el documento se veía abriendo una pestaña nueva… que Chrome bloquea: la
 * URL firmada tarda en llegar y para entonces el `window.open` ya no cuenta
 * como gesto del usuario, con lo que el botón parecía roto (el de descargar sí
 * funcionaba, porque no abre ventana). Enseñarlo aquí no depende de ningún
 * permiso del navegador y además no saca a nadie de la factura que está
 * rellenando.
 *
 * En escritorio no hace falta —el documento está a la izquierda— y por eso el
 * botón que lo abre solo se pinta cuando no hay visor al lado.
 */
export function FacturaVisorDialog({ archivo, open, onOpenChange }: FacturaVisorDialogProps) {
  const [descargando, setDescargando] = useState(false)

  const descargar = async () => {
    if (!archivo) return
    setDescargando(true)
    try {
      await descargarArchivo(
        archivo.path_storage,
        archivo.bucket as BucketArchivo,
        archivo.nombre_original,
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo descargar el archivo")
    } finally {
      setDescargando(false)
    }
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[90] bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        {/* z-[90]: el workspace va en z-[60] y sus menús en z-[80]. */}
        <DialogPrimitive.Content className="fixed inset-0 z-[90] flex flex-col bg-background outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 sm:inset-4 sm:rounded-2xl sm:border sm:border-border/60 sm:shadow-2xl">
          <DialogPrimitive.Title asChild>
            <VisuallyHidden>{archivo?.nombre_original ?? "Documento"}</VisuallyHidden>
          </DialogPrimitive.Title>

          <div className="flex items-center gap-2 border-b border-border/40 px-3 py-2">
            <span className="min-w-0 flex-1 truncate text-sm font-medium">
              {archivo?.nombre_original ?? "Documento"}
            </span>
            <button
              type="button"
              onClick={descargar}
              disabled={descargando || !archivo}
              title="Descargar"
              aria-label="Descargar"
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
            >
              {descargando ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Download className="h-4 w-4" aria-hidden />
              )}
            </button>
            <DialogPrimitive.Close
              aria-label="Cerrar"
              className="rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden />
            </DialogPrimitive.Close>
          </div>

          <div className="min-h-0 flex-1">
            <FacturaVisorDocumento archivo={archivo} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
