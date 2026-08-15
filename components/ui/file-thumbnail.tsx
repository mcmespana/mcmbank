"use client"

import { useState } from "react"
import { FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileThumbnailProps {
  url: string
  mimeType: string | null
  nombre: string
  className?: string
}

// TODO: solución limpia a medio plazo: columna `miniatura_path` en
// `archivo_adjunto` generada por una Edge Function, para tener una miniatura
// real de PDF. Se probó a renderizarlo en un iframe escalado en el cliente,
// pero el visor de PDF del navegador no está pensado para eso: según el PDF
// enseñaba su propia barra de herramientas, quedaba en blanco mientras carga,
// o directamente mostraba un error — un "screenshot" de la web, no una
// miniatura. El icono de abajo es menos vistoso pero siempre es correcto.
export function FileThumbnail({ url, mimeType, nombre, className }: FileThumbnailProps) {
  const [errored, setErrored] = useState(false)

  const extension = nombre.split(".").pop()?.toUpperCase().slice(0, 4) ?? "FILE"
  const esPdf = mimeType === "application/pdf"

  const fallback = (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-1",
        esPdf ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300" : "bg-muted/50 text-muted-foreground",
      )}
    >
      <FileText className="h-6 w-6" aria-hidden />
      <span className="text-[10px] font-semibold tracking-wide">{extension}</span>
    </div>
  )

  return (
    <div className={cn("relative overflow-hidden rounded-md bg-muted/30", className)}>
      {!errored && mimeType?.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={nombre}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : (
        fallback
      )}
    </div>
  )
}
