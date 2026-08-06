"use client"

import { useEffect, useRef, useState } from "react"
import { FileText } from "lucide-react"
import { cn } from "@/lib/utils"

interface FileThumbnailProps {
  url: string
  mimeType: string | null
  nombre: string
  className?: string
}

// TODO: solución limpia a medio plazo: columna `miniatura_path` en
// `archivo_adjunto` generada por una Edge Function, en vez de renderizar
// el PDF en un iframe escalado en el cliente.
export function FileThumbnail({ url, mimeType, nombre, className }: FileThumbnailProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [inView, setInView] = useState(false)
  const [errored, setErrored] = useState(false)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new IntersectionObserver((entries) => {
      setInView(entries[0].isIntersecting)
    })
    observer.observe(el)

    return () => observer.unobserve(el)
  }, [])

  const extension = nombre.split(".").pop()?.toUpperCase().slice(0, 4) ?? "FILE"

  const fallback = (
    <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-muted/50 text-muted-foreground">
      <FileText className="h-6 w-6" aria-hidden />
      <span className="text-[10px] font-semibold tracking-wide">{extension}</span>
    </div>
  )

  return (
    <div ref={containerRef} className={cn("relative overflow-hidden rounded-md bg-muted/30", className)}>
      {errored ? (
        fallback
      ) : mimeType?.startsWith("image/") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={nombre}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      ) : mimeType === "application/pdf" ? (
        inView ? (
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <iframe
              src={`${url}#toolbar=0&navpanes=0&scrollbar=0&view=FitH&page=1`}
              className="pointer-events-none absolute left-0 top-0 h-[250%] w-[250%] origin-top-left scale-[0.4]"
              scrolling="no"
              tabIndex={-1}
              aria-hidden
              onError={() => setErrored(true)}
            />
          </div>
        ) : (
          fallback
        )
      ) : (
        fallback
      )}
    </div>
  )
}
