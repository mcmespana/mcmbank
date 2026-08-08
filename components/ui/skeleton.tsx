import { cn } from "@/lib/utils"

/**
 * Bloque de carga con animación de pulso. Úsalo para representar contenido
 * que aún no ha llegado (tablas, tarjetas, KPIs) y evitar saltos de layout.
 *
 * El color no es `bg-muted`: en el tema claro `--muted` (95% de luminosidad)
 * queda a solo tres puntos de `--background` (98%), así que sobre el degradado
 * de fondo de la app los skeletons resultaban prácticamente invisibles. Un
 * tinte del color de texto atenuado se ve en ambos temas sin dejar de ser
 * discreto.
 */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted-foreground/15 motion-reduce:animate-none dark:bg-muted-foreground/20",
        className,
      )}
      {...props}
    />
  )
}
