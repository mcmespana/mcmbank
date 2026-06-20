import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Compass } from "lucide-react"

/**
 * Página 404 personalizada. Complementa a error.tsx / global-error.tsx para
 * evitar la pantalla por defecto de Next cuando una ruta no existe.
 */
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="rounded-full bg-muted p-3">
        <Compass className="h-6 w-6 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-semibold">Página no encontrada</h2>
        <p className="max-w-md text-sm text-muted-foreground">
          La página que buscas no existe o se ha movido. Comprueba la dirección o
          vuelve al inicio.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Ir al inicio</Link>
      </Button>
    </div>
  )
}
