"use client"

import { useEffect, useState } from "react"
import { FileText, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { getSignedFileUrl, type BucketArchivo } from "@/lib/utils/signed-file-url"
import { primeraPaginaComoImagen } from "@/lib/utils/pdf-preview"

interface FileThumbnailProps {
  /** Ruta dentro del bucket (`archivo_adjunto.path_storage`). */
  path: string
  bucket: BucketArchivo
  mimeType: string | null
  nombre: string
  className?: string
  /** Ancho en píxeles al que se rasteriza el PDF. Súbelo si la miniatura es grande. */
  anchoRender?: number
}

/**
 * Miniatura de un archivo adjunto: la imagen, o la primera página del PDF.
 *
 * Antes esto era un icono rojo con las letras "PDF" y, para las imágenes, un
 * `<img>` apuntando a `url_publica` — que al ser un bucket privado no cargaba
 * nunca y dejaba el icono de imagen rota. Ahora se firma la URL y, si es un
 * PDF, se rasteriza la primera página en el cliente
 * (`lib/utils/pdf-preview.ts`). El icono sigue existiendo, pero como lo que
 * era: el último recurso cuando el documento no se puede pintar.
 */
export function FileThumbnail({
  path,
  bucket,
  mimeType,
  nombre,
  className,
  anchoRender = 400,
}: FileThumbnailProps) {
  // El resultado se guarda junto al `path` que lo produjo, en vez de
  // reiniciarlo al empezar cada carga: así, al cambiar de archivo, el render
  // ya sabe que lo que hay en memoria es de otro y enseña el cargando sin
  // necesidad de un setState de arranque.
  const [render, setRender] = useState<{ path: string; src: string } | null>(null)
  const [pathFallido, setPathFallido] = useState<string | null>(null)

  const esPdf = mimeType === "application/pdf"
  const esImagen = Boolean(mimeType?.startsWith("image/"))
  const soportado = esPdf || esImagen

  useEffect(() => {
    if (!soportado) return

    let vigente = true
    ;(async () => {
      try {
        const url = await getSignedFileUrl(path, bucket)
        const imagen = esPdf ? await primeraPaginaComoImagen(url, anchoRender) : url
        if (!vigente) return
        if (imagen) setRender({ path, src: imagen })
        else setPathFallido(path)
      } catch {
        if (vigente) setPathFallido(path)
      }
    })()

    return () => {
      vigente = false
    }
  }, [path, bucket, esPdf, soportado, anchoRender])

  const src = render?.path === path ? render.src : null
  const estado: "cargando" | "listo" | "fallo" = !soportado || pathFallido === path
    ? "fallo"
    : src
      ? "listo"
      : "cargando"

  const extension = nombre.split(".").pop()?.toUpperCase().slice(0, 4) ?? "FILE"

  return (
    <div className={cn("relative overflow-hidden rounded-md bg-muted/30", className)}>
      {estado === "listo" && src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={nombre}
          loading="lazy"
          decoding="async"
          className="h-full w-full bg-white object-cover object-top"
          onError={() => setPathFallido(path)}
        />
      ) : estado === "cargando" ? (
        <div className="flex h-full w-full items-center justify-center bg-muted/40 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          <span className="sr-only">Cargando la vista previa de {nombre}</span>
        </div>
      ) : (
        <div
          className={cn(
            "flex h-full w-full flex-col items-center justify-center gap-1",
            esPdf
              ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
              : "bg-muted/50 text-muted-foreground",
          )}
        >
          <FileText className="h-6 w-6" aria-hidden />
          <span className="text-[10px] font-semibold tracking-wide">{extension}</span>
        </div>
      )}
    </div>
  )
}
