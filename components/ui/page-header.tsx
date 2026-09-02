import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  /**
   * Una línea que explica de qué va la pantalla. Opcional y **corta**: si
   * necesita dos frases, es documentación y va al manual (`docs/manual/`).
   */
  description?: ReactNode
  actions?: ReactNode
}

/**
 * Cabecera de una pantalla: un `h1`, su franja de acento y las acciones.
 *
 * Es el dueño único del patrón. Antes lo copiaban a mano seis pantallas, cada
 * una con su tamaño de letra (`text-4xl` aquí, `text-2xl sm:text-4xl` allá) y
 * una de ellas con `h2` en una página sin `h1` (design-plans/022).
 *
 * Sin degradado en el título ni sombra de color en la franja: `design.md`
 * §5.2 y §5.4. El `bg-clip-text` que llevaba ni siquiera se veía —le faltaba
 * `text-transparent`— así que era peso muerto que además bajaba el contraste
 * en cuanto alguien lo "arreglara".
 */
export function PageHeader({ title, description, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="h-8 w-1 shrink-0 rounded-full bg-primary" aria-hidden />
          <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
            {title}
          </h1>
        </div>
        {description && (
          <p className="ml-4 max-w-2xl text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}
