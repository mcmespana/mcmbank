import { cn } from "@/lib/utils"

/**
 * Bloque de carga con animación de pulso. Úsalo para representar contenido
 * que aún no ha llegado (tablas, tarjetas, KPIs) y evitar saltos de layout.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} {...props} />
}
