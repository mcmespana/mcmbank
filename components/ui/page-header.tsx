import type { ReactNode } from "react"

interface PageHeaderProps {
  title: string
  actions?: ReactNode
}

/**
 * Header grande con barra de degradado, patrón dominante del repo
 * (ver app/cuentas/page.tsx). Sin párrafo de descripción: eso va al manual.
 */
export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-center gap-4">
        <div className="h-10 w-2 rounded-full bg-gradient-to-b from-primary via-primary/70 to-primary/40 shadow-lg shadow-primary/30" />
        <h1 className="bg-gradient-to-r from-foreground via-foreground/90 to-foreground/70 bg-clip-text text-4xl font-extrabold">
          {title}
        </h1>
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
