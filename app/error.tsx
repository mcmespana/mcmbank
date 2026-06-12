"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

/**
 * Error boundary de ruta: captura errores de render en las páginas y evita
 * la pantalla en blanco. Ofrece reintentar (re-renderiza el segmento) o
 * volver al inicio.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Error de ruta:", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-full bg-destructive/10 p-3">
        <AlertTriangle className="h-6 w-6 text-destructive" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Algo ha ido mal</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Ha ocurrido un error inesperado. Puedes reintentar o volver al inicio.
        </p>
      </div>
      <div className="flex gap-2">
        <Button onClick={reset}>Reintentar</Button>
        <Button variant="outline" onClick={() => (window.location.href = "/")}>
          Ir al inicio
        </Button>
      </div>
    </div>
  )
}
