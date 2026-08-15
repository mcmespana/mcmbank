"use client"

import { useEffect, useState } from "react"
import { FileQuestion, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { getSignedFileUrl, type BucketArchivo } from "@/lib/utils/signed-file-url"
import type { ArchivoAdjunto } from "@/lib/types/database"

/** Lo mínimo para pintar un adjunto: lo que trae `FacturaConRelaciones.archivos`. */
export type ArchivoVisible = Pick<
  ArchivoAdjunto,
  "nombre_original" | "tipo_mime" | "path_storage" | "bucket"
>

interface FacturaVisorDocumentoProps {
  archivo: ArchivoVisible | null
  className?: string
}

/**
 * El documento, a tamaño de leerlo.
 *
 * Para los PDF es un `<iframe>` con la URL firmada, es decir **el visor del
 * navegador**: el mismo que usa Holded, y el que ya sabe hacer zoom, buscar,
 * pasar páginas, girar e imprimir. Montar aquí un visor propio con pdf.js
 * sería reimplementar todo eso peor. (pdf.js sí se usa, pero para las
 * miniaturas de la bandeja, donde lo que se quiere es justo lo contrario: una
 * imagen y ninguna barra de herramientas.)
 */
export function FacturaVisorDocumento({ archivo, className }: FacturaVisorDocumentoProps) {
  // La firma se guarda junto al `path` que la pidió: al cambiar de documento,
  // el render descarta la anterior por sí solo en vez de tener que limpiarla
  // con un setState al entrar en el efecto.
  const [firmada, setFirmada] = useState<{ path: string; url: string } | null>(null)
  const [fallo, setFallo] = useState<{ path: string; mensaje: string } | null>(null)

  const path = archivo?.path_storage ?? null
  const bucket = (archivo?.bucket as BucketArchivo | undefined) ?? "facturas"

  useEffect(() => {
    if (!path) return
    let vigente = true
    getSignedFileUrl(path, bucket)
      .then((url) => {
        if (vigente) setFirmada({ path, url })
      })
      .catch((err) => {
        if (!vigente) return
        setFallo({
          path,
          mensaje: err instanceof Error ? err.message : "No se pudo abrir el documento",
        })
      })
    return () => {
      vigente = false
    }
  }, [path, bucket])

  const url = firmada?.path === path ? firmada.url : null
  const error = fallo?.path === path ? fallo.mensaje : null

  const contenedor = cn("flex h-full w-full items-center justify-center bg-muted/30", className)

  if (!archivo) {
    return (
      <div className={contenedor}>
        <div className="flex max-w-xs flex-col items-center gap-2 px-6 text-center text-muted-foreground">
          <FileQuestion className="h-8 w-8" aria-hidden />
          <p className="text-sm">Esta factura todavía no tiene ningún documento.</p>
          <p className="text-xs">Súbelo desde el panel de la derecha, al final del todo.</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={contenedor}>
        <p className="max-w-xs px-6 text-center text-sm text-muted-foreground">{error}</p>
      </div>
    )
  }

  if (!url) {
    return (
      <div className={contenedor}>
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" aria-hidden />
      </div>
    )
  }

  if (archivo.tipo_mime?.startsWith("image/")) {
    return (
      <div className={cn("h-full w-full overflow-auto bg-muted/30 p-4", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={url}
          alt={archivo.nombre_original}
          className="mx-auto max-w-full rounded-lg bg-white shadow-sm"
        />
      </div>
    )
  }

  return (
    <iframe
      src={url}
      title={archivo.nombre_original}
      className={cn("h-full w-full border-0 bg-muted/30", className)}
    />
  )
}
